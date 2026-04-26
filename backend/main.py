import sys
import os
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local", override=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import (
    AnalyzeRequest, AnalyzeResponse,
    AnalyzeMoveRequest, MoveAnalysis,
    GameAnalysisRequest, GameAnalysisResponse,
    SaveGameRequest, HistoryGame, HistoryListResponse,
    ApiResponse,
)
from ai_service import AIService
from game_store import GameStore
import chess
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Chess Strategy Assistant API",
    description="Chess analysis powered by Stockfish engine",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_svc = AIService()
store = GameStore()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "engine": "stockfish",
        "stockfish_ready": ai_svc.is_ready(),
        "model": ai_svc.model,
    }


# ── Single-position analysis (existing) ──────────────────────────────────────

@app.post("/analyze", response_model=ApiResponse)
async def analyze_position(request: AnalyzeRequest):
    logger.info(f"Analyzing FEN: {request.fen}")
    try:
        board = chess.Board(request.fen)
        if not board.is_valid():
            raise ValueError("Invalid board state")
    except Exception:
        return ApiResponse.fail("Invalid FEN string provided.")

    if board.is_game_over():
        return ApiResponse.fail("The game is already over in this position.")

    if not list(board.legal_moves):
        return ApiResponse.fail("No legal moves available from this position.")

    try:
        result = await ai_svc.analyze_position(request.fen, depth=request.depth, skill_level=request.skill_level)
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return ApiResponse.fail(f"Analysis failed: {str(e)}")

    return ApiResponse.ok({
        "best_move": result.get("best_move", ""),
        "evaluation": result.get("evaluation", "0.00"),
        "explanation": result.get("explanation", ""),
        "top_moves": result.get("top_moves", []),
        "mate_in": result.get("mate_in"),
    })


# ── Per-move classification ───────────────────────────────────────────────────

@app.post("/analyze-move", response_model=ApiResponse)
async def analyze_move(request: AnalyzeMoveRequest):
    try:
        board = chess.Board(request.fen_before)
        move = chess.Move.from_uci(request.move_uci)
        if move not in board.legal_moves:
            raise ValueError("Illegal move")
    except Exception as exc:
        return ApiResponse.fail(f"Invalid input: {exc}")

    try:
        result = await ai_svc.analyze_move(
            fen_before=request.fen_before,
            move_uci=request.move_uci,
            ply=request.ply,
            depth=request.depth,
            skill_level=request.skill_level,
        )
    except Exception as e:
        logger.error(f"Move analysis error: {e}")
        return ApiResponse.fail(str(e))

    return ApiResponse.ok({
        "played_move": result.move_uci,
        "played_move_san": result.move_san,
        "best_move": result.best_move_uci,
        "best_move_san": result.best_move_san,
        "classification": result.classification,
        "eval_before": result.eval_before if result.eval_before is not None else 0.0,
        "eval_after": result.eval_after if result.eval_after is not None else 0.0,
        "centipawn_loss": result.centipawn_loss,
        "pv_line": result.pv_line or [],
        "insight": result.insight or "",
        "is_book": result.is_book,
        "is_brilliant": result.is_brilliant,
    })


# ── Full-game analysis ────────────────────────────────────────────────────────

@app.post("/analyze-game", response_model=ApiResponse)
async def analyze_game(request: GameAnalysisRequest):
    if not request.pgn.strip():
        return ApiResponse.fail("PGN cannot be empty.")
    try:
        analyses, summary = await ai_svc.analyze_game(request.pgn, depth=request.depth)
        return ApiResponse.ok({
            "moves": [m.model_dump() for m in analyses],
            "summary": summary.model_dump(),
        })
    except Exception as e:
        logger.error(f"Game analysis error: {e}")
        return ApiResponse.fail(str(e))


# ── History ───────────────────────────────────────────────────────────────────

@app.get("/history", response_model=HistoryListResponse)
async def get_history():
    games = store.list_games()
    return HistoryListResponse(games=games)


@app.get("/history/{game_id}", response_model=HistoryGame)
async def get_game(game_id: str):
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    return game


@app.post("/history", response_model=HistoryGame)
async def save_game(request: SaveGameRequest):
    try:
        saved = store.save_game(
            pgn=request.pgn,
            result=request.result,
            moves=request.moves,
            summary=request.summary,
        )
    except Exception as e:
        logger.error(f"Save game error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return saved


# ── Challenges Mode ───────────────────────────────────────────────────────────

import json
from pydantic import BaseModel
import random

PUZZLES = []
try:
    with open("data/puzzles.json", "r") as f:
        PUZZLES = json.load(f)
except Exception as e:
    logger.error(f"Failed to load puzzles: {e}")

@app.get("/challenge")
async def get_challenge(difficulty: str = "medium"):
    valid_puzzles = [p for p in PUZZLES if p["difficulty"] == difficulty]
    if not valid_puzzles:
        valid_puzzles = PUZZLES # Fallback to all
    puzzle = random.choice(valid_puzzles)
    return puzzle

class ChallengeValidateRequest(BaseModel):
    fen: str
    move: str
    difficulty: str
    attempts: int

class ChallengeValidateResponse(BaseModel):
    correct: bool
    best_move: str
    user_eval: float
    best_eval: float
    classification: str
    message: str
    line: list[str]
    attempts: int

@app.post("/challenge/validate", response_model=ApiResponse)
async def validate_challenge(req: ChallengeValidateRequest):
    # Analyze the move using ai_svc
    # Since it's a puzzle, we'll use a slightly lower depth for speed if needed, but 14 is fine.
    try:
        analysis = await ai_svc.analyze_move(
            fen_before=req.fen,
            move_uci=req.move,
            ply=1,
            depth=12,
            skill_level=20
        )
        
        # evaluation values could be None if mate. ai_svc uses float for pawn advantage or +/-100 for mates.
        user_eval = analysis.eval_after if analysis.eval_after is not None else 0.0
        best_eval = analysis.eval_before if analysis.eval_before is not None else 0.0
        
        # Fix signs: eval_before is from the player's perspective, eval_after is from opponent's perspective
        # In ai_svc, eval_after is absolute or relative? ai_svc normalizes everything to absolute (White's perspective) 
        # Wait, ai_service returns cp loss which is already calculated properly.
        # Let's use classification.
        
        delta = analysis.centipawn_loss / 100.0 if analysis.centipawn_loss is not None else 0.0
        
        thresholds = {"easy": 0.5, "medium": 0.3, "hard": 0.1}
        threshold = thresholds.get(req.difficulty, 0.3)
        
        is_exact_match = req.move[:4] == analysis.best_move_uci[:4]
        correct = delta <= threshold or is_exact_match
        
        message = analysis.insight
        if correct and req.attempts > 1:
            message = f"Good, but took {req.attempts} tries."
        elif correct:
            message = "Brilliant! You found a strong tactical idea."
            
        return ApiResponse.ok({
            "correct": correct,
            "best_move": analysis.best_move_uci,
            "user_eval": user_eval,
            "best_eval": best_eval,
            "classification": analysis.classification,
            "message": message,
            "line": analysis.pv_line or [],
            "attempts": req.attempts,
        })
    except Exception as e:
        logger.error(f"Challenge validation error: {e}")
        return ApiResponse.fail(str(e))

class ChallengeHintRequest(BaseModel):
    puzzle_id: str
    current_level: int

@app.post("/challenge/hint")
async def get_challenge_hint(req: ChallengeHintRequest):
    puzzle = next((p for p in PUZZLES if p["id"] == req.puzzle_id), None)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
        
    hints = puzzle.get("hints", [])
    if not hints:
        return {"hint": "No hints available."}
        
    level = min(req.current_level, len(hints) - 1)
    return {"hint": hints[level]}

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        loop="asyncio" if sys.platform == "win32" else "auto",
    )