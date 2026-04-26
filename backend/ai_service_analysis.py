"""
ai_service_analysis.py — Move classification + game analysis logic.
Imported by main.py alongside ai_service.py.
"""

import chess
import chess.pgn
import io
import logging
from typing import List, Optional, Dict, Any, Tuple

from models import MoveAnalysis, GameSummary

logger = logging.getLogger(__name__)

# ── ECO Opening Book (heuristic, first 10 plies) ──────────────────────────────
# Keyed by space-joined UCI moves from start position
ECO_BOOK: Dict[str, str] = {
    "e2e4": "King's Pawn Opening",
    "d2d4": "Queen's Pawn Opening",
    "g1f3": "Réti Opening",
    "c2c4": "English Opening",
    "e2e4 e7e5": "Open Game",
    "e2e4 e7e5 g1f3": "King's Knight Opening",
    "e2e4 e7e5 g1f3 b8c6": "Three Knights / Ruy Lopez setup",
    "e2e4 e7e5 g1f3 b8c6 f1b5": "Ruy Lopez",
    "e2e4 e7e5 g1f3 b8c6 f1c4": "Italian Game",
    "e2e4 e7e5 g1f3 b8c6 d2d4": "Scotch Game",
    "e2e4 e7e5 g1f3 g8f6": "Petrov's Defense",
    "e2e4 c7c5": "Sicilian Defense",
    "e2e4 c7c5 g1f3": "Sicilian — Open",
    "e2e4 c7c5 g1f3 d7d6": "Sicilian — Najdorf setup",
    "e2e4 c7c5 g1f3 b8c6": "Sicilian — Classical",
    "e2e4 e7e6": "French Defense",
    "e2e4 e7e6 d2d4": "French — Advance setup",
    "e2e4 c7c6": "Caro-Kann Defense",
    "e2e4 d7d5": "Scandinavian Defense",
    "e2e4 d7d6": "Pirc Defense",
    "d2d4 d7d5": "Queen's Gambit setup",
    "d2d4 d7d5 c2c4": "Queen's Gambit",
    "d2d4 d7d5 c2c4 e7e6": "Queen's Gambit Declined",
    "d2d4 d7d5 c2c4 c7c6": "Slav Defense",
    "d2d4 d7d5 c2c4 d5c4": "Queen's Gambit Accepted",
    "d2d4 g8f6": "Indian Defense",
    "d2d4 g8f6 c2c4": "Indian — c4",
    "d2d4 g8f6 c2c4 e7e6": "Nimzo/Queen's Indian setup",
    "d2d4 g8f6 c2c4 g7g6": "King's Indian Defense",
    "d2d4 g8f6 c2c4 c7c5": "Benoni Defense",
    "d2d4 g8f6 c2c4 e7e6 g1f3 b7b6": "Queen's Indian Defense",
    "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4": "Nimzo-Indian Defense",
    "g1f3 g8f6 c2c4": "Réti — English hybrid",
    "c2c4 e7e5": "English Opening — Reversed Sicilian",
    "e2e4 e7e5 f2f4": "King's Gambit",
    "e2e4 e7e5 f2f4 e5f4": "King's Gambit Accepted",
    "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6": "Two Knights Defense",
    "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5": "Italian — Giuoco Piano",
    "d2d4 d7d5 c2c4 c7c6 g1f3 g8f6": "Slav — Main Line",
}

BOOK_PLY_LIMIT = 10


def _moves_key(board_moves: List[str]) -> str:
    return " ".join(board_moves)


def is_book_move(move_uci: str, move_history: List[str], ply: int) -> Tuple[bool, str]:
    """Return (is_book, opening_name). move_history is UCI list BEFORE this move."""
    if ply > BOOK_PLY_LIMIT:
        return False, ""
    candidate = _moves_key(move_history + [move_uci])
    # Check exact match or prefix match
    for key, name in ECO_BOOK.items():
        if candidate == key or key.startswith(candidate) or candidate.startswith(key):
            return True, name
    return False, ""


def get_opening_name(move_history: List[str]) -> str:
    best = "Unknown Opening"
    for i in range(len(move_history), 0, -1):
        key = _moves_key(move_history[:i])
        if key in ECO_BOOK:
            best = ECO_BOOK[key]
            break
    return best


# ── Centipawn helpers ─────────────────────────────────────────────────────────

def _cp_for_side(cp_white: Optional[float], is_white_moving: bool) -> Optional[float]:
    """Convert White-POV centipawns to mover's POV."""
    if cp_white is None:
        return None
    return cp_white if is_white_moving else -cp_white


def _parse_eval(eval_str: str) -> Tuple[Optional[float], Optional[int]]:
    """Parse '+1.20' / '-0.50' / '#3' / '#-2' → (cp_white, mate)."""
    s = eval_str.strip()
    if s.startswith("#"):
        inner = s[1:].replace("+", "")
        try:
            return None, int(inner)
        except ValueError:
            return None, None
    try:
        return float(s.replace("+", "")) * 100, None  # pawns → cp
    except ValueError:
        return 0.0, None


# ── Classification ────────────────────────────────────────────────────────────

CLASSIFICATION_ORDER = [
    "Brilliant", "Great", "Excellent", "Good",
    "Inaccuracy", "Mistake", "Blunder", "Book",
]


def classify_move(
    cp_loss: int,
    move_uci: str,
    best_move_uci: str,
    is_book: bool,
    is_sacrifice: bool,
    has_alternatives: bool,
) -> str:
    if is_book:
        return "Book"
    if is_sacrifice and move_uci == best_move_uci and has_alternatives:
        return "Brilliant"
    if move_uci == best_move_uci or cp_loss == 0:
        return "Great"
    if cp_loss <= 10:
        return "Excellent"
    if cp_loss <= 25:
        return "Good"
    if cp_loss <= 50:
        return "Inaccuracy"
    if cp_loss <= 100:
        return "Mistake"
    return "Blunder"


def _is_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """True if the moved piece is of higher value than what it captures (or hangs)."""
    VALUES = {
        chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
        chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0,
    }
    piece = board.piece_at(move.from_square)
    if not piece:
        return False
    captured = board.piece_at(move.to_square)
    if captured:
        return VALUES.get(piece.piece_type, 0) > VALUES.get(captured.piece_type, 0)
    # Hanging piece check (simplified)
    return False


def _pv_to_san(board_copy: chess.Board, pv_uci: List[str], max_moves: int = 4) -> List[str]:
    san_list = []
    b = board_copy.copy()
    for uci in pv_uci[:max_moves]:
        try:
            m = chess.Move.from_uci(uci)
            san_list.append(b.san(m))
            b.push(m)
        except Exception:
            break
    return san_list


def _build_insight(
    classification: str,
    move_san: str,
    best_san: str,
    cp_loss: int,
    pv: List[str],
    is_book: bool,
    mover: str,
) -> str:
    pv_str = " ".join(pv[:3]) if pv else ""
    if is_book:
        return f"{move_san} is a well-known opening move."
    if classification == "Brilliant":
        return f"Brilliant sacrifice! {move_san} is the engine's top choice and gives {mover} a decisive edge."
    if classification == "Great":
        return f"{move_san} is the best move in this position. Well played!"
    if classification == "Excellent":
        return f"{move_san} is an excellent move (only {cp_loss} cp loss). Engine also considered {best_san}."
    if classification == "Good":
        return f"Good move. {move_san} keeps the balance. The engine preferred {best_san}{(' — line: ' + pv_str) if pv_str else ''}."
    if classification == "Inaccuracy":
        return f"Inaccuracy. {move_san} loses ~{cp_loss} cp. Better was {best_san}{(' — ' + pv_str) if pv_str else ''}."
    if classification == "Mistake":
        return f"Mistake! {move_san} loses ~{cp_loss} cp. {best_san} was correct{(' — ' + pv_str) if pv_str else ''}."
    if classification == "Blunder":
        return f"Blunder! {move_san} gives away ~{cp_loss//100:.1f} pawns. Play {best_san} instead{(' — ' + pv_str) if pv_str else ''}."
    return f"{move_san} played."


# ── Accuracy formula (chess.com style) ───────────────────────────────────────

def _move_accuracy(cp_loss: int) -> float:
    """Map centipawn loss → move accuracy 0-100."""
    import math
    # chess.com uses win-probability delta; we approximate with exponential decay
    return max(0.0, 100.0 * math.exp(-0.003 * cp_loss))


def compute_accuracy(move_analyses: List[MoveAnalysis], color: chess.Color) -> float:
    side = "w" if color == chess.WHITE else "b"
    # Odd plies = White (ply 1,3,5…), Even = Black (ply 2,4,6…)
    relevant = [m for m in move_analyses if (m.ply % 2 == 1) == (color == chess.WHITE)]
    if not relevant:
        return 100.0
    scores = [_move_accuracy(m.centipawn_loss) for m in relevant]
    return round(sum(scores) / len(scores), 1)


def best_streak(move_analyses: List[MoveAnalysis], color: chess.Color) -> int:
    GOOD_PLUS = {"Book", "Brilliant", "Great", "Excellent", "Good"}
    relevant = [m for m in move_analyses if (m.ply % 2 == 1) == (color == chess.WHITE)]
    best = cur = 0
    for m in relevant:
        if m.classification in GOOD_PLUS:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


def count_class(move_analyses: List[MoveAnalysis], color: chess.Color, cls: str) -> int:
    return sum(
        1 for m in move_analyses
        if m.classification == cls and (m.ply % 2 == 1) == (color == chess.WHITE)
    )
