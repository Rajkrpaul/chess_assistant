import React, { useState, useEffect, useRef } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { getChallenge, Challenge } from "../services/api";
import { getEvaluation } from "../services/stockfishService";

const BOARD_WIDTH = 500;

export default function ChallengeMode() {
  const { config } = useTheme();
  const { settings } = useSettings();

  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [game, setGame] = useState(() => new Chess());
  const [status, setStatus] = useState<"loading" | "playing" | "success" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);

  // Styling state
  const [highlightSquares, setHighlightSquares] = useState<Record<string, any>>({});
  const [legalMoveSquares, setLegalMoveSquares] = useState<Record<string, any>>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const loadChallenge = async (diff: "easy" | "medium" | "hard") => {
    setStatus("loading");
    setError(null);
    setHintIndex(0);
    setHighlightSquares({});
    setLegalMoveSquares({});
    setSelectedSquare(null);
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

  const parseEval = (evalStr: string) => {
    if (evalStr.startsWith("#")) {
      const moves = parseInt(evalStr.substring(1), 10);
      return moves > 0 ? 1000 - moves : -1000 - moves;
    }
    return parseFloat(evalStr);
  };

  const verifyMove = async (newGame: Chess, from: string, to: string) => {
    if (!challenge) return;
    setStatus("loading");
    try {
      const res = await getEvaluation(newGame.fen(), settings.depth, settings.skillLevel);
      if (!res) throw new Error("Could not evaluate move");

      const originalEval = parseEval(challenge.evaluation);
      
      let newEval = 0;
      if (res.mateIn !== null) {
        newEval = res.mateIn > 0 ? 1000 - res.mateIn : -1000 - res.mateIn;
      } else if (res.evaluation !== null) {
        newEval = res.evaluation / 100;
      }

      // Convert to perspective of the player who made the move (the turn just changed, so newGame.turn() is the opponent)
      // Wait, original evaluation is from the perspective of the player who was to move in `challenge.fen`.
      // Since it's a puzzle, the player plays the side to move.
      // So if White to move, originalEval > 0.
      const isWhitePuzzle = new Chess(challenge.fen).turn() === "w";
      
      const threshold = difficulty === "easy" ? 0.5 : difficulty === "medium" ? 0.3 : 0.1;
      
      let isSuccess = false;
      if (isWhitePuzzle) {
        // White made a move, eval shouldn't drop below originalEval - threshold
        isSuccess = newEval >= originalEval - threshold;
      } else {
        // Black made a move, eval shouldn't rise above originalEval + threshold
        isSuccess = newEval <= originalEval + threshold;
      }

      // If they found the exact best move, always success
      const playedUci = from + to;
      const isExactMatch = playedUci === challenge.best_move.substring(0, 4);

      if (isSuccess || isExactMatch) {
        setStatus("success");
      } else {
        setStatus("failed");
      }
    } catch (e: any) {
      setError(e.message || "Error evaluating move");
      setStatus("failed");
    }
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (status !== "playing") return false;
    
    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1].toLowerCase() ?? "q"
    });

    if (move === null) return false;
    
    setGame(gameCopy);
    setLegalMoveSquares({});
    setSelectedSquare(null);
    verifyMove(gameCopy, sourceSquare, targetSquare);
    return true;
  };

  const onSquareClick = (square: string) => {
    if (status !== "playing") return;
    if (selectedSquare === null) {
      const piece = game.get(square as Square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        showLegalMoves(square);
      }
      return;
    }
    
    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: selectedSquare,
      to: square,
      promotion: "q"
    });

    if (move) {
      setGame(gameCopy);
      setLegalMoveSquares({});
      setSelectedSquare(null);
      verifyMove(gameCopy, selectedSquare, square);
    } else {
      const piece = game.get(square as Square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        showLegalMoves(square);
      } else {
        setSelectedSquare(null);
        setLegalMoveSquares({});
      }
    }
  };

  const showLegalMoves = (square: string) => {
    const moves = game.moves({ square: square as Square, verbose: true });
    if (moves.length === 0) return;
    const newSquares: Record<string, any> = {};
    newSquares[square] = { background: `${config.accentPrimary}66`, borderRadius: "4px" };
    moves.forEach((m) => {
      newSquares[m.to] = {
        background: `radial-gradient(circle, ${config.accentPrimary}33 30%, transparent 40%)`,
        borderRadius: "50%",
      };
    });
    setLegalMoveSquares(newSquares);
  };

  const showNextHint = () => {
    if (challenge && hintIndex < challenge.hints.length) {
      setHintIndex(i => i + 1);
    }
  };

  const resetChallenge = () => {
    if (challenge) {
      setGame(new Chess(challenge.fen));
      setStatus("playing");
      setHintIndex(0);
      setHighlightSquares({});
      setLegalMoveSquares({});
      setSelectedSquare(null);
    }
  };

  const mergedSquareStyles = { ...highlightSquares, ...legalMoveSquares };
  const isWhitePuzzle = challenge ? new Chess(challenge.fen).turn() === "w" : true;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: config.textPrimary, margin: 0 }}>⚔️ Challenges Mode</h2>
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

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* Left Col: Board */}
        <div style={{ flex: "1 1 500px", maxWidth: BOARD_WIDTH, position: "relative" }}>
          <div style={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 48px rgba(0,0,0,0.4)" }}>
            <Chessboard
              position={game.fen()}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              customSquareStyles={mergedSquareStyles}
              boardWidth={BOARD_WIDTH}
              customDarkSquareStyle={{ backgroundColor: config.boardDark }}
              customLightSquareStyle={{ backgroundColor: config.boardLight }}
              boardOrientation={isWhitePuzzle ? "white" : "black"}
            />
          </div>
          
          {/* Overlay state */}
          {status === "loading" && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.5rem", fontWeight: "bold", zIndex: 10 }}>
              Evaluating...
            </div>
          )}
          {status === "success" && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(34, 197, 94, 0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <div style={{ fontSize: "4rem" }}>🎉</div>
              <h3 style={{ color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.8)", margin: "10px 0" }}>Great Move!</h3>
              <button onClick={() => loadChallenge(difficulty)} style={{ padding: "10px 20px", background: "#22C55E", color: "#fff", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: 600, cursor: "pointer", marginTop: "10px", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.4)" }}>
                Next Puzzle ➔
              </button>
            </div>
          )}
          {status === "failed" && !error && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(239, 68, 68, 0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <div style={{ fontSize: "4rem" }}>❌</div>
              <h3 style={{ color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.8)", margin: "10px 0" }}>Not quite right</h3>
              <button onClick={resetChallenge} style={{ padding: "10px 20px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: 600, cursor: "pointer", marginTop: "10px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)" }}>
                Try Again ↺
              </button>
            </div>
          )}
        </div>

        {/* Right Col: Info */}
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.2rem", color: config.textPrimary }}>Objective</h3>
            <div style={{ fontSize: "0.95rem", color: config.textSecondary, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.2rem" }}>{isWhitePuzzle ? "♙" : "♟"}</span>
              <strong>{isWhitePuzzle ? "White" : "Black"} to move.</strong> Find the best continuation.
            </div>

            {challenge && (
              <div style={{ background: `${config.accentPrimary}15`, border: `1px solid ${config.accentPrimary}33`, borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px", color: config.accentPrimary, marginBottom: "4px" }}>Theme</div>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: config.textPrimary }}>{challenge.theme}</div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "1rem", color: config.textPrimary }}>Hints</h4>
              <span style={{ fontSize: "0.75rem", color: config.textSecondary }}>{hintIndex} / {challenge?.hints.length || 0}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {challenge && challenge.hints.slice(0, hintIndex).map((hint, i) => (
                <div key={i} style={{ background: `${config.textSecondary}15`, padding: "10px 12px", borderRadius: "8px", fontSize: "0.85rem", color: config.textPrimary, borderLeft: `3px solid ${config.accentSecondary}` }}>
                  💡 {hint}
                </div>
              ))}
              
              {challenge && hintIndex < challenge.hints.length && (
                <button onClick={showNextHint} style={{ padding: "10px", background: "transparent", border: `1px dashed ${config.glassBorder}`, borderRadius: "8px", color: config.textSecondary, cursor: "pointer", fontSize: "0.85rem", marginTop: "8px", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = `${config.textSecondary}15`} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  + Reveal Next Hint
                </button>
              )}
            </div>

          </div>

          <div style={{ display: "flex", gap: "8px" }}>
             <button onClick={() => loadChallenge(difficulty)} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${config.glassBorder}`, borderRadius: "8px", color: config.textSecondary, cursor: "pointer", fontSize: "0.9rem" }}>
               Skip Puzzle ⏭
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
