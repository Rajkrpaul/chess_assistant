"use client";

import React, { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

interface EvaluationBarProps {
  evaluation: string;
  mateIn: number | null;
  flipped?: boolean;
}

export default function EvaluationBar({ evaluation, mateIn, flipped = false }: EvaluationBarProps) {
  const { config } = useTheme();

  const whitePercent = useMemo(() => {
    if (mateIn !== null) {
      return !evaluation.startsWith("#-") ? 95 : 5;
    }
    try {
      const val = parseFloat(evaluation.replace("+", ""));
      if (isNaN(val)) return 50;
      const clamped = Math.max(-6, Math.min(6, val));
      return 50 + (clamped / 6) * 45;
    } catch {
      return 50;
    }
  }, [evaluation, mateIn]);

  const blackPercent = 100 - whitePercent;

  const evalDisplay = useMemo(() => {
    if (mateIn !== null) return `M${Math.abs(mateIn)}`;
    const val = parseFloat(evaluation.replace("+", ""));
    if (isNaN(val)) return "0.0";
    return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  }, [evaluation, mateIn]);

  const isMate = mateIn !== null;
  const numVal = parseFloat(evaluation.replace("+", ""));
  const evalColor = isMate
    ? "#ff8080"
    : numVal > 0.3 ? "#7fb85a"
    : numVal < -0.3 ? "#ff8080"
    : config.accentPrimary;

  const displayTop = flipped ? whitePercent : blackPercent;
  const displayBottom = flipped ? blackPercent : whitePercent;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          color: evalColor,
          letterSpacing: "0.04em",
          minWidth: "36px",
          textAlign: "center",
          transition: "color 0.3s ease",
          minHeight: "14px",
        }}
      >
        {flipped ? evalDisplay : ""}
      </div>

      <div
        style={{
          height: "360px",
          width: "20px",
          borderRadius: "4px",
          overflow: "hidden",
          background: config.evalBarBlack,
          boxShadow: `0 0 12px rgba(0,0,0,0.5), inset 0 0 4px rgba(0,0,0,0.3)`,
          position: "relative",
          border: `1px solid ${config.glassBorder}`,
        }}
        title={`Evaluation: ${evalDisplay}`}
      >
        <div
          style={{
            height: `${displayTop}%`,
            width: "100%",
            background: flipped ? config.evalBarWhite : config.evalBarBlack,
            transition: "height 0.65s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        <div
          style={{
            height: `${displayBottom}%`,
            width: "100%",
            background: flipped ? config.evalBarBlack : config.evalBarWhite,
            transition: "height 0.65s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "1px",
            background: config.accentPrimary,
            opacity: 0.25,
            transform: "translateY(-50%)",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          color: evalColor,
          letterSpacing: "0.04em",
          minWidth: "36px",
          textAlign: "center",
          transition: "color 0.3s ease",
          minHeight: "14px",
        }}
      >
        {!flipped ? evalDisplay : ""}
      </div>
    </div>
  );
}