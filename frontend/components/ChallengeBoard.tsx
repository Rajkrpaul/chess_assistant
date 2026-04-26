import React from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTheme } from "../context/ThemeContext";

interface ChallengeBoardProps {
  fen: string;
  isWhitePuzzle: boolean;
  onPieceDrop: (source: string, target: string, piece: string) => boolean;
  status: "loading" | "playing" | "success" | "failed";
}

export default function ChallengeBoard({ fen, isWhitePuzzle, onPieceDrop, status }: ChallengeBoardProps) {
  const { config } = useTheme();

  return (
    <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 48px rgba(0,0,0,0.4)" }}>
      <Chessboard
        position={fen}
        onPieceDrop={onPieceDrop}
        boardWidth={500}
        customDarkSquareStyle={{ backgroundColor: config.boardDark }}
        customLightSquareStyle={{ backgroundColor: config.boardLight }}
        boardOrientation={isWhitePuzzle ? "white" : "black"}
      />
      
      {status === "loading" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.5rem", fontWeight: "bold", zIndex: 10 }}>
          Evaluating...
        </div>
      )}
    </div>
  );
}
