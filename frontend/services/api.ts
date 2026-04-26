import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// ── Existing types ─────────────────────────────────────────────────────────────

export interface TopMove { move: string; evaluation: string; }
export interface AnalyzeRequest { fen: string; depth?: number; }
export interface AnalyzeResponse {
  best_move: string; evaluation: string; explanation: string;
  top_moves: TopMove[]; mate_in: number | null;
}

// ── New analysis types ─────────────────────────────────────────────────────────

export interface MoveAnalysis {
  move_uci: string;
  move_san: string;
  ply: number;
  classification: MoveClassification;
  eval_before: number | null;
  eval_after: number | null;
  mate_before: number | null;
  mate_after: number | null;
  centipawn_loss: number;
  best_move_uci: string;
  best_move_san: string;
  pv_line: string[];
  insight: string;
  is_book: boolean;
  is_brilliant: boolean;
}

export type MoveClassification =
  | "Book" | "Brilliant" | "Great" | "Excellent"
  | "Good" | "Inaccuracy" | "Mistake" | "Blunder";

export interface GameSummary {
  accuracy_white: number;
  accuracy_black: number;
  blunders_white: number;   mistakes_white: number;   inaccuracies_white: number;
  blunders_black: number;   mistakes_black: number;   inaccuracies_black: number;
  good_white: number;       excellent_white: number;  great_white: number;
  brilliant_white: number;  book_white: number;
  good_black: number;       excellent_black: number;  great_black: number;
  brilliant_black: number;  book_black: number;
  best_streak_white: number; best_streak_black: number;
  total_moves: number; result: string; opening_name: string;
}

export interface GameAnalysisResponse {
  moves: MoveAnalysis[];
  summary: GameSummary;
}

export interface HistoryGame {
  id: string; date: string; result: string; pgn: string;
  moves: MoveAnalysis[]; summary: GameSummary;
}

// ── Classification metadata ────────────────────────────────────────────────────

export const CLASSIFICATION_META: Record<MoveClassification, { color: string; icon: string; label: string }> = {
  Book:       { color: "#9B7DE8", icon: "📖", label: "Book" },
  Brilliant:  { color: "#1BAAFF", icon: "✨", label: "Brilliant" },
  Great:      { color: "#22C55E", icon: "!!", label: "Great" },
  Excellent:  { color: "#4ADE80", icon: "!",  label: "Excellent" },
  Good:       { color: "#86EFAC", icon: "⊕",  label: "Good" },
  Inaccuracy: { color: "#FACC15", icon: "?!",  label: "Inaccuracy" },
  Mistake:    { color: "#F97316", icon: "?",   label: "Mistake" },
  Blunder:    { color: "#EF4444", icon: "??",  label: "Blunder" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function handleError(error: unknown): never {
  const axiosError = error as AxiosError<{ detail: string }>;
  const detail = axiosError.response?.data?.detail || axiosError.message || "Unknown error";
  throw new Error(detail);
}

// ── Existing API calls ─────────────────────────────────────────────────────────

export async function analyzePosition(fen: string, depth = 15): Promise<AnalyzeResponse> {
  try {
    const res = await api.post<AnalyzeResponse>("/analyze", { fen, depth });
    return res.data;
  } catch (e) { handleError(e); }
}

export async function checkHealth(): Promise<boolean> {
  try { const r = await api.get("/health"); return r.data.status === "ok"; }
  catch { return false; }
}

// ── New API calls ──────────────────────────────────────────────────────────────

export async function analyzeMoveContext(
  fen_before: string,
  move_uci: string,
  ply: number,
  depth = 14,
  skillLevel = 20
): Promise<MoveAnalysis> {
  try {
    const res = await api.post<MoveAnalysis>("/analyze-move", { fen_before, move_uci, ply, depth, skill_level: skillLevel });
    return res.data;
  } catch (e) { handleError(e); }
}

export interface Challenge {
  id: string;
  fen: string;
  best_move: string;
  evaluation: string;
  theme: string;
  difficulty: "easy" | "medium" | "hard";
  hints: string[];
}

export async function getChallenge(difficulty: string): Promise<Challenge> {
  try {
    const res = await api.get<Challenge>(`/challenge?difficulty=${difficulty}`);
    return res.data;
  } catch (e) { handleError(e); }
}

export interface ChallengeValidation {
  correct: boolean;
  best_move: string;
  user_eval: number;
  best_eval: number;
  classification: string;
  message: string;
  line: string[];
  attempts: number;
}

export async function validateChallenge(
  fen: string, move: string, difficulty: string, attempts: number
): Promise<ChallengeValidation> {
  try {
    const res = await api.post<ChallengeValidation>("/challenge/validate", { fen, move, difficulty, attempts });
    return res.data;
  } catch (e) { handleError(e); }
}

export async function getChallengeHint(puzzle_id: string, current_level: number): Promise<{ hint: string }> {
  try {
    const res = await api.post<{ hint: string }>("/challenge/hint", { puzzle_id, current_level });
    return res.data;
  } catch (e) { handleError(e); }
}

export async function analyzeGame(pgn: string, depth = 14): Promise<GameAnalysisResponse> {
  try {
    // Full-game analysis is slow (depth * 2 Stockfish calls per move). Give it 10 min.
    const res = await api.post<GameAnalysisResponse>("/analyze-game", { pgn, depth }, { timeout: 600_000 });
    return res.data;
  } catch (e) { handleError(e); }
}

export async function getHistory(): Promise<HistoryGame[]> {
  try {
    const res = await api.get<{ games: HistoryGame[] }>("/history");
    return res.data.games;
  } catch (e) { handleError(e); }
}

export async function saveGame(
  pgn: string, result: string, moves: MoveAnalysis[], summary: GameSummary,
): Promise<HistoryGame> {
  try {
    const res = await api.post<HistoryGame>("/history", { pgn, result, moves, summary });
    return res.data;
  } catch (e) { handleError(e); }
}
