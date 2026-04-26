import React from "react";
import { useTheme } from "../context/ThemeContext";
import { ChallengeValidation } from "../services/api";

interface ResultPanelProps {
  validation: ChallengeValidation | null;
  onRetry: () => void;
  onNext: () => void;
  status: "playing" | "success" | "failed" | "loading";
}

export default function ResultPanel({ validation, onRetry, onNext, status }: ResultPanelProps) {
  const { config } = useTheme();

  if (status === "playing" || status === "loading") return null;

  return (
    <div style={{ background: status === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)", border: `1px solid ${status === "success" ? "#22C55E" : "#EF4444"}`, borderRadius: "10px", padding: "20px", marginTop: "16px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.2rem", color: status === "success" ? "#22C55E" : "#EF4444" }}>
        {status === "success" ? "🎉 Success!" : "❌ Not quite"}
      </h3>
      
      {validation && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.95rem", color: config.textPrimary }}>
          <div><strong>Classification:</strong> {validation.classification}</div>
          <div style={{ fontStyle: "italic", color: config.textSecondary }}>"{validation.message}"</div>
          
          {status === "failed" && (
            <div><strong>Best Move:</strong> {validation.best_move}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        {status === "failed" && (
          <button onClick={onRetry} style={{ padding: "8px 16px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
            Try Again
          </button>
        )}
        <button onClick={onNext} style={{ padding: "8px 16px", background: "#22C55E", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
          Next Challenge ➔
        </button>
      </div>
    </div>
  );
}
