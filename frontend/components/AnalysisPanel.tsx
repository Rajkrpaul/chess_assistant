import React from "react";
import { AnalyzeResponse } from "../services/api";

interface AnalysisPanelProps {
  result: AnalyzeResponse | null;
  isLoading: boolean;
  error: string | null;
}

function EvalBadge({ evaluation }: { evaluation: string }) {
  const val = parseFloat(evaluation.replace("+", ""));
  const isPositive = !isNaN(val) ? val > 0 : evaluation.startsWith("#") && !evaluation.startsWith("#-");
  const isMate = evaluation.startsWith("#");

  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.9rem",
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: "4px",
        background: isMate
          ? "rgba(180, 50, 50, 0.25)"
          : isPositive
          ? "rgba(45, 80, 22, 0.3)"
          : "rgba(30, 20, 10, 0.5)",
        border: isMate
          ? "1px solid rgba(220, 80, 80, 0.4)"
          : isPositive
          ? "1px solid rgba(74, 122, 40, 0.4)"
          : "1px solid rgba(139, 105, 20, 0.2)",
        color: isMate ? "#ff8080" : isPositive ? "#7fb85a" : "#cc8844",
      }}
    >
      {evaluation}
    </span>
  );
}

export default function AnalysisPanel({ result, isLoading, error }: AnalysisPanelProps) {
  if (error) {
    return (
      <div
        className="glass-panel p-5 animate-fade-up"
        style={{ borderColor: "rgba(200, 60, 60, 0.3)" }}
      >
        <div className="flex items-start gap-3">
          <div
            style={{
              fontSize: "1.2rem",
              marginTop: "1px",
              flexShrink: 0,
            }}
          >
            ⚠️
          </div>
          <div>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                color: "#ff8080",
                marginBottom: "4px",
                fontSize: "0.9rem",
              }}
            >
              Analysis Failed
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                color: "rgba(245, 240, 232, 0.6)",
                fontSize: "0.82rem",
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center gap-4" style={{ minHeight: "160px" }}>
        <div className="chess-spinner" />
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            color: "rgba(196, 154, 42, 0.7)",
            fontSize: "0.85rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Analyzing…
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="glass-panel p-6 flex flex-col items-center justify-center gap-3"
        style={{ minHeight: "160px" }}
      >
        <div style={{ fontSize: "2.5rem", opacity: 0.2 }}>♟</div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            color: "rgba(245, 240, 232, 0.3)",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          Drag pieces to set your position,
          <br />
          then press <strong>Analyze</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Best Move */}
      <div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(196, 154, 42, 0.6)",
            marginBottom: "8px",
          }}
        >
          Best Move
        </p>
        <div className="flex items-center gap-3">
          <span className="move-badge" style={{ fontSize: "1.2rem" }}>
            {result.best_move}
          </span>
          <EvalBadge evaluation={result.evaluation} />
          {result.mate_in && (
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.75rem",
                color: "#ff8080",
                background: "rgba(180, 50, 50, 0.15)",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(200, 60, 60, 0.2)",
              }}
            >
              Mate in {result.mate_in}
            </span>
          )}
        </div>
      </div>

      <div className="gold-divider" />

      {/* Top Moves */}
      {result.top_moves && result.top_moves.length > 0 && (
        <div>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(196, 154, 42, 0.6)",
              marginBottom: "8px",
            }}
          >
            Top Candidates
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {result.top_moves.map((mv, idx) => (
              <div
                key={idx}
                className={`top-move-item ${idx === 0 ? "best" : ""}`}
              >
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.7rem",
                    color: "rgba(196, 154, 42, 0.5)",
                    width: "16px",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}.
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.82rem",
                    color: idx === 0 ? "rgba(245, 240, 232, 0.9)" : "rgba(245, 240, 232, 0.55)",
                    flex: 1,
                  }}
                >
                  {mv.move}
                </span>
                <EvalBadge evaluation={mv.evaluation} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gold-divider" />

      {/* AI Explanation */}
      <div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(196, 154, 42, 0.6)",
            marginBottom: "10px",
          }}
        >
          ✦ Strategic Insight
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.88rem",
            lineHeight: 1.75,
            color: "rgba(245, 240, 232, 0.82)",
            fontStyle: "italic",
          }}
        >
          {result.explanation}
        </p>
      </div>
    </div>
  );
}