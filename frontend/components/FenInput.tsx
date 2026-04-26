import React, { useState } from "react";

interface FenInputProps {
  currentFen: string;
  onFenSubmit: (fen: string) => void;
  onReset: () => void;
}

const SAMPLE_POSITIONS = [
  {
    label: "Starting Position",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  {
    label: "Sicilian Defense",
    fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
  },
  {
    label: "Italian Game",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  },
  {
    label: "Endgame Study",
    fen: "8/5k2/3p4/1p1Pp2p/pP2Pp1P/P4P1K/8/8 b - - 0 1",
  },
];

export default function FenInput({ currentFen, onFenSubmit, onReset }: FenInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    const fen = inputValue.trim();
    if (fen) {
      onFenSubmit(fen);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="glass-panel p-4" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="flex items-center justify-between">
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(196, 154, 42, 0.6)",
          }}
        >
          Position (FEN)
        </p>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.68rem",
            color: "rgba(196, 154, 42, 0.5)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: "4px",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(196, 154, 42, 0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(196, 154, 42, 0.5)")}
        >
          {isExpanded ? "▲ Hide samples" : "▼ Sample positions"}
        </button>
      </div>

      {/* Current FEN display */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          color: "rgba(245, 240, 232, 0.35)",
          wordBreak: "break-all",
          padding: "6px 10px",
          background: "rgba(10, 8, 5, 0.5)",
          borderRadius: "4px",
          border: "1px solid rgba(139, 105, 20, 0.1)",
          lineHeight: 1.4,
        }}
      >
        {currentFen}
      </div>

      {/* FEN input */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          className="fen-input"
          placeholder="Paste FEN string here…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          style={{
            padding: "8px 14px",
            background: "rgba(139, 105, 20, 0.3)",
            border: "1px solid rgba(196, 154, 42, 0.3)",
            borderRadius: "6px",
            color: "rgba(196, 154, 42, 0.9)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.8rem",
            cursor: "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
        >
          Load
        </button>
        <button
          onClick={onReset}
          title="Reset to starting position"
          style={{
            padding: "8px 12px",
            background: "rgba(30, 20, 10, 0.5)",
            border: "1px solid rgba(139, 105, 20, 0.2)",
            borderRadius: "6px",
            color: "rgba(245, 240, 232, 0.4)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.8rem",
            cursor: "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
        >
          ↺
        </button>
      </div>

      {/* Sample positions */}
      {isExpanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {SAMPLE_POSITIONS.map((pos) => (
            <button
              key={pos.label}
              onClick={() => {
                onFenSubmit(pos.fen);
                setIsExpanded(false);
              }}
              style={{
                textAlign: "left",
                padding: "7px 12px",
                background: "rgba(10, 8, 5, 0.5)",
                border: "1px solid rgba(139, 105, 20, 0.1)",
                borderRadius: "5px",
                color: "rgba(245, 240, 232, 0.6)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.8rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139, 105, 20, 0.12)";
                e.currentTarget.style.color = "rgba(245, 240, 232, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(10, 8, 5, 0.5)";
                e.currentTarget.style.color = "rgba(245, 240, 232, 0.6)";
              }}
            >
              {pos.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
