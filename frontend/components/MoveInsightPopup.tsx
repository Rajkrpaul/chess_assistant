"use client";
import React, { useEffect, useRef } from "react";
import { MoveAnalysis, CLASSIFICATION_META } from "../services/api";
import { useTheme } from "../context/ThemeContext";

interface Props {
  move: MoveAnalysis | null;
  anchorRect: DOMRect | null;
  onClose: () => void;
}

export default function MoveInsightPopup({ move, anchorRect, onClose }: Props) {
  const { config } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!move) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [move, onClose]);

  if (!move) return null;

  const meta = CLASSIFICATION_META[move.classification];

  const formatEval = (v: number | null, mate: number | null): string => {
    if (mate !== null) return mate > 0 ? `#${mate}` : `#${Math.abs(mate)}`;
    if (v === null) return "—";
    const pawns = v / 100;
    return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
  };

  // Smart positioning: stay on screen
  const vpW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 800;
  const popupW = 260;
  const popupH = 200; // approx

  let left = anchorRect ? anchorRect.left : vpW / 2 - popupW / 2;
  let top = anchorRect ? anchorRect.bottom + 6 : vpH / 2 - popupH / 2;

  // Clamp to viewport
  if (left + popupW > vpW - 8) left = vpW - popupW - 8;
  if (left < 8) left = 8;
  if (top + popupH > vpH - 8) top = anchorRect ? anchorRect.top - popupH - 6 : vpH - popupH - 8;

  return (
    <>
      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Full-screen invisible layer to capture outside clicks */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1998 }} onClick={onClose} />

      <div
        ref={ref}
        style={{
          position: "fixed",
          left, top,
          width: popupW,
          zIndex: 1999,
          background: config.glassBg || "rgba(18,18,28,0.97)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${meta.color}55`,
          borderRadius: "12px",
          padding: "14px 16px",
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${meta.color}22`,
          fontFamily: "'DM Sans', sans-serif",
          animation: "popIn 0.15s ease",
          pointerEvents: "auto",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{
            fontSize: "0.95rem", fontWeight: 700, color: meta.color,
            background: `${meta.color}20`, padding: "2px 9px",
            borderRadius: "6px", border: `1px solid ${meta.color}40`,
            letterSpacing: "0.02em",
          }}>
            {move.move_san}
          </span>
          <span style={{ fontSize: "0.68rem", color: meta.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {meta.icon} {meta.label}
          </span>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "transparent", border: "none", color: config.textSecondary, cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: 0 }}
          >✕</button>
        </div>

        {/* Eval delta row */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {[
            { label: "Before", val: formatEval(move.eval_before, move.mate_before) },
            { label: "After",  val: formatEval(move.eval_after,  move.mate_after) },
            { label: "Loss",   val: move.centipawn_loss === 0 ? "0 cp" : `-${move.centipawn_loss} cp` },
          ].map(({ label, val }) => (
            <div key={label} style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "5px 4px" }}>
              <div style={{ fontSize: "0.55rem", color: config.textSecondary, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2px" }}>{label}</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: label === "Loss" && move.centipawn_loss > 0 ? meta.color : config.textPrimary }}>
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* Best move line (if different) */}
        {move.best_move_san && move.best_move_san !== move.move_san && (
          <div style={{
            background: "rgba(255,255,255,0.04)", borderRadius: "7px",
            padding: "6px 10px", marginBottom: "8px",
            border: `1px solid rgba(255,255,255,0.07)`,
          }}>
            <span style={{ fontSize: "0.6rem", color: config.textSecondary }}>Best was </span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4ADE80" }}>{move.best_move_san}</span>
            {move.pv_line && move.pv_line.length > 0 && (
              <span style={{ fontSize: "0.68rem", color: config.textSecondary }}>
                {" · "}{move.pv_line.slice(0, 3).join(" ")}
                {move.pv_line.length > 3 ? "…" : ""}
              </span>
            )}
          </div>
        )}

        {/* Insight text */}
        {move.insight && (
          <p style={{ fontSize: "0.72rem", color: config.textSecondary, lineHeight: 1.55, margin: 0 }}>
            {move.insight}
          </p>
        )}
      </div>
    </>
  );
}
