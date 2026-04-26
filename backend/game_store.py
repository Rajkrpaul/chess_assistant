"""
game_store.py — SQLite-backed persistent storage for completed game analyses.

Stores up to MAX_GAMES (10) games. When full, the oldest game is evicted.
Uses only stdlib sqlite3 — no extra dependencies.
"""

import sqlite3
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path

from models import HistoryGame, MoveAnalysis, GameSummary

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "chess_history.db"
MAX_GAMES = 10


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id          TEXT PRIMARY KEY,
            date        TEXT NOT NULL,
            result      TEXT NOT NULL,
            pgn         TEXT NOT NULL,
            moves_json  TEXT NOT NULL,
            summary_json TEXT NOT NULL
        )
    """)
    conn.commit()


class GameStore:
    """Thread-safe SQLite wrapper for game history."""

    def __init__(self):
        with _get_conn() as conn:
            _ensure_table(conn)
        logger.info(f"GameStore initialised at {DB_PATH}")

    # ── Write ──────────────────────────────────────────────────────────────────

    def save_game(
        self,
        pgn: str,
        result: str,
        moves: List[MoveAnalysis],
        summary: GameSummary,
    ) -> HistoryGame:
        game_id = str(uuid.uuid4())[:8]
        date = datetime.now(timezone.utc).isoformat()

        moves_json = json.dumps([m.dict() for m in moves])
        summary_json = summary.json()

        with _get_conn() as conn:
            _ensure_table(conn)
            conn.execute(
                "INSERT INTO games (id, date, result, pgn, moves_json, summary_json) VALUES (?,?,?,?,?,?)",
                (game_id, date, result, pgn, moves_json, summary_json),
            )
            conn.commit()

            # Evict oldest if over limit
            rows = conn.execute(
                "SELECT id FROM games ORDER BY date ASC"
            ).fetchall()
            if len(rows) > MAX_GAMES:
                for row in rows[: len(rows) - MAX_GAMES]:
                    conn.execute("DELETE FROM games WHERE id = ?", (row["id"],))
                conn.commit()

        return HistoryGame(
            id=game_id,
            date=date,
            result=result,
            pgn=pgn,
            moves=moves,
            summary=summary,
        )

    # ── Read ───────────────────────────────────────────────────────────────────

    def list_games(self) -> List[HistoryGame]:
        with _get_conn() as conn:
            _ensure_table(conn)
            rows = conn.execute(
                "SELECT * FROM games ORDER BY date DESC LIMIT ?", (MAX_GAMES,)
            ).fetchall()

        games: List[HistoryGame] = []
        for row in rows:
            try:
                games.append(self._row_to_game(row))
            except Exception as exc:
                logger.warning(f"Skipping corrupt game row {row['id']}: {exc}")
        return games

    def get_game(self, game_id: str) -> Optional[HistoryGame]:
        with _get_conn() as conn:
            _ensure_table(conn)
            row = conn.execute(
                "SELECT * FROM games WHERE id = ?", (game_id,)
            ).fetchone()
        if not row:
            return None
        try:
            return self._row_to_game(row)
        except Exception as exc:
            logger.error(f"Failed to decode game {game_id}: {exc}")
            return None

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_game(row: sqlite3.Row) -> HistoryGame:
        moves_data = json.loads(row["moves_json"])
        moves = [MoveAnalysis(**m) for m in moves_data]
        summary = GameSummary(**json.loads(row["summary_json"]))
        return HistoryGame(
            id=row["id"],
            date=row["date"],
            result=row["result"],
            pgn=row["pgn"],
            moves=moves,
            summary=summary,
        )
