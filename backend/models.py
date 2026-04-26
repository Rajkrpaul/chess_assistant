from pydantic import BaseModel, Field, validator
from typing import Optional, List, Any, Dict


# ── Existing models ────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    fen: str = Field(
        ...,
        description="FEN string representing the chess position",
        example="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    )
    depth: int = Field(
        default=20,
        ge=1,
        le=25,
        description="Analysis depth (higher = stronger but slower)"
    )
    skill_level: int = Field(
        default=20,
        ge=0,
        le=20,
        description="Stockfish skill level (0-20)"
    )

    @validator("fen")
    def fen_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("FEN string cannot be empty")
        return v.strip()


class TopMove(BaseModel):
    move: str
    evaluation: str


class AnalyzeResponse(BaseModel):
    best_move: str = Field(..., description="Best move in UCI notation (e.g., e2e4)")
    evaluation: str = Field(..., description="Position evaluation (e.g., +1.2, -0.5, #3)")
    explanation: str = Field(..., description="Human-readable explanation of the best move")
    top_moves: List[TopMove] = Field(default=[], description="Top candidate moves with evaluations")
    mate_in: Optional[int] = Field(None, description="Moves until checkmate (if applicable)")


# ── Move-level analysis models ─────────────────────────────────────────────────

class MoveAnalysis(BaseModel):
    move_uci: str                          # e.g. "e2e4"
    move_san: str                          # e.g. "e4"
    ply: int                               # 1-indexed half-move number
    classification: str                    # Brilliant | Great | Excellent | Good | Inaccuracy | Mistake | Blunder | Book
    eval_before: Optional[float]           # centipawns from White's POV (None if mate)
    eval_after: Optional[float]            # centipawns from White's POV (None if mate)
    mate_before: Optional[int]             # mate count before move (None if not mate)
    mate_after: Optional[int]              # mate count after move (None if not mate)
    centipawn_loss: int                    # ≥ 0, from the mover's perspective
    best_move_uci: str                     # engine's top choice in UCI
    best_move_san: str                     # engine's top choice in SAN
    pv_line: List[str]                     # principal variation (SAN, 3–4 moves)
    insight: str                           # human-readable explanation
    is_book: bool
    is_brilliant: bool


class AnalyzeMoveRequest(BaseModel):
    fen_before: str = Field(..., description="FEN before the move was played")
    move_uci: str = Field(..., description="The move played in UCI notation")
    ply: int = Field(default=1, ge=1)
    depth: int = Field(default=16, ge=1, le=25)
    skill_level: int = Field(default=20, ge=0, le=20, description="Stockfish skill level")


# ── Game-level analysis models ─────────────────────────────────────────────────

class GameSummary(BaseModel):
    accuracy_white: float          # 0-100
    accuracy_black: float          # 0-100
    # Negative classifications
    blunders_white: int
    mistakes_white: int
    inaccuracies_white: int
    blunders_black: int
    mistakes_black: int
    inaccuracies_black: int
    # Positive classifications
    good_white: int
    excellent_white: int
    great_white: int
    brilliant_white: int
    book_white: int
    good_black: int
    excellent_black: int
    great_black: int
    brilliant_black: int
    book_black: int
    # Streaks & metadata
    best_streak_white: int
    best_streak_black: int
    total_moves: int
    result: str
    opening_name: str


class GameAnalysisRequest(BaseModel):
    pgn: str = Field(..., description="Full PGN string of the game")
    depth: int = Field(default=16, ge=1, le=25)


class GameAnalysisResponse(BaseModel):
    moves: List[MoveAnalysis]
    summary: GameSummary


# ── History models ─────────────────────────────────────────────────────────────

class HistoryGame(BaseModel):
    id: str
    date: str
    result: str
    pgn: str
    moves: List[MoveAnalysis]
    summary: GameSummary


class SaveGameRequest(BaseModel):
    pgn: str
    result: str
    moves: List[MoveAnalysis]
    summary: GameSummary


class HistoryListResponse(BaseModel):
    games: List[HistoryGame]