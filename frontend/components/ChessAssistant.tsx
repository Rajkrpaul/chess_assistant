"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useRouter } from "next/router";

import FenInput from "./FenInput";
import MoveOverlay from "./MoveOverlay";
import MoveList from "./MoveList";
import PostGameReport from "./PostGameReport";
import HistoryPanel from "./HistoryPanel";
import SettingsPanel from "./SettingsPanel";
import SavedPositionsPanel, { SavedPosition } from "./SavedPositionsPanel";
import ChallengeMode from "./ChallengeMode";
import { useTheme, THEMES, Theme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import {
  getEvaluation,
  cancelEvaluation,
  pickMoveForDifficulty,
  Difficulty,
  StockfishEvalResult,
} from "../services/stockfishService";
import { MoveAnalysis, analyzeMoveContext } from "../services/api";
import MoveInsightPopup from "./MoveInsightPopup";

const BOARD_WIDTH = 480;
const HINT_IDLE_MS = 12_000;

type GameMode = "analysis" | "play";
type PlayerColor = "white" | "black";

function uciToSquares(uci: string): { from: string; to: string } | null {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

function toAnalyzeResponse(result: StockfishEvalResult) {
  const cp = result.evaluation;
  let evalStr = "0.0";
  if (result.mateIn !== null) {
    evalStr = `#${result.mateIn}`;
  } else if (cp !== null) {
    const pawns = cp / 100;
    evalStr = pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
  }
  const topMoves = [];
  if (result.bestMove) topMoves.push({ move: result.bestMove, evaluation: evalStr });
  if (result.secondBestMove) topMoves.push({ move: result.secondBestMove, evaluation: "?" });

  const sourceLabel =
    result.source === "stockfish"
      ? `Stockfish engine · depth ${result.depth}`
      : "No eval available";

  return {
    best_move: result.bestMove ?? "",
    evaluation: evalStr,
    explanation: sourceLabel,
    top_moves: topMoves,
    mate_in: result.mateIn,
  };
}

const PIECE_KEYS = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"] as const;
type PieceKey = typeof PIECE_KEYS[number];

const WIKIMEDIA = "https://upload.wikimedia.org/wikipedia/commons";
type PieceUrls = Record<PieceKey, string>;

const CLASSIC_PIECES: PieceUrls = {
  wK: `${WIKIMEDIA}/4/42/Chess_klt45.svg`,
  wQ: `${WIKIMEDIA}/1/15/Chess_qlt45.svg`,
  wR: `${WIKIMEDIA}/7/72/Chess_rlt45.svg`,
  wB: `${WIKIMEDIA}/b/b1/Chess_blt45.svg`,
  wN: `${WIKIMEDIA}/7/70/Chess_nlt45.svg`,
  wP: `${WIKIMEDIA}/4/45/Chess_plt45.svg`,
  bK: `${WIKIMEDIA}/f/f0/Chess_kdt45.svg`,
  bQ: `${WIKIMEDIA}/4/47/Chess_qdt45.svg`,
  bR: `${WIKIMEDIA}/f/ff/Chess_rdt45.svg`,
  bB: `${WIKIMEDIA}/9/98/Chess_bdt45.svg`,
  bN: `${WIKIMEDIA}/e/ef/Chess_ndt45.svg`,
  bP: `${WIKIMEDIA}/c/c7/Chess_pdt45.svg`,
};

const ANCIENT_FILTER = "sepia(0.8) saturate(1.4) hue-rotate(10deg) contrast(1.1)";

function buildCustomPieces(
  theme: Theme
): Record<string, (props: { squareWidth: number }) => JSX.Element> | undefined {
  if (theme === "modern") return undefined;

  const urls = CLASSIC_PIECES;
  const imgFilter = theme === "ancient" ? ANCIENT_FILTER : undefined;

  const pieces: Record<string, (props: { squareWidth: number }) => JSX.Element> = {};

  for (const key of PIECE_KEYS) {
    const url = urls[key];
    pieces[key] = ({ squareWidth }) => (
      <img
        src={url}
        alt={key}
        width={squareWidth}
        height={squareWidth}
        style={{
          userSelect: "none",
          pointerEvents: "none",
          filter: imgFilter,
        }}
      />
    );
  }

  return pieces;
}

export default function ChessAssistant() {
  const router = useRouter();
  const { theme, config, setTheme, isLightMode, toggleLightMode } = useTheme();
  const { settings } = useSettings();
  const [game, setGame] = useState(() => new Chess());
  const [result, setResult] = useState<ReturnType<typeof toAnalyzeResponse> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<Record<string, React.CSSProperties>>({});
  const [arrowKey, setArrowKey] = useState(0);

  const [mode, setMode] = useState<GameMode>("analysis");
  const [activeTab, setActiveTab] = useState<"Analysis" | "Play vs Computer" | "History" | "Saved Positions" | "Settings">("Analysis");
  const [playerColor, setPlayerColor] = useState<PlayerColor>("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [autoAnalysis, setAutoAnalysis] = useState<boolean>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("autoAnalysis") === "true";
    return false;
  });

  const [stockfishAssist, setStockfishAssist] = useState<boolean>(true);

  const [hintPrompt, setHintPrompt] = useState(false);
  const [hintActive, setHintActive] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvalRef = useRef<StockfishEvalResult | null>(null);
  const plyCountRef = useRef(0);
  const sanHistoryRef = useRef<string[]>([]);

  const [moveHistory, setMoveHistory] = useState<MoveAnalysis[]>([]);
  const [replayPly, setReplayPly] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [insightMove, setInsightMove] = useState<MoveAnalysis | null>(null);
  const [insightRect, setInsightRect] = useState<DOMRect | null>(null);
  const [resignedResult, setResignedResult] = useState<string | null>(null);

  const customPieces = useMemo(() => buildCustomPieces(theme), [theme]);

  useEffect(() => {
    localStorage.setItem("autoAnalysis", String(autoAnalysis));
  }, [autoAnalysis]);

  useEffect(() => {
    if (game.isGameOver() && game.history().length > 0) {
      const timer = setTimeout(() => setShowReport(true), 800);
      return () => clearTimeout(timer);
    }
  }, [game]);

  const handleSavePosition = () => {
    const title = prompt("Enter a title for this position:");
    if (!title) return;
    const category = prompt("Enter a category (e.g., Opening Trap, Endgame):", "Custom");
    const newPos: SavedPosition = {
      id: "custom-" + Date.now(),
      title,
      fen: game.fen(),
      category: category || "Custom",
      difficulty: "Unrated",
      favorite: false,
      timestamp: Date.now()
    };
    const saved = localStorage.getItem("chessSavedPositions");
    const positions = saved ? JSON.parse(saved) : [];
    localStorage.setItem("chessSavedPositions", JSON.stringify([...positions, newPos]));
    alert("Position saved!");
  };

  const fetchEval = useCallback(async (fen: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const evalResult = await getEvaluation(fen, settings.depth, settings.skillLevel);
      lastEvalRef.current = evalResult;
      const adapted = toAnalyzeResponse(evalResult);
      setResult(adapted);
      if (adapted.best_move) {
        const squares = uciToSquares(adapted.best_move);
        if (squares) {
          setHighlightSquares({
            [squares.from]: { background: "rgba(34, 197, 94, 0.25)", borderRadius: "4px" },
            [squares.to]: { background: "rgba(34, 197, 94, 0.4)", borderRadius: "4px", boxShadow: "inset 0 0 12px rgba(34, 197, 94, 0.3)" },
          });
        }
      } else {
        setHighlightSquares({});
      }
      setArrowKey((k) => k + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eval failed");
    } finally {
      setIsLoading(false);
    }
  }, [settings.depth, settings.skillLevel]);

  const makeAiMove = useCallback(async (currentGame: Chess) => {
    if (currentGame.isGameOver()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const fenBefore = currentGame.fen();
      const evalResult = await getEvaluation(fenBefore, settings.depth, settings.skillLevel);
      lastEvalRef.current = evalResult;

      const chosenMove = pickMoveForDifficulty(evalResult, difficulty);
      if (!chosenMove) {
        const legal = currentGame.moves({ verbose: true });
        if (legal.length === 0) return;
        const fallbackMove = legal[Math.floor(Math.random() * legal.length)];
        const gameCopy = new Chess(fenBefore);
        gameCopy.move(fallbackMove);
        setGame(gameCopy);
        setHighlightSquares({});
        setLegalMoveSquares({});
        setSelectedSquare(null);
        setIsLoading(false);
        if (stockfishAssist) fetchEval(gameCopy.fen());
        return;
      }

      const gameCopy = new Chess(fenBefore);
      const moveResult = gameCopy.move({ from: chosenMove.slice(0, 2), to: chosenMove.slice(2, 4), promotion: "q" });
      if (!moveResult) { console.warn("[makeAiMove] illegal:", chosenMove); return; }

      sanHistoryRef.current.push(moveResult.san);
      plyCountRef.current += 1;
      const aiPly = plyCountRef.current;

      analyzeMoveContext(fenBefore, chosenMove, aiPly, settings.depth, settings.skillLevel)
        .then((ma) => setMoveHistory((prev) => {
          const filtered = prev.filter((m) => m.ply !== ma.ply);
          return [...filtered, ma].sort((a, b) => a.ply - b.ply);
        }))
        .catch((e) => console.warn("[analyze-move] AI:", e));

      setGame(gameCopy);
      setHighlightSquares({});
      setLegalMoveSquares({});
      setSelectedSquare(null);
      setIsLoading(false);
      setArrowKey((k) => k + 1);
      if (stockfishAssist) fetchEval(gameCopy.fen());
    } catch (err) {
      console.warn("AI move failed:", err);
      setError(err instanceof Error ? err.message : "AI move failed");
      setIsLoading(false);
    }
  }, [difficulty, fetchEval, stockfishAssist, settings.depth, settings.skillLevel]);

  // ── Idle hint timer ──────────────────────────────────────────────────────────
  // Separated into its own ref-based scheduler so toggling showHints off
  // immediately kills any running timer without needing to re-create callbacks.
  const scheduleHint = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (mode === "play" && stockfishAssist && settings.showHints) {
      idleTimerRef.current = setTimeout(() => setHintPrompt(true), HINT_IDLE_MS);
    }
  }, [mode, stockfishAssist, settings.showHints]);

  // Cancel the timer and clear hint UI whenever showHints is toggled OFF
  useEffect(() => {
    if (!settings.showHints) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setHintPrompt(false);
      setHintActive(false);
      setHighlightSquares({});
    }
  }, [settings.showHints]);

  // Reset idle timer after every move or mode change
  const resetIdleTimer = useCallback(() => {
    setHintPrompt(false);
    setHintActive(false);
    scheduleHint();
  }, [scheduleHint]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [game, mode, resetIdleTimer]);

  const showHint = useCallback(async () => {
    if (!stockfishAssist || !settings.showHints) return;
    setHintPrompt(false);
    setHintActive(true);
    if (!lastEvalRef.current?.bestMove) await fetchEval(game.fen());
    const mv = lastEvalRef.current?.bestMove;
    if (mv) {
      const squares = uciToSquares(mv);
      if (squares) {
        setHighlightSquares({
          [squares.from]: { background: "rgba(34,197,94,0.5)", borderRadius: "4px", boxShadow: "inset 0 0 10px rgba(34,197,94,0.6)" },
          [squares.to]: { background: "rgba(34,197,94,0.6)", borderRadius: "4px", boxShadow: "inset 0 0 14px rgba(34,197,94,0.5)" },
        });
      }
    }
  }, [game, fetchEval, stockfishAssist, settings.showHints]);

  const afterPlayerMove = useCallback(async (newGame: Chess, fenBefore: string, playedUci: string, ply: number) => {
    analyzeMoveContext(fenBefore, playedUci, ply, settings.depth, settings.skillLevel)
      .then((ma) => setMoveHistory((prev) => {
        const filtered = prev.filter((m) => m.ply !== ma.ply);
        return [...filtered, ma].sort((a, b) => a.ply - b.ply);
      }))
      .catch((e) => console.warn("[analyze-move] player:", e));

    setGame(newGame);
    setResult(null);
    setHighlightSquares({});
    setLegalMoveSquares({});
    setSelectedSquare(null);
    setError(null);
    setHintActive(false);
    setHintPrompt(false);
    resetIdleTimer();
    if (mode === "play") {
      setTimeout(() => makeAiMove(newGame), 400);
    } else {
      fetchEval(newGame.fen()).then(() => {
        if (!autoAnalysis) setArrowKey((k) => k + 1);
      });
    }
  }, [mode, autoAnalysis, fetchEval, makeAiMove, resetIdleTimer]);

  const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (mode === "play" && ((playerColor === "white" && game.turn() !== "w") || (playerColor === "black" && game.turn() !== "b"))) return false;
    const fenBefore = game.fen();
    const gameCopy = new Chess(fenBefore);
    try {
      const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (move === null) return false;
      sanHistoryRef.current.push(move.san);
      plyCountRef.current += 1;
      afterPlayerMove(gameCopy, fenBefore, move.from + move.to + (move.promotion ?? ""), plyCountRef.current);
      return true;
    } catch { return false; }
  }, [game, mode, playerColor, afterPlayerMove]);

  const onSquareClick = useCallback((square: string) => {
    const piece = game.get(square as any);
    const isPlayerTurn = mode !== "play" || (playerColor === "white" && game.turn() === "w") || (playerColor === "black" && game.turn() === "b");
    if (piece && piece.color === game.turn() && isPlayerTurn) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as any, verbose: true });
      const newHighlights: Record<string, React.CSSProperties> = {
        [square]: { background: `${config.accentPrimary}55`, borderRadius: "4px", boxShadow: `inset 0 0 0 3px ${config.accentPrimary}` },
      };
      moves.forEach((m: any) => {
        const isCapture = m.flags.includes("c") || m.flags.includes("e");
        newHighlights[m.to] = isCapture
          ? { background: "rgba(239, 68, 68, 0.35)", borderRadius: "50%" }
          : { background: "rgba(100, 200, 240, 0.3)", borderRadius: "50%" };
      });
      setLegalMoveSquares(newHighlights);
      return;
    }
    if (selectedSquare && legalMoveSquares[square] && isPlayerTurn) {
      const fenBefore = game.fen();
      const gameCopy = new Chess(fenBefore);
      try {
        const move = gameCopy.move({ from: selectedSquare, to: square, promotion: "q" });
        if (move) {
          sanHistoryRef.current.push(move.san);
          plyCountRef.current += 1;
          afterPlayerMove(gameCopy, fenBefore, move.from + move.to + (move.promotion ?? ""), plyCountRef.current);
        }
      } catch { }
    }
    setSelectedSquare(null);
    setLegalMoveSquares({});
  }, [game, selectedSquare, legalMoveSquares, mode, playerColor, config, afterPlayerMove]);

  const handleFenLoad = useCallback((fen: string) => {
    try {
      const newGame = new Chess(fen);
      setGame(newGame);
      setResult(null);
      setHighlightSquares({});
      setLegalMoveSquares({});
      setSelectedSquare(null);
      setError(null);
      setHintActive(false);
      setHintPrompt(false);
      fetchEval(fen);
    } catch { setError("Invalid FEN string."); }
  }, [fetchEval]);

  const handleReset = useCallback(() => {
    cancelEvaluation();
    const newGame = new Chess();
    plyCountRef.current = 0;
    sanHistoryRef.current = [];
    setGame(newGame);
    setResult(null);
    setHighlightSquares({});
    setLegalMoveSquares({});
    setSelectedSquare(null);
    setError(null);
    setHintActive(false);
    setHintPrompt(false);
    setMoveHistory([]);
    setReplayPly(null);
    setInsightMove(null);
    setInsightRect(null);
    setResignedResult(null);
    setShowReport(false);
    fetchEval(newGame.fen());
  }, [fetchEval]);

  const handleResign = useCallback(() => {
    if (game.history().length === 0) return;
    const result = playerColor === "white" ? "0-1" : "1-0";
    setResignedResult(result);
    setShowReport(true);
  }, [game, playerColor]);

  const handleAnalyze = useCallback(async () => {
    setSelectedSquare(null);
    setLegalMoveSquares({});
    await fetchEval(game.fen());
  }, [game, fetchEval]);

  // ── FIX: only reset the game if we're not already in play mode ──────────────
  const startPlayMode = useCallback((overrideColor?: PlayerColor) => {
    const activeColor = overrideColor ?? playerColor;
    if (mode === "play") {
      setActiveTab("Play vs Computer");
      return;
    }
    setMode("play");
    const newGame = new Chess();
    plyCountRef.current = 0;
    sanHistoryRef.current = [];
    setGame(newGame);
    setResult(null);
    setHighlightSquares({});
    setLegalMoveSquares({});
    setError(null);
    setHintActive(false);
    setHintPrompt(false);
    setMoveHistory([]);
    setReplayPly(null);
    setInsightMove(null);
    if (activeColor === "black") {
      setTimeout(() => makeAiMove(newGame), 500);
    } else if (stockfishAssist) {
      fetchEval(newGame.fen());
    }
  }, [mode, playerColor, makeAiMove, fetchEval, stockfishAssist]);

  const currentPgn = useMemo(() => {
    if (sanHistoryRef.current.length === 0) return "";
    try {
      const tmp = new Chess();
      for (const san of sanHistoryRef.current) { tmp.move(san); }
      return tmp.pgn();
    } catch { return ""; }
  }, [game]);

  const gameResult = useMemo(() => {
    if (resignedResult) return resignedResult;
    if (!game.isGameOver()) return "*";
    if (game.isCheckmate()) return game.turn() === "w" ? "0-1" : "1-0";
    return "1/2-1/2";
  }, [game, resignedResult]);

  const sortedMoveHistory = useMemo(
    () => [...moveHistory].sort((a, b) => a.ply - b.ply),
    [moveHistory]
  );

  const handleMoveClick = useCallback((move: MoveAnalysis, rect: DOMRect) => {
    setReplayPly(move.ply);
    setInsightMove(move);
    setInsightRect(rect);
  }, []);

  const mergedSquareStyles = useMemo(
    () => Object.keys(legalMoveSquares).length > 0 ? legalMoveSquares : highlightSquares,
    [legalMoveSquares, highlightSquares]
  );

  const turn = game.turn() === "w" ? "White" : "Black";
  const isGameOver = game.isGameOver();
  const secondBestMove = result?.top_moves?.[1]?.move ?? null;
  const showArrows = settings.showBestMoveArrows && ((mode === "play" && stockfishAssist) || (mode === "analysis" && autoAnalysis));

  const toggleStyle = (on: boolean) => ({
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    border: "none" as const,
    background: on ? config.accentPrimary : `${config.textSecondary}44`,
    position: "relative" as const,
    cursor: "pointer",
    transition: "background 0.25s ease",
    flexShrink: 0,
  });
  const toggleKnobStyle = (on: boolean) => ({
    position: "absolute" as const,
    top: "3px",
    left: on ? "23px" : "3px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.25s ease",
    boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
  });

  const insights = useMemo(() => {
    const counts = { Best: 0, Excellent: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0 };
    sortedMoveHistory.forEach(m => {
      if (m.classification === "Brilliant" || m.classification === "Great" || m.classification === "Book") counts.Best++;
      else if (m.classification === "Excellent") counts.Excellent++;
      else if (m.classification === "Good") counts.Good++;
      else if (m.classification === "Inaccuracy") counts.Inaccuracy++;
      else if (m.classification === "Mistake") counts.Mistake++;
      else if (m.classification === "Blunder") counts.Blunder++;
    });
    return counts;
  }, [sortedMoveHistory]);

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", background: config.background, transition: "background 0.4s ease", color: config.textPrimary, fontFamily: "'DM Sans', sans-serif", position: "relative" }}>
      {/* Global Background Image */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "url(/global-bg.png)", backgroundSize: "cover", backgroundPosition: "center", opacity: isLightMode ? 0.4 : 0.4, filter: isLightMode ? "invert(1) grayscale(100%) contrast(1.2)" : "none", mixBlendMode: isLightMode ? "multiply" : "screen", pointerEvents: "none", zIndex: 0 }} />
      {/* Left Sidebar */}
      <div style={{ width: "240px", borderRight: `1px solid ${config.glassBorder}`, display: "flex", flexDirection: "column", padding: "16px 0", background: config.glassBg, backdropFilter: "blur(12px)", zIndex: 10 }}>
        <div style={{ padding: "0 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ fontSize: "1.8rem", filter: "drop-shadow(0 0 8px rgba(212,175,55,0.4))" }}>♔</div>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, margin: 0, background: `linear-gradient(90deg, ${config.accentSecondary}, ${config.accentPrimary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Chess Strategy
            </h1>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, margin: 0, color: config.accentPrimary }}>
              Assistant
            </h2>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "0 12px" }}>
          {[
            { id: "Analysis", icon: "📊" },
            { id: "Play vs Computer", icon: "🎮" },
            { id: "History", icon: "🕐" },
            { id: "Saved Positions", icon: "🔖" },
            { id: "Challenges", icon: "⚔️" },
            { id: "Settings", icon: "⚙️" },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "Challenges") {
                    router.push("/challenges");
                  } else {
                    // ── FIX: switching to Settings/History/etc. while in play mode
                    // just changes the visible tab — does NOT call startPlayMode again
                    setActiveTab(item.id as any);
                    if (item.id === "Analysis") setMode("analysis");
                    else if (item.id === "Play vs Computer") startPlayMode();
                    else if (item.id === "History") setShowHistory(true);
                    // Settings, Saved Positions: just show that tab, game state untouched
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px",
                  background: isActive ? `${config.accentPrimary}22` : "transparent",
                  border: `1px solid ${isActive ? `${config.accentPrimary}44` : "transparent"}`,
                  color: isActive ? config.accentPrimary : config.textSecondary,
                  fontSize: "0.85rem", fontWeight: isActive ? 600 : 400, cursor: "pointer", transition: "all 0.2s ease", textAlign: "left"
                }}
              >
                <span style={{ fontSize: "1rem", opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                {item.id}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Dark / Light Toggle */}
        <div style={{ padding: "0 16px", marginTop: "16px" }}>
          <div style={{ display: "flex", background: `${config.textSecondary}15`, borderRadius: "20px", padding: "4px" }}>
             <button
                onClick={() => isLightMode && toggleLightMode()}
                style={{ flex: 1, padding: "6px 0", borderRadius: "16px", border: "none", background: !isLightMode ? `${config.accentPrimary}22` : "transparent", color: !isLightMode ? config.accentPrimary : config.textSecondary, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
             >
                <span>🌙</span> Dark
             </button>
             <button
                onClick={() => !isLightMode && toggleLightMode()}
                style={{ flex: 1, padding: "6px 0", borderRadius: "16px", border: "none", background: isLightMode ? `${config.accentPrimary}22` : "transparent", color: isLightMode ? config.accentPrimary : config.textSecondary, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
             >
                <span>☀️</span> Light
             </button>
          </div>
        </div>
      </div>

      {activeTab === "Settings" ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px", position: "relative", zIndex: 1 }}>
          <SettingsPanel />
        </div>
      ) : activeTab === "Saved Positions" ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px", position: "relative", zIndex: 1 }}>
          <SavedPositionsPanel onLoad={(fen) => { handleFenLoad(fen); setActiveTab("Analysis"); setMode("analysis"); }} />
        </div>
      ) : (
        <>
          {/* Main Content Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 32px", overflowY: "auto", position: "relative", zIndex: 1 }}>
        {/* Header (Board Styles) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.1rem", color: config.accentPrimary }}>{mode === "analysis" ? "📊" : "🎮"}</span>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{mode === "analysis" ? "Analysis Mode" : "Play vs Computer"}</h2>
           </div>
           
           <div style={{ display: "flex", gap: "8px" }}>
              {(Object.keys(THEMES) as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  style={{
                    padding: "4px 12px", borderRadius: "8px",
                    border: `1px solid ${t === theme ? config.accentPrimary : config.glassBorder}`,
                    background: t === theme ? `${config.accentPrimary}22` : "transparent",
                    color: t === theme ? config.accentPrimary : config.textSecondary,
                    fontSize: "0.75rem", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  {t === "modern" ? "🔳" : t === "classic" ? "🪵" : "🏛"} {THEMES[t].name}
                </button>
              ))}
           </div>
        </div>

        {/* Play Options */}
        {mode === "play" && (
           <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
             <div style={{ display: "flex", gap: "6px" }}>
               {(["white", "black"] as PlayerColor[]).map((c) => (
                 <button key={c} onClick={() => {
                   setPlayerColor(c);
                   const newGame = new Chess();
                   plyCountRef.current = 0;
                   sanHistoryRef.current = [];
                   setGame(newGame);
                   setResult(null);
                   setHighlightSquares({});
                   setLegalMoveSquares({});
                   setError(null);
                   setHintActive(false);
                   setHintPrompt(false);
                   setMoveHistory([]);
                   setReplayPly(null);
                   setInsightMove(null);
                   if (c === "black") {
                     setTimeout(() => makeAiMove(newGame), 500);
                   } else if (stockfishAssist) {
                     fetchEval(newGame.fen());
                   }
                 }} style={{ padding: "4px 12px", borderRadius: "12px", border: `1px solid ${playerColor === c ? config.accentPrimary : config.glassBorder}`, background: playerColor === c ? `${config.accentPrimary}22` : "transparent", color: playerColor === c ? config.accentPrimary : config.textSecondary, fontSize: "0.75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                   {c === "white" ? "♙ White" : "♟ Black"}
                 </button>
               ))}
             </div>
             <div style={{ display: "flex", gap: "6px" }}>
               {(["easy", "medium", "hard", "extreme"] as Difficulty[]).map((d) => (
                 <button key={d} onClick={() => setDifficulty(d)} style={{ padding: "4px 12px", borderRadius: "12px", border: `1px solid ${config.accentSecondary}`, background: difficulty === d ? `${config.accentSecondary}22` : "transparent", color: difficulty === d ? config.accentSecondary : config.textSecondary, fontSize: "0.75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>
                   {d}
                 </button>
               ))}
             </div>
           </div>
        )}

        {/* Board and Controls Container */}
        <div style={{ display: "flex", justifyContent: "center" }}>
           <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: BOARD_WIDTH }}>
              
              <div style={{ position: "relative", filter: `drop-shadow(0 0 32px ${config.accentSecondary}22)` }}>
                <Chessboard
                  position={game.fen()}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  customSquareStyles={mergedSquareStyles}
                  boardWidth={BOARD_WIDTH}
                  customBoardStyle={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 48px rgba(0,0,0,0.4), 0 2px 16px rgba(0,0,0,0.2)", position: "relative" }}
                  customDarkSquareStyle={{ backgroundColor: config.boardDark }}
                  customLightSquareStyle={{ backgroundColor: config.boardLight }}
                  customPieces={customPieces}
                  areArrowsAllowed={true}
                  boardOrientation={mode === "play" ? playerColor : "white"}
                />
                {showArrows && (
                  <MoveOverlay
                    key={arrowKey}
                    bestMove={result?.best_move ?? null}
                    secondBestMove={secondBestMove}
                    boardWidth={BOARD_WIDTH}
                    flipped={mode === "play" && playerColor === "black"}
                  />
                )}
              </div>

              {/* Controls */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {mode === "analysis" && (
                  <>
                    <button onClick={handleAnalyze} disabled={isLoading || isGameOver} style={{ flex: 2, padding: "10px", borderRadius: "8px", border: "none", background: isLoading || isGameOver ? `${config.accentSecondary}22` : config.accentPrimary, color: isLoading || isGameOver ? config.textSecondary : "#000", fontWeight: 600, fontSize: "0.85rem", cursor: isLoading || isGameOver ? "not-allowed" : "pointer" }}>
                      ✦ Analyze Position
                    </button>
                    <button onClick={handleSavePosition} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: config.glassBg, color: config.textSecondary, fontSize: "0.85rem", cursor: "pointer" }}>
                      🔖 Save Pos
                    </button>
                  </>
                )}
                {/* ── Hint button: only shown when hints are enabled ── */}
                {mode === "play" && stockfishAssist && settings.showHints && (
                  <button onClick={showHint} disabled={isLoading || isGameOver} style={{ flex: 2, padding: "10px", borderRadius: "8px", border: `1px solid ${config.accentPrimary}55`, background: `${config.accentPrimary}15`, color: config.accentPrimary, fontWeight: 600, fontSize: "0.85rem", cursor: isLoading || isGameOver ? "not-allowed" : "pointer" }}>
                    💡 Show Hint
                  </button>
                )}
                
                <button onClick={handleReset} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: "transparent", color: config.textSecondary, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  ↺ Reset
                </button>
                <button onClick={() => {
                   if (mode === "play") setPlayerColor(c => c === "white" ? "black" : "white");
                }} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: "transparent", color: config.textSecondary, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  ⇅ Flip Board
                </button>
                
                {mode === "play" && !isGameOver && !resignedResult && game.history().length > 0 && (
                  <button onClick={handleResign} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.15)", color: "#EF4444", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                    🏳 Resign
                  </button>
                )}
              </div>

              {/* Engine Line Card */}
              {result && result.top_moves && result.top_moves.length > 0 && (
                <div style={{ background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "12px", marginTop: "4px" }}>
                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                     <span style={{ fontSize: "0.8rem", fontWeight: 600, color: config.textPrimary }}>Engine Line (Top Recommendation)</span>
                     <span style={{ fontSize: "0.75rem", color: config.textSecondary }}>Depth {lastEvalRef.current?.depth || 20}</span>
                   </div>
                   <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                     <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#22C55E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>★</span>
                     <span style={{ color: "#22C55E", fontWeight: 600, fontSize: "0.85rem" }}>1. {result.best_move}</span>
                     <span style={{ background: `${config.textSecondary}22`, padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem" }}>{result.evaluation}</span>
                     <span style={{ color: config.textSecondary, fontSize: "0.8rem", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                       {result.top_moves[0].move}
                     </span>
                   </div>
                </div>
              )}
           </div>
        </div>

      </div>

      {/* Right Sidebar */}
      <div style={{ width: "340px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", borderLeft: `1px solid ${config.glassBorder}`, background: "transparent", position: "relative", zIndex: 1 }}>

         {/* Position FEN */}
         <div style={{ background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
               <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>♙ Position (FEN)</span>
            </div>
            <div style={{ background: `${config.textSecondary}15`, padding: "8px", borderRadius: "6px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: config.textSecondary, wordBreak: "break-all", marginBottom: "8px" }}>
               {game.fen()}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
               <button onClick={() => handleFenLoad(game.fen())} style={{ flex: 1, padding: "6px", borderRadius: "6px", border: `1px solid ${config.accentPrimary}55`, background: "transparent", color: config.accentPrimary, fontSize: "0.7rem", cursor: "pointer" }}>Load</button>
               <button onClick={() => navigator.clipboard.writeText(game.fen())} style={{ flex: 1, padding: "6px", borderRadius: "6px", border: `1px solid ${config.glassBorder}`, background: "transparent", color: config.textSecondary, fontSize: "0.7rem", cursor: "pointer" }}>Copy</button>
            </div>
         </div>

         {/* Evaluation Card */}
         {settings.showEvalBar && (
           <div style={{ background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "16px", display: "flex", gap: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                 <span style={{ fontSize: "0.55rem", color: config.textSecondary }}>+6.0</span>
                 <div style={{ height: "100px", width: "8px", borderRadius: "4px", background: config.evalBarBlack, border: `1px solid ${config.glassBorder}`, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: result && !result.evaluation.startsWith('#') ? (Math.min(Math.max((parseFloat(result.evaluation) + 6) / 12, 0), 1) * 100) + "%" : "50%", background: config.evalBarWhite, transition: "height 0.3s ease" }} />
                 </div>
                 <span style={{ fontSize: "0.55rem", color: config.textSecondary }}>-6.0</span>
              </div>
              
              <div style={{ flex: 1 }}>
                 <h3 style={{ margin: "0 0 8px 0", fontSize: "0.8rem", fontWeight: 600 }}>Evaluation</h3>
                 <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "12px" }}>
                   <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>{result?.evaluation || "0.00"}</span>
                   <span style={{ fontSize: "0.65rem", background: `${config.textSecondary}22`, padding: "2px 6px", borderRadius: "10px", color: config.textSecondary }}>Equal</span>
                 </div>
                 
                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                   <div>
                     <div style={{ fontSize: "0.65rem", color: config.textSecondary, marginBottom: "2px" }}>Best Move</div>
                     <div style={{ fontSize: "0.85rem", color: "#22C55E", fontWeight: 600 }}>{result?.best_move || "N/A"}</div>
                   </div>
                   <div>
                     <div style={{ fontSize: "0.65rem", color: config.textSecondary, marginBottom: "2px" }}>Depth</div>
                     <div style={{ fontSize: "0.85rem", color: config.textPrimary, fontWeight: 600 }}>{lastEvalRef.current?.depth || 20}</div>
                   </div>
                 </div>
                 
                 <div style={{ background: `${config.textSecondary}15`, padding: "8px", borderRadius: "6px", fontSize: "0.7rem", color: config.textSecondary }}>
                   <div style={{ marginBottom: "2px", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Line</div>
                   <div style={{ fontFamily: "'JetBrains Mono', monospace", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      1. {result?.best_move || "..."} {result?.top_moves?.[0]?.move || ""}
                   </div>
                 </div>
              </div>
           </div>
         )}

         {/* Move Insights */}
         <div style={{ background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "10px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
               <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>♞ Move Insights ({sortedMoveHistory.length})</span>
               <button onClick={() => setShowReport(true)} style={{ fontSize: "0.65rem", color: config.accentPrimary, background: "transparent", border: "none", cursor: "pointer" }}>View Analysis →</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: config.textSecondary }}><span style={{ color: "#22C55E" }}>★</span> Best Moves</div>
                 <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{insights.Best}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: config.textSecondary }}><span style={{ color: "#3B82F6" }}>★</span> Excellent Moves</div>
                 <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{insights.Excellent}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: config.textSecondary }}><span style={{ color: "#10B981" }}>✓</span> Good Moves</div>
                 <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{insights.Good}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: config.textSecondary }}><span style={{ color: "#F59E0B" }}>?!</span> Inaccuracies</div>
                 <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{insights.Inaccuracy}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: config.textSecondary }}><span style={{ color: "#F97316" }}>?</span> Mistakes</div>
                 <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{insights.Mistake}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: config.textSecondary }}><span style={{ color: "#EF4444" }}>??</span> Blunders</div>
                 <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{insights.Blunder}</span>
               </div>
            </div>
         </div>

         {/* Tip Card */}
         <div style={{ background: `${config.accentPrimary}15`, border: `1px solid ${config.accentPrimary}33`, borderRadius: "10px", padding: "12px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: "-5px", bottom: "-15px", fontSize: "5rem", opacity: 0.05 }}>♞</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: config.accentPrimary, marginBottom: "6px" }}>💡 Tip</div>
            <div style={{ fontSize: "0.7rem", color: config.textSecondary, lineHeight: 1.4 }}>
              Click on a piece to see legal moves. Arrows guide your strategy.
            </div>
         </div>
      </div>
      </>
      )}

      {/* Move insight popup */}
      <MoveInsightPopup
        move={insightMove}
        anchorRect={insightRect}
        onClose={() => { setInsightMove(null); setInsightRect(null); }}
      />

      {/* Post-Game Report modal */}
      {showReport && (
        <PostGameReport
          pgn={currentPgn}
          result={gameResult}
          onClose={() => setShowReport(false)}
          onAnalysisComplete={(moves) => setMoveHistory(moves)}
        />
      )}

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onLoadPosition={(fen, ply, moves) => {
            setMoveHistory(moves);
            setReplayPly(ply);
            setShowHistory(false);
          }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}