import React, { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { useTheme } from "../components/../context/ThemeContext";
import { getChallenge, validateChallenge, Challenge, ChallengeValidation } from "../services/api";
import ChallengeBoard from "../components/ChallengeBoard";
import ResultPanel from "../components/ResultPanel";
import HintBox from "../components/HintBox";
import { useRouter } from "next/router";

export default function ChallengesPage() {
  const { config } = useTheme();
  const router = useRouter();

  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [game, setGame] = useState(() => new Chess());
  const [status, setStatus] = useState<"loading" | "playing" | "success" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);
  
  const [validationResult, setValidationResult] = useState<ChallengeValidation | null>(null);
  const [attempts, setAttempts] = useState(0);

  const loadChallenge = async (diff: "easy" | "medium" | "hard") => {
    setStatus("loading");
    setError(null);
    setValidationResult(null);
    setAttempts(0);
    try {
      const c = await getChallenge(diff);
      if (c) {
        setChallenge(c);
        const newGame = new Chess(c.fen);
        setGame(newGame);
        setStatus("playing");
      } else {
        throw new Error("No challenge received");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load challenge");
      setStatus("failed");
    }
  };

  useEffect(() => {
    loadChallenge(difficulty);
  }, [difficulty]);

  const onPieceDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (status !== "playing") return false;
    
    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1]?.toLowerCase() ?? "q"
    });

    if (move === null) return false;
    
    setGame(gameCopy);
    handleValidation(gameCopy.fen(), sourceSquare + targetSquare + (move.promotion || ""));
    return true;
  };

  const handleValidation = async (fenAfter: string, moveUci: string) => {
    if (!challenge) return;
    setStatus("loading");
    const currentAttempts = attempts + 1;
    setAttempts(currentAttempts);

    try {
      // Validate move with the backend
      const res = await validateChallenge(challenge.fen, moveUci, difficulty, currentAttempts);
      setValidationResult(res);
      
      if (res.correct) {
        setStatus("success");
      } else {
        setStatus("failed");
      }
    } catch (e: any) {
      setError(e.message || "Error validating move");
      setStatus("failed");
    }
  };

  const retryChallenge = () => {
    if (challenge) {
      setGame(new Chess(challenge.fen));
      setStatus("playing");
      setValidationResult(null);
    }
  };

  const isWhitePuzzle = challenge ? new Chess(challenge.fen).turn() === "w" : true;

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", background: config.background, color: config.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar minimal view for back button */}
      <div style={{ width: "80px", borderRight: `1px solid ${config.glassBorder}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", background: config.glassBg, zIndex: 10 }}>
        <button onClick={() => router.push("/")} style={{ background: "transparent", border: "none", fontSize: "1.5rem", cursor: "pointer", color: config.textSecondary }} title="Back to Dashboard">
          🔙
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 700, margin: 0 }}>⚔️ Challenges Mode</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["easy", "medium", "hard"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    padding: "6px 12px", borderRadius: "8px", textTransform: "capitalize",
                    border: `1px solid ${difficulty === d ? config.accentPrimary : config.glassBorder}`,
                    background: difficulty === d ? `${config.accentPrimary}22` : "transparent",
                    color: difficulty === d ? config.accentPrimary : config.textSecondary,
                    cursor: "pointer", fontSize: "0.85rem"
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ color: "#EF4444", padding: "16px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", marginBottom: "16px" }}>{error}</div>}

          <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap" }}>
            
            {/* Left Col: Board */}
            <div style={{ flex: "1 1 500px", maxWidth: 500 }}>
              <ChallengeBoard 
                fen={game.fen()} 
                isWhitePuzzle={isWhitePuzzle} 
                onPieceDrop={onPieceDrop} 
                status={status} 
              />
            </div>

            {/* Right Col: Info */}
            <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.2rem", color: config.textPrimary }}>Objective</h3>
                <div style={{ fontSize: "1rem", color: config.textSecondary, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>{isWhitePuzzle ? "♙" : "♟"}</span>
                  <strong>{isWhitePuzzle ? "White" : "Black"} to move.</strong> Find the best continuation.
                </div>

                {challenge && (
                  <div style={{ background: `${config.accentPrimary}15`, border: `1px solid ${config.accentPrimary}33`, borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: config.accentPrimary, marginBottom: "4px" }}>Theme</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600, color: config.textPrimary, textTransform: "capitalize" }}>{challenge.theme}</div>
                  </div>
                )}

                <ResultPanel 
                  validation={validationResult} 
                  status={status} 
                  onRetry={retryChallenge} 
                  onNext={() => loadChallenge(difficulty)} 
                />

                {status === "playing" && challenge && (
                  <HintBox puzzleId={challenge.id} />
                )}

              </div>

              {status === "playing" && (
                <button onClick={() => loadChallenge(difficulty)} style={{ width: "100%", padding: "12px", background: "transparent", border: `1px solid ${config.glassBorder}`, borderRadius: "8px", color: config.textSecondary, cursor: "pointer", fontSize: "0.95rem" }}>
                  Skip Puzzle ⏭
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
