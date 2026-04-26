"use client";
import React, { useState, useCallback } from "react";
import {
  GameAnalysisResponse, MoveAnalysis, CLASSIFICATION_META,
  MoveClassification, analyzeGame, saveGame,
} from "../services/api";
import { useTheme } from "../context/ThemeContext";
import MoveList from "./MoveList";
import MoveInsightPopup from "./MoveInsightPopup";

interface Props {
  pgn: string;
  result: string;
  onClose: () => void;
  onAnalysisComplete?: (moves: MoveAnalysis[]) => void;
}

const RESULT_LABEL: Record<string, string> = {
  "1-0": "White wins", "0-1": "Black wins", "1/2-1/2": "Draw", "*": "Game ended",
};

function AccuracyRing({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value / 100, 1) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <div style={{ position: "relative", width: 78, height: 78 }}>
        <svg width={78} height={78} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={39} cy={39} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
          <circle
            cx={39} cy={39} r={r} fill="none"
            stroke={color} strokeWidth={7}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontSize: "1rem", fontWeight: 800, color: "#fff" }}>
          {value.toFixed(0)}
        </span>
      </div>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  );
}

function StatPill({ count, cls }: { count: number; cls: MoveClassification }) {
  const meta = CLASSIFICATION_META[cls];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "6px 8px", borderRadius: "8px", background: `${meta.color}12`, border: `1px solid ${meta.color}30`, minWidth: 48 }}>
      <span style={{ fontSize: "0.68rem", color: meta.color }}>{meta.icon}</span>
      <span style={{ fontSize: "1rem", fontWeight: 700, color: meta.color, fontFamily: "'DM Sans', sans-serif" }}>{count}</span>
      <span style={{ fontSize: "0.56rem", color: "rgba(255,255,255,0.38)", fontFamily: "'DM Sans', sans-serif" }}>{meta.label}</span>
    </div>
  );
}

export default function PostGameReport({ pgn, result, onClose, onAnalysisComplete }: Props) {
  const { config } = useTheme();
  const [analysis, setAnalysis] = useState<GameAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number | null>(null);
  const [insightMove, setInsightMove] = useState<MoveAnalysis | null>(null);
  const [insightRect, setInsightRect] = useState<DOMRect | null>(null);
  const [showMoveList, setShowMoveList] = useState(true); // open by default

  const handleAnalyze = useCallback(async () => {
    if (!pgn || !pgn.trim()) {
      setError("No moves to analyze. Play at least one move first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeGame(pgn);
      setAnalysis(res);
      setShowMoveList(true);
      if (onAnalysisComplete) {
        onAnalysisComplete(res.moves);
      }
      try {
        await saveGame(pgn, result, res.moves, res.summary);
        setSaved(true);
      } catch { /* non-fatal */ }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [pgn, result]);

  const s = analysis?.summary;

  const handleMoveClick = useCallback((move: MoveAnalysis, rect: DOMRect) => {
    setSelectedPly(move.ply);
    setInsightMove(move);
    setInsightRect(rect);
  }, []);

  return (
    <>
      <style>{`@keyframes fadeInModal { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }`}</style>

      {/* Backdrop */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, backdropFilter: "blur(5px)" }} onClick={onClose}>
        <div
          style={{
            background: config.background,
            border: `1px solid ${config.glassBorder}`,
            borderRadius: "18px",
            padding: "28px 30px",
            width: "min(660px, 96vw)",
            maxHeight: "88vh",
            overflowY: "auto",
            boxShadow: "0 28px 80px rgba(0,0,0,0.75)",
            position: "relative",
            fontFamily: "'DM Sans', sans-serif",
            animation: "fadeInModal 0.2s ease",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: config.textSecondary, cursor: "pointer", fontSize: "1.1rem" }}>✕</button>

          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: "22px" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: config.textPrimary, margin: "0 0 4px" }}>Game Analysis</h2>
            <p style={{ fontSize: "0.78rem", color: config.textSecondary, margin: 0 }}>
              {RESULT_LABEL[result] ?? result}
              {s ? ` · ${s.opening_name} · ${s.total_moves} moves` : ""}
            </p>
          </div>

          {/* Analyze trigger */}
          {!analysis && (
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                style={{
                  padding: "13px 36px", borderRadius: "10px",
                  background: loading ? `${config.accentPrimary}44` : config.btnBg,
                  color: config.btnText, border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: "0.92rem",
                  letterSpacing: "0.05em", transition: "opacity 0.2s",
                }}
              >
                {loading ? "⏳ Analyzing… (15–60 s per move)" : "🔍 Analyze This Game"}
              </button>
              {error && <p style={{ color: "#ff8080", fontSize: "0.75rem", marginTop: "10px" }}>⚠ {error}</p>}
            </div>
          )}

          {/* Results */}
          {analysis && s && (
            <>
              {/* Accuracy rings */}
              <div style={{ display: "flex", justifyContent: "center", gap: "32px", marginBottom: "22px" }}>
                <AccuracyRing value={s.accuracy_white} color="#e8e8f0" label="White" />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span style={{ fontSize: "0.6rem", color: config.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Accuracy</span>
                  <span style={{ fontSize: "1.6rem" }}>📊</span>
                </div>
                <AccuracyRing value={s.accuracy_black} color="#888" label="Black" />
              </div>

              {/* Per-side stats */}
              {(["White", "Black"] as const).map((side) => {
                const k = side.toLowerCase() as "white" | "black";
                return (
                  <div key={side} style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "0.7rem", color: config.textSecondary, marginBottom: "8px", fontWeight: 600 }}>
                      {side} — best streak: {side === "White" ? s.best_streak_white : s.best_streak_black} moves
                    </p>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(["Book","Brilliant","Great","Excellent","Good","Inaccuracy","Mistake","Blunder"] as MoveClassification[]).map((cls) => {
                        // Backend uses plural for the negative categories
                        const prefix: Record<string, string> = {
                          Blunder: "blunders", Mistake: "mistakes", Inaccuracy: "inaccuracies",
                          Good: "good", Excellent: "excellent", Great: "great",
                          Brilliant: "brilliant", Book: "book",
                        };
                        const key = `${prefix[cls]}_${k}` as keyof typeof s;
                        const count = (s[key] as number) ?? 0;
                        return <StatPill key={cls} count={count} cls={cls} />;
                      })}
                    </div>
                  </div>
                );
              })}

              {saved && <p style={{ fontSize: "0.68rem", color: "#4ADE80", textAlign: "center", margin: "6px 0" }}>✓ Saved to history</p>}

              {/* Move list */}
              <button
                onClick={() => setShowMoveList((v) => !v)}
                style={{ width: "100%", padding: "9px", borderRadius: "8px", background: `${config.accentPrimary}10`, border: `1px solid ${config.glassBorder}`, color: config.accentPrimary, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, marginTop: "10px" }}
              >
                {showMoveList ? "▲ Hide move list" : "▼ View move-by-move analysis"}
              </button>

              {showMoveList && (
                <div style={{ marginTop: "10px", border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "10px" }}>
                  <MoveList
                    moves={analysis.moves}
                    selectedPly={selectedPly}
                    isReplayMode
                    onMoveClick={handleMoveClick}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Insight popup */}
      <MoveInsightPopup
        move={insightMove}
        anchorRect={insightRect}
        onClose={() => { setInsightMove(null); setInsightRect(null); }}
      />
    </>
  );
}
