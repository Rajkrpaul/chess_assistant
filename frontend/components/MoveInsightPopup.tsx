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
          width: popupW + 40,
          zIndex: 1999,
          background: config.glassBg || "rgba(18,18,28,0.97)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${meta.color}55`,
          borderRadius: "12px",
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${meta.color}22`,
          fontFamily: "'DM Sans', sans-serif",
          animation: "popIn 0.15s ease",
          pointerEvents: "auto",
          overflow: "hidden"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", padding: "14px 16px" }}>
          {/* Kasparov image for blunders/brilliant/mistakes */}
          {(move.classification === "Blunder" || move.classification === "Mistake" || move.classification === "Brilliant") && (
            <div style={{ marginRight: "12px", flexShrink: 0 }}>
              <img 
                src="/kasparov_coach.png" 
                alt="Kasparov" 
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid ${meta.color}`,
                  boxShadow: `0 0 10px ${meta.color}44`
                }} 
              />
            </div>
          )}
          
          <div style={{ flex: 1 }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.85rem", color: meta.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span style={{ 
                  background: meta.color, color: "#000", width: "18px", height: "18px", 
                  borderRadius: "50%", display: "inline-flex", alignItems: "center", 
                  justifyContent: "center", fontSize: "0.6rem", marginRight: "4px" 
                }}>
                  {meta.icon}
                </span>
                {meta.label}
              </span>
              <button
                onClick={onClose}
                style={{ marginLeft: "auto", background: "transparent", border: "none", color: config.textSecondary, cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: 0 }}
              >✕</button>
            </div>
            
            <p style={{ fontSize: "0.8rem", color: config.textPrimary, margin: "0 0 8px 0" }}>
              {move.insight || (move.classification === "Blunder" ? "That move loses a significant advantage." : move.classification === "Mistake" ? "That move loses a pawn." : "Excellent move!")}
            </p>

            {/* Action buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button onClick={onClose} style={{
                background: "transparent",
                border: `1px solid ${meta.color}55`,
                color: meta.color,
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                cursor: "pointer"
              }}>
                {move.classification === "Blunder" || move.classification === "Mistake" ? "Show Me" : "Explain"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
