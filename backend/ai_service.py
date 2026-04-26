import os
import subprocess
import threading
import logging
import asyncio
import chess
import chess.pgn
import io
from typing import List, Optional, Dict, Any
from models import TopMove, MoveAnalysis, GameSummary
from ai_service_analysis import (
    is_book_move, get_opening_name, classify_move,
    _is_sacrifice, _pv_to_san, _build_insight, _parse_eval,
    compute_accuracy, best_streak, count_class,
)

logger = logging.getLogger(__name__)


def _clean_path(raw: str) -> str:
    path = raw.strip().strip('"').strip("'")
    path = path.replace("\\\\", "\\")
    return path


class _StockfishProcess:
    """
    Thin wrapper around a raw Stockfish subprocess using UCI over stdin/stdout.
    Uses only subprocess.Popen — zero asyncio involvement.
    """

    def __init__(self, path: str):
        self._path = path
        self._proc: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()

    def _start(self):
        logger.info("Starting Stockfish process...")
        self._proc = subprocess.Popen(
            [self._path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self._send("uci")
        self._read_until("uciok")
        self._send("isready")
        self._read_until("readyok")
        logger.info("Stockfish ready.")

    def _send(self, cmd: str):
        self._proc.stdin.write(cmd + "\n")
        self._proc.stdin.flush()

    def _read_until(self, token: str) -> List[str]:
        lines = []
        while True:
            line = self._proc.stdout.readline()
            if not line:
                raise RuntimeError("Stockfish process closed unexpectedly.")
            line = line.rstrip()
            if line:
                lines.append(line)
            if token in line:
                return lines

    def _is_alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def analyse(self, fen: str, depth: int, multipv: int, skill_level: int = 20) -> List[Dict]:
        with self._lock:
            if not self._is_alive():
                self._start()

            self._send("ucinewgame")
            self._send(f"setoption name Skill Level value {skill_level}")
            self._send(f"setoption name MultiPV value {multipv}")
            self._send(f"position fen {fen}")
            self._send(f"go depth {depth}")

            info_lines: List[str] = []
            bestmove_line = ""
            while True:
                line = self._proc.stdout.readline()
                if not line:
                    raise RuntimeError("Stockfish process closed unexpectedly.")
                line = line.rstrip()
                if line.startswith("info") and "pv" in line:
                    info_lines.append(line)
                elif line.startswith("bestmove"):
                    bestmove_line = line
                    break

        return self._parse_info(info_lines, bestmove_line, multipv)

    @staticmethod
    def _parse_info(info_lines: List[str], bestmove_line: str, multipv: int) -> List[Dict]:
        """
        Parse raw UCI 'info' lines into a list of dicts, one per PV slot.
        We keep only the last info line seen for each multipv index.
        """
        by_pv: Dict[int, Dict] = {}

        for line in info_lines:
            tokens = line.split()
            pv_index = 1
            score_cp: Optional[int] = None
            score_mate: Optional[int] = None
            pv_moves: List[str] = []

            i = 0
            while i < len(tokens):
                t = tokens[i]
                if t == "multipv":
                    pv_index = int(tokens[i + 1])
                    i += 2
                elif t == "score":
                    kind = tokens[i + 1]
                    val = int(tokens[i + 2])
                    if kind == "cp":
                        score_cp = val
                    elif kind == "mate":
                        score_mate = val
                    i += 3
                elif t == "pv":
                    pv_moves = tokens[i + 1:]
                    break
                else:
                    i += 1

            if pv_moves:
                by_pv[pv_index] = {
                    "pv": pv_moves,
                    "score_cp": score_cp,
                    "score_mate": score_mate,
                }

        # If multipv parsing failed (older SF builds omit multipv token when =1),
        # fall back to the bestmove line.
        if not by_pv and bestmove_line:
            parts = bestmove_line.split()
            move = parts[1] if len(parts) > 1 else None
            if move and move != "(none)":
                by_pv[1] = {"pv": [move], "score_cp": 0, "score_mate": None}

        return [by_pv[k] for k in sorted(by_pv.keys())]

    def close(self):
        if self._is_alive():
            try:
                self._proc.stdin.write("quit\n")
                self._proc.stdin.flush()
                self._proc.wait(timeout=3)
            except Exception:
                self._proc.kill()
        self._proc = None


class AIService:
    """
    Chess analysis using a raw Stockfish subprocess (pure subprocess.Popen,
    no asyncio) to avoid the Windows SelectorEventLoop subprocess limitation.
    The blocking analysis runs in a thread-pool executor so uvicorn stays free.
    """

    def __init__(self):
        DEFAULT_PATH = "./stockfish"

raw = os.getenv("STOCKFISH_PATH", DEFAULT_PATH)
cleaned = _clean_path(raw)

# fallback if env empty or invalid
if not cleaned or not os.path.isfile(cleaned):
    cleaned = DEFAULT_PATH

self.stockfish_path = cleaned
logger.info(f"Using Stockfish path: {self.stockfish_path}")
        self._engine_ok: bool = False
        self.model: str = "stockfish"
        self._sf: Optional[_StockfishProcess] = None

        if self.stockfish_path and os.path.isfile(self.stockfish_path):
            self._engine_ok = True
            self._sf = _StockfishProcess(self.stockfish_path)
            logger.info(f"Stockfish found at: {self.stockfish_path}")
        else:
            logger.warning(
                f"Stockfish not found at '{self.stockfish_path}'. "
                "Set STOCKFISH_PATH in backend/.env to enable full analysis."
            )

    def is_ready(self) -> bool:
        return self._engine_ok

    def _analyze_sync(self, fen: str, depth: int, skill_level: int) -> Dict[str, Any]:
        board = chess.Board(fen)
        multipv = min(3, board.legal_moves.count())

        try:
            pvs = self._sf.analyse(fen, depth, multipv, skill_level)
        except Exception as exc:
            logger.error(f"Stockfish subprocess error: {exc}; restarting next call.")
            self._sf.close()
            raise

        top_moves: List[TopMove] = []
        best_move: Optional[str] = None
        evaluation: str = "0.00"
        mate_in: Optional[int] = None

        for i, pv_info in enumerate(pvs):
            uci = pv_info["pv"][0] if pv_info["pv"] else None
            if not uci:
                continue

            score_cp = pv_info.get("score_cp")
            score_mate = pv_info.get("score_mate")
            eval_str, m = self._format_score(score_cp, score_mate, board.turn)

            top_moves.append(TopMove(move=uci, evaluation=eval_str))

            if i == 0:
                best_move = uci
                evaluation = eval_str
                mate_in = m

        # Fallback: first legal move
        if not best_move:
            legal = list(board.legal_moves)
            if not legal:
                raise RuntimeError("No legal moves available.")
            best_move = legal[0].uci()

        # Sanity-check legality
        try:
            move_obj = chess.Move.from_uci(best_move)
            if move_obj not in board.legal_moves:
                logger.error(f"Illegal move '{best_move}' from Stockfish; using first legal move.")
                legal = list(board.legal_moves)
                best_move = legal[0].uci() if legal else None
                if not best_move:
                    raise RuntimeError("No legal moves available.")
                if top_moves:
                    top_moves[0] = TopMove(move=best_move, evaluation=evaluation)
        except ValueError:
            legal = list(board.legal_moves)
            best_move = legal[0].uci() if legal else None

        explanation = self._build_explanation(board, best_move, evaluation, mate_in)
        logger.info(f"Best: {best_move}, Eval: {evaluation}")

        return {
            "best_move": best_move,
            "evaluation": evaluation,
            "explanation": explanation,
            "top_moves": top_moves,
            "mate_in": mate_in,
        }

    async def analyze_position(self, fen: str, depth: int = 15, skill_level: int = 20) -> Dict[str, Any]:
        """Get best move and evaluation from Stockfish."""
        if not self._engine_ok:
            return self._fallback_analysis(fen)

        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, self._analyze_sync, fen, depth, skill_level)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Stockfish analysis error:")
            return self._fallback_analysis(fen)

    # ── Move-context analysis ─────────────────────────────────────────────────

    def _analyze_move_sync(
        self,
        fen_before: str,
        move_uci: str,
        ply: int,
        depth: int,
        skill_level: int,
        move_history: List[str],
    ) -> MoveAnalysis:
        board_before = chess.Board(fen_before)
        move_obj = chess.Move.from_uci(move_uci)
        move_san = board_before.san(move_obj)
        is_white = board_before.turn == chess.WHITE
        mover = "White" if is_white else "Black"

        # Eval BEFORE
        pvs_before = self._sf.analyse(fen_before, depth, min(3, board_before.legal_moves.count()), skill_level)
        best_pv = pvs_before[0] if pvs_before else {"pv": [move_uci], "score_cp": 0, "score_mate": None}
        best_move_uci = best_pv["pv"][0] if best_pv["pv"] else move_uci
        eval_before_str, _ = self._format_score(best_pv.get("score_cp"), best_pv.get("score_mate"), board_before.turn)
        cp_before, mate_before = _parse_eval(eval_before_str)
        # Convert to White POV (already done by _format_score)
        cp_before_white = cp_before
        mate_before_val = mate_before

        # Eval AFTER
        board_after = board_before.copy()
        board_after.push(move_obj)
        fen_after = board_after.fen()
        legal_after = board_after.legal_moves.count()
        if legal_after > 0:
            pvs_after = self._sf.analyse(fen_after, depth, 1, skill_level)
            after_pv = pvs_after[0] if pvs_after else {"pv": [], "score_cp": 0, "score_mate": None}
            eval_after_str, _ = self._format_score(after_pv.get("score_cp"), after_pv.get("score_mate"), board_after.turn)
        else:
            eval_after_str = "0.00"
            after_pv = {"pv": [], "score_cp": 0, "score_mate": None}
        cp_after, mate_after = _parse_eval(eval_after_str)
        cp_after_white = cp_after
        mate_after_val = mate_after

        # Centipawn loss from mover's perspective
        if mate_before_val is not None or mate_after_val is not None:
            cp_loss = 0  # don't penalise mate sequences
        elif cp_before_white is not None and cp_after_white is not None:
            mover_before = cp_before_white if is_white else -cp_before_white
            mover_after = cp_after_white if is_white else -cp_after_white
            cp_loss = max(0, int(mover_before - mover_after))
        else:
            cp_loss = 0

        # Book / sacrifice detection
        book, _ = is_book_move(move_uci, move_history, ply)
        sacrifice = _is_sacrifice(board_before, move_obj)
        has_alternatives = len(pvs_before) >= 2

        best_board = board_before.copy()
        try:
            best_san = best_board.san(chess.Move.from_uci(best_move_uci))
        except Exception:
            best_san = best_move_uci

        classification = classify_move(cp_loss, move_uci, best_move_uci, book, sacrifice, has_alternatives)

        # PV line in SAN from position after best move
        pv_uci = best_pv["pv"][1:] if len(best_pv["pv"]) > 1 else []
        pv_board = board_before.copy()
        try:
            pv_board.push(chess.Move.from_uci(best_move_uci))
        except Exception:
            pass
        pv_san = _pv_to_san(pv_board, pv_uci, max_moves=3)

        insight = _build_insight(classification, move_san, best_san, cp_loss, pv_san, book, mover)

        return MoveAnalysis(
            move_uci=move_uci,
            move_san=move_san,
            ply=ply,
            classification=classification,
            eval_before=round(cp_before_white / 100, 2) if cp_before_white is not None else None,
            eval_after=round(cp_after_white / 100, 2) if cp_after_white is not None else None,
            mate_before=mate_before_val,
            mate_after=mate_after_val,
            centipawn_loss=cp_loss,
            best_move_uci=best_move_uci,
            best_move_san=best_san,
            pv_line=pv_san,
            insight=insight,
            is_book=book,
            is_brilliant=(classification == "Brilliant"),
        )

    async def analyze_move(self, fen_before: str, move_uci: str, ply: int, depth: int = 16, skill_level: int = 20, move_history: Optional[List[str]] = None) -> MoveAnalysis:
        if not self._engine_ok:
            board = chess.Board(fen_before)
            mv = chess.Move.from_uci(move_uci)
            return MoveAnalysis(
                move_uci=move_uci, move_san=board.san(mv), ply=ply,
                classification="Good", eval_before=0.0, eval_after=0.0,
                mate_before=None, mate_after=None, centipawn_loss=0,
                best_move_uci=move_uci, best_move_san=board.san(mv),
                pv_line=[], insight="Stockfish unavailable.",
                is_book=False, is_brilliant=False,
            )

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._analyze_move_sync, fen_before, move_uci, ply, depth, skill_level, move_history or []
        )

    # ── Full-game analysis ────────────────────────────────────────────────────

    def _analyze_game_sync(self, pgn: str, depth: int) -> tuple:
        """Returns (List[MoveAnalysis], GameSummary)."""
        game = chess.pgn.read_game(io.StringIO(pgn))
        if game is None:
            raise ValueError("Could not parse PGN")

        result = game.headers.get("Result", "*")
        board = game.board()
        analyses: List[MoveAnalysis] = []
        move_history: List[str] = []
        ply = 0

        for node in game.mainline():
            ply += 1
            move = node.move
            fen_before = board.fen()
            analysis = self._analyze_move_sync(fen_before, move.uci(), ply, depth, 20, list(move_history))
            analyses.append(analysis)
            move_history.append(move.uci())
            board.push(move)

        opening = get_opening_name(move_history)

        summary = GameSummary(
            accuracy_white=compute_accuracy(analyses, chess.WHITE),
            accuracy_black=compute_accuracy(analyses, chess.BLACK),
            # Negative
            blunders_white=count_class(analyses, chess.WHITE, "Blunder"),
            mistakes_white=count_class(analyses, chess.WHITE, "Mistake"),
            inaccuracies_white=count_class(analyses, chess.WHITE, "Inaccuracy"),
            blunders_black=count_class(analyses, chess.BLACK, "Blunder"),
            mistakes_black=count_class(analyses, chess.BLACK, "Mistake"),
            inaccuracies_black=count_class(analyses, chess.BLACK, "Inaccuracy"),
            # Positive
            good_white=count_class(analyses, chess.WHITE, "Good"),
            excellent_white=count_class(analyses, chess.WHITE, "Excellent"),
            great_white=count_class(analyses, chess.WHITE, "Great"),
            brilliant_white=count_class(analyses, chess.WHITE, "Brilliant"),
            book_white=count_class(analyses, chess.WHITE, "Book"),
            good_black=count_class(analyses, chess.BLACK, "Good"),
            excellent_black=count_class(analyses, chess.BLACK, "Excellent"),
            great_black=count_class(analyses, chess.BLACK, "Great"),
            brilliant_black=count_class(analyses, chess.BLACK, "Brilliant"),
            book_black=count_class(analyses, chess.BLACK, "Book"),
            # Streaks & metadata
            best_streak_white=best_streak(analyses, chess.WHITE),
            best_streak_black=best_streak(analyses, chess.BLACK),
            total_moves=len(analyses),
            result=result,
            opening_name=opening,
        )
        return analyses, summary

    async def analyze_game(self, pgn: str, depth: int = 16):
        if not self._engine_ok:
            raise RuntimeError("Stockfish unavailable — cannot analyse game.")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._analyze_game_sync, pgn, depth)

    @staticmethod
    def _format_score(
        score_cp: Optional[int],
        score_mate: Optional[int],
        turn: chess.Color,
    ) -> tuple[str, Optional[int]]:
        if score_mate is not None:
            # score_mate is from the engine's POV; convert to White's POV
            m = score_mate if turn == chess.WHITE else -score_mate
            sign = "" if m > 0 else "-"
            return f"#{sign}{abs(m)}", m
        if score_cp is not None:
            # score_cp is from the engine's POV; convert to White's POV
            cp_white = score_cp if turn == chess.WHITE else -score_cp
            pawns = cp_white / 100.0
            sign = "+" if pawns >= 0 else ""
            return f"{sign}{pawns:.2f}", None
        return "0.00", None

    @staticmethod
    def _build_explanation(
        board: chess.Board,
        best_move: str,
        evaluation: str,
        mate_in: Optional[int],
    ) -> str:
        if mate_in is not None:
            if mate_in > 0:
                return (
                    f"Stockfish found a forced checkmate in {mate_in} move"
                    f"{'s' if mate_in != 1 else ''}. "
                    f"Play {best_move} to deliver the decisive blow."
                )
            else:
                return (
                    f"The opponent has a forced checkmate in {abs(mate_in)} move"
                    f"{'s' if abs(mate_in) != 1 else ''}. "
                    f"Best defensive try is {best_move}."
                )

        try:
            val = float(evaluation.replace("+", ""))
        except ValueError:
            val = 0.0

        if val > 2.5:
            sentiment = "White has a winning advantage."
        elif val > 1.0:
            sentiment = "White has a significant edge."
        elif val > 0.3:
            sentiment = "White has a slight advantage."
        elif val < -2.5:
            sentiment = "Black has a winning advantage."
        elif val < -1.0:
            sentiment = "Black has a significant edge."
        elif val < -0.3:
            sentiment = "Black has a slight advantage."
        else:
            sentiment = "The position is approximately equal."

        try:
            move = chess.Move.from_uci(best_move)
            piece = board.piece_at(move.from_square)
            piece_name = chess.piece_name(piece.piece_type).capitalize() if piece else "Piece"
            to_sq = chess.square_name(move.to_square)
            action = f"captures on {to_sq}" if board.is_capture(move) else f"moves to {to_sq}"
            move_desc = f"{piece_name} {action}"
        except Exception:
            move_desc = f"Move {best_move}"

        return f"{move_desc} is Stockfish's top choice. {sentiment} (Eval: {evaluation})"

    def _fallback_analysis(self, fen: str) -> Dict[str, Any]:
        try:
            board = chess.Board(fen)
            legal = list(board.legal_moves)
            if not legal:
                raise ValueError("No legal moves")
            best = legal[0].uci()
            top_moves = [TopMove(move=m.uci(), evaluation="0.00") for m in legal[:3]]
            return {
                "best_move": best,
                "evaluation": "0.00",
                "explanation": (
                    f"{best} selected (Stockfish unavailable). "
                    "Set STOCKFISH_PATH in backend/.env for accurate engine analysis."
                ),
                "top_moves": top_moves,
                "mate_in": None,
            }
        except Exception as exc:
            logger.error(f"Fallback analysis failed: {exc}")
            raise RuntimeError("No legal moves available in this position.")