import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { getChallengeHint } from "../services/api";

interface HintBoxProps {
  puzzleId: string;
}

export default function HintBox({ puzzleId }: HintBoxProps) {
  const { config } = useTheme();
  const [hints, setHints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const requestHint = async () => {
    setLoading(true);
    try {
      const res = await getChallengeHint(puzzleId, hints.length);
      if (res && res.hint && !hints.includes(res.hint)) {
        setHints([...hints, res.hint]);
      }
    } catch (e) {
      console.error("Failed to load hint", e);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
      {hints.map((hint, i) => (
        <div key={i} style={{ background: `${config.textSecondary}15`, padding: "10px 12px", borderRadius: "8px", fontSize: "0.85rem", color: config.textPrimary, borderLeft: `3px solid ${config.accentSecondary}` }}>
          💡 {hint}
        </div>
      ))}
      
      <button 
        onClick={requestHint} 
        disabled={loading}
        style={{ padding: "10px", background: "transparent", border: `1px dashed ${config.glassBorder}`, borderRadius: "8px", color: config.textSecondary, cursor: loading ? "wait" : "pointer", fontSize: "0.85rem", marginTop: "8px", transition: "all 0.2s" }} 
        onMouseOver={e => e.currentTarget.style.background = `${config.textSecondary}15`} 
        onMouseOut={e => e.currentTarget.style.background = "transparent"}
      >
        {loading ? "Loading..." : "+ Reveal Next Hint"}
      </button>
    </div>
  );
}
