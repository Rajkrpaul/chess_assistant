"use client";
import React, { useState, useEffect, useCallback } from "react";
import { HistoryGame, getHistory, analyzeGame, saveGame, GameAnalysisResponse, MoveAnalysis } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import MoveList from "./MoveList";
import MoveInsightPopup from "./MoveInsightPopup";
import { Chess } from "chess.js";

interface Props {
  onClose: () => void;
  /** Called when user jumps to a position in a historical game (read-only). */
  onLoadPosition: (fen: string, ply: number, moves: MoveAnalysis[]) => void;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function resultLabel(r: string) {
  return { "1-0": "White wins", "0-1": "Black wins", "1/2-1/2": "Draw", "*": "Incomplete" }[r] ?? r;
}

export default function HistoryPanel({ onClose, onLoadPosition }: Props) {
  const { config } = useTheme();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<HistoryGame | null>(null);
  const [replayPly, setReplayPly] = useState<number | null>(null);
  const [insightMove, setInsightMove] = useState<MoveAnalysis | null>(null);
  const [insightRect, setInsightRect] = useState<DOMRect | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [freshAnalysis, setFreshAnalysis] = useState<GameAnalysisResponse | null>(null);

  useEffect(() => {
    getHistory().then(setGames).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /** Build FEN list from PGN for read-only replay. */
  const fenList = useCallback((pgn: string): string[] => {
    const fens: string[] = [];
    try {
      const chess = new Chess();
      // Strip PGN headers
      const moveText = pgn.replace(/\[.*?\]\s*/g, "").trim();
      const tokens = moveText.split(/\s+/).filter(t => !/^\d+\./.test(t) && !["1-0","0-1","1/2-1/2","*"].includes(t));
      fens.push(chess.fen());
      for (const san of tokens) {
        chess.move(san);
        fens.push(chess.fen());
      }
    } catch { /* partial */ }
    return fens;
  }, []);

  const handleMoveClick = useCallback((move: MoveAnalysis, rect: DOMRect) => {
    setReplayPly(move.ply);
    setInsightMove(move);
    setInsightRect(rect);
    if (!selectedGame) return;
    const fens: string[] = [];
    try {
      const chess = new Chess();
      const moveText = selectedGame.pgn.replace(/\[.*?\]\s*/g, "").trim();
      const tokens = moveText.split(/\s+/).filter((t) => !/^\d+\./.test(t) && !["1-0","0-1","1/2-1/2","*"].includes(t));
      fens.push(chess.fen());
      for (const san of tokens) { chess.move(san); fens.push(chess.fen()); }
    } catch { }
    const fen = fens[move.ply] ?? fens[fens.length - 1];
    const moves = freshAnalysis?.moves ?? selectedGame.moves;
    onLoadPosition(fen, move.ply, moves);
  }, [selectedGame, onLoadPosition, freshAnalysis]);

  const handleAnalyzeGame = useCallback(async (game: HistoryGame) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setFreshAnalysis(null);
    try {
      const res = await analyzeGame(game.pgn);
      setFreshAnalysis(res);
      // Update saved record
      await saveGame(game.pgn, game.result, res.moves, res.summary);
      setGames(await getHistory());
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const panel: React.CSSProperties = {
    position: "fixed", top: 0, right: 0, bottom: 0,
    width: "min(400px, 95vw)",
    background: config.background,
    borderLeft: `1px solid ${config.glassBorder}`,
    zIndex: 400, display: "flex", flexDirection: "column",
    boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
    animation: "slideIn 0.25s ease",
    fontFamily: "'DM Sans', sans-serif",
  };

  const activeDisplayMoves = freshAnalysis?.moves ?? selectedGame?.moves ?? [];

  return (
    <>
      <style>{`@keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }`}</style>

      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 399, background: "rgba(0,0,0,0.4)" }} />

      <div style={panel}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 12px",
          borderBottom: `1px solid ${config.glassBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: config.textPrimary }}>
              📂 Match History
            </h2>
            <p style={{ margin: 0, fontSize: "0.68rem", color: config.textSecondary }}>Last 10 games</p>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            color: config.textSecondary, cursor: "pointer", fontSize: "1.1rem",
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <p style={{ padding: "20px", color: config.textSecondary, textAlign: "center", fontSize: "0.8rem" }}>
              Loading history…
            </p>
          )}

          {!loading && games.length === 0 && (
            <p style={{ padding: "20px", color: config.textSecondary, textAlign: "center", fontSize: "0.8rem" }}>
              No games saved yet. Finish a game and click "Analyze Game".
            </p>
          )}

          {/* Game list */}
          {!selectedGame && games.map((g) => (
            <button
              key={g.id}
              onClick={() => { setSelectedGame(g); setReplayPly(null); setFreshAnalysis(null); }}
              style={{
                width: "100%", textAlign: "left",
                padding: "14px 20px", background: "transparent",
                border: "none", borderBottom: `1px solid ${config.glassBorder}`,
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = `${config.accentPrimary}11`)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.78rem", color: config.textPrimary, fontWeight: 600 }}>
                  {g.summary?.opening_name ?? "Unknown Opening"}
                </span>
                <span style={{
                  fontSize: "0.65rem", padding: "2px 7px", borderRadius: "10px",
                  background: g.result === "1-0" ? "rgba(255,255,255,0.1)" : g.result === "0-1" ? "rgba(0,0,0,0.3)" : "rgba(100,100,100,0.2)",
                  color: g.result === "1-0" ? "#F0F6FF" : g.result === "0-1" ? "#8B8B8B" : "#FACC15",
                  border: `1px solid ${config.glassBorder}`,
                }}>
                  {resultLabel(g.result)}
                </span>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "0.65rem", color: config.textSecondary }}>{formatDate(g.date)}</span>
                {g.summary && (
                  <>
                    <span style={{ fontSize: "0.65rem", color: "#F0F6FF" }}>♙ {g.summary.accuracy_white.toFixed(0)}%</span>
                    <span style={{ fontSize: "0.65rem", color: "#8B8B8B" }}>♟ {g.summary.accuracy_black.toFixed(0)}%</span>
                    <span style={{ fontSize: "0.65rem", color: "#EF4444" }}>🔴 {g.summary.blunders_white + g.summary.blunders_black}</span>
                  </>
                )}
              </div>
            </button>
          ))}

          {/* Game detail view */}
          {selectedGame && (
            <div style={{ padding: "16px" }}>
              <button onClick={() => { setSelectedGame(null); setFreshAnalysis(null); }} style={{
                background: "transparent", border: `1px solid ${config.glassBorder}`,
                color: config.textSecondary, cursor: "pointer", fontSize: "0.72rem",
                padding: "4px 10px", borderRadius: "6px", marginBottom: "14px",
              }}>← Back</button>

              <h3 style={{ margin: "0 0 4px", fontSize: "0.9rem", color: config.textPrimary }}>
                {selectedGame.summary?.opening_name ?? "Game"}
              </h3>
              <p style={{ margin: "0 0 12px", fontSize: "0.7rem", color: config.textSecondary }}>
                {resultLabel(selectedGame.result)} · {formatDate(selectedGame.date)}
              </p>

              {/* Accuracy */}
              {selectedGame.summary && (
                <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
                  {[
                    { label: "White", val: selectedGame.summary.accuracy_white },
                    { label: "Black", val: selectedGame.summary.accuracy_black },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ flex: 1, padding: "8px", borderRadius: "8px", background: config.glassBg, border: `1px solid ${config.glassBorder}`, textAlign: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: config.textPrimary }}>{val.toFixed(0)}%</div>
                      <div style={{ fontSize: "0.62rem", color: config.textSecondary }}>{label} accuracy</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Analyze Game button */}
              <button
                onClick={() => handleAnalyzeGame(selectedGame)}
                disabled={analyzing}
                style={{
                  width: "100%", padding: "9px", borderRadius: "8px",
                  background: analyzing ? `${config.accentPrimary}33` : `${config.accentPrimary}22`,
                  border: `1px solid ${config.accentPrimary}44`,
                  color: config.accentPrimary, cursor: analyzing ? "not-allowed" : "pointer",
                  fontSize: "0.78rem", fontWeight: 600, marginBottom: "12px",
                }}
              >
                {analyzing ? "⏳ Analyzing…" : "🔍 Re-analyze Game"}
              </button>
              {analyzeError && (
                <p style={{ fontSize: "0.7rem", color: "#ff8080", marginBottom: "8px" }}>⚠ {analyzeError}</p>
              )}

              {/* Move list */}
              <MoveList
                moves={activeDisplayMoves}
                selectedPly={replayPly}
                isReplayMode
                onMoveClick={handleMoveClick}
              />
            </div>
          )}
        </div>
      </div>

      {insightMove && (
        <MoveInsightPopup
          move={insightMove}
          anchorRect={insightRect}
          onClose={() => { setInsightMove(null); setInsightRect(null); }}
        />
      )}
    </>
  );
}
