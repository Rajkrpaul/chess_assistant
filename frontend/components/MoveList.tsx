"use client";
import React, { useRef, useEffect } from "react";
import { MoveAnalysis, CLASSIFICATION_META, MoveClassification } from "../services/api";
import { useTheme } from "../context/ThemeContext";

interface Props {
  moves: MoveAnalysis[];
  selectedPly: number | null;
  /** Called when a move chip is clicked — passes the move and its bounding rect for the popup */
  onMoveClick: (move: MoveAnalysis, rect: DOMRect) => void;
  isReplayMode?: boolean;
}

function ClassificationBadge({ cls }: { cls: MoveClassification }) {
  const meta = CLASSIFICATION_META[cls];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: "20px", height: "16px", borderRadius: "3px", padding: "0 3px",
        background: `${meta.color}25`, border: `1px solid ${meta.color}55`,
        color: meta.color, fontSize: "0.58rem", fontWeight: 800,
        fontFamily: "'DM Sans', sans-serif", flexShrink: 0, letterSpacing: "0.02em",
      }}
    >
      {meta.icon}
    </span>
  );
}

export default function MoveList({ moves, selectedPly, onMoveClick, isReplayMode }: Props) {
  const { config } = useTheme();
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedPly]);

  // Group into pairs: [[white, black?], ...]
  const rows: [MoveAnalysis, MoveAnalysis | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push([moves[i], moves[i + 1]]);
  }

  if (moves.length === 0) {
    return (
      <div style={{ padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.74rem", color: config.textSecondary, textAlign: "center" }}>
        No moves yet.
      </div>
    );
  }

  const cellStyle = (ply: number, cls: MoveClassification): React.CSSProperties => {
    const isSelected = selectedPly === ply;
    const meta = CLASSIFICATION_META[cls];
    return {
      display: "flex", alignItems: "center", gap: "5px",
      padding: "5px 7px", borderRadius: "6px", cursor: "pointer",
      background: isSelected ? `${meta.color}18` : "transparent",
      border: `1px solid ${isSelected ? meta.color + "55" : "transparent"}`,
      transition: "background 0.12s, border-color 0.12s",
      fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem",
      color: isSelected ? config.textPrimary : config.textSecondary,
      fontWeight: isSelected ? 600 : 400,
      width: "100%", textAlign: "left" as const,
      outline: "none",
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px", maxHeight: "340px", overflowY: "auto", padding: "2px" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr", gap: "4px", paddingBottom: "6px", borderBottom: `1px solid ${config.glassBorder}`, marginBottom: "4px" }}>
        {["#", "White", "Black"].map((h) => (
          <span key={h} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.6rem", color: config.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</span>
        ))}
      </div>

      {rows.map(([white, black], rowIdx) => (
        <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr", gap: "3px", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.68rem", color: config.textSecondary, textAlign: "right", paddingRight: "4px" }}>
            {rowIdx + 1}.
          </span>

          <button
            ref={selectedPly === white.ply ? selectedRef : undefined}
            onClick={(e) => onMoveClick(white, (e.currentTarget as HTMLElement).getBoundingClientRect())}
            style={cellStyle(white.ply, white.classification)}
          >
            <ClassificationBadge cls={white.classification} />
            <span>{white.move_san}</span>
          </button>

          {black ? (
            <button
              ref={selectedPly === black.ply ? selectedRef : undefined}
              onClick={(e) => onMoveClick(black, (e.currentTarget as HTMLElement).getBoundingClientRect())}
              style={cellStyle(black.ply, black.classification)}
            >
              <ClassificationBadge cls={black.classification} />
              <span>{black.move_san}</span>
            </button>
          ) : <div />}
        </div>
      ))}

      {isReplayMode && (
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.62rem", color: config.textSecondary, textAlign: "center", marginTop: "6px", opacity: 0.65 }}>
          👁 Click a move for insight
        </p>
      )}
    </div>
  );
}
