/**
 * stockfishService.ts
 *
 * Fetches chess position evaluations from the local Stockfish backend
 * running at localhost:8000 (Python/FastAPI + python-chess UCI engine).
 *
 * Features:
 *  - 300 ms debounce to avoid hammering on fast moves
 *  - AbortController per request with a 45 s safety timeout
 *  - Generation counter: stale responses from superseded requests are
 *    silently discarded — the UI always reflects the latest position
 *  - LRU-style cache (max 50 entries) so repeated FEN lookups are instant
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEBOUNCE_MS = 150;
const REQUEST_TIMEOUT_MS = 45_000;

// ── Public types ──────────────────────────────────────────────────────────────

export interface StockfishEvalResult {
  bestMove: string | null;        // UCI string e.g. "e2e4"
  secondBestMove: string | null;  // UCI string e.g. "d2d4"
  evaluation: number | null;      // centipawns (positive = white advantage)
  mateIn: number | null;          // null if not a forced mate
  depth: number;
  source: "stockfish" | "empty";
}

export type Difficulty = "easy" | "medium" | "hard" | "extreme";

// ── Module-level state ────────────────────────────────────────────────────────

/** Monotonically-increasing counter; increment on every new request. */
let evalGeneration = 0;

/** Pending debounce timer handle. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Simple LRU-style in-memory cache for position evaluations. */
const evalCache = new Map<string, StockfishEvalResult>();
const CACHE_MAX_SIZE = 50;

// ── Internal helpers ──────────────────────────────────────────────────────────

function emptyResult(): StockfishEvalResult {
  return {
    bestMove: null,
    secondBestMove: null,
    evaluation: null,
    mateIn: null,
    depth: 0,
    source: "empty",
  };
}

function cacheResult(fen: string, result: StockfishEvalResult): void {
  if (evalCache.size >= CACHE_MAX_SIZE) {
    const firstKey = evalCache.keys().next().value;
    if (firstKey !== undefined) evalCache.delete(firstKey);
  }
  evalCache.set(fen, result);
}

// ── Backend fetch ─────────────────────────────────────────────────────────────

async function fetchFromBackend(
  fen: string,
  depth: number = 14,
  skillLevel: number = 20
): Promise<StockfishEvalResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fen, depth, skill_level: skillLevel }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backend HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();

    // Unwrap standardised envelope { success, data, error }
    if (json.success === false) {
      throw new Error(json.error ?? "Backend error");
    }
    const data = json.data ?? json; // fallback for non-wrapped responses

    // Parse evaluation string → centipawns or mate number
    let cp: number | null = null;
    let mate: number | null = null;
    const evalStr: string = data.evaluation ?? "0.00";

    if (evalStr.startsWith("#")) {
      const parsed = parseInt(evalStr.slice(1).replace("+", "").replace("-", ""), 10);
      mate = isNaN(parsed) ? null : (evalStr.includes("-") ? -parsed : parsed);
    } else {
      const parsed = parseFloat(evalStr.replace("+", ""));
      if (!isNaN(parsed)) cp = Math.round(parsed * 100); // pawns → centipawns
    }

    const topMoves: Array<{ move: string }> = data.top_moves ?? [];
    const bestMove = data.best_move || topMoves[0]?.move || null;
    const secondBestMove = topMoves[1]?.move || null;

    if (!bestMove) {
      throw new Error("Backend returned no best_move");
    }

    return {
      bestMove,
      secondBestMove,
      evaluation: data.mate_in != null ? null : cp,
      mateIn: data.mate_in ?? mate,
      depth,
      source: "stockfish",
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out after 45 s.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the best Stockfish evaluation for a given FEN position.
 *
 * - Returns a cached result instantly if the same FEN was seen before.
 * - Applies a 300 ms debounce to avoid hammering on rapid moves.
 * - Uses a generation counter so only the most recent call's result is used.
 */
export async function getEvaluation(fen: string, depth: number = 14, skillLevel: number = 20): Promise<StockfishEvalResult> {
  // Cache hit → return immediately
  if (evalCache.has(fen)) {
    return evalCache.get(fen)!;
  }

  // Stamp this request's generation
  const myGeneration = ++evalGeneration;

  // Cancel pending debounce from a previous call
  if (debounceTimer) clearTimeout(debounceTimer);

  // Wait out the debounce period
  await new Promise<void>((resolve) => {
    debounceTimer = setTimeout(resolve, DEBOUNCE_MS);
  });

  // If a newer request already arrived, bail out
  if (myGeneration !== evalGeneration) return emptyResult();

  const result = await fetchFromBackend(fen, depth, skillLevel);

  if (myGeneration !== evalGeneration) return emptyResult();

  if (result) {
    cacheResult(fen, result);
    return result;
  }

  return emptyResult();
}

/**
 * Cancel any pending evaluation (call on game reset or component unmount).
 */
export function cancelEvaluation(): void {
  evalGeneration++;          // make any in-flight result stale
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Clear the position cache (call when starting a new game).
 */
export function clearEvalCache(): void {
  evalCache.clear();
}

// ── Difficulty-aware move selection ──────────────────────────────────────────

/**
 * Choose a move from a StockfishEvalResult according to the desired difficulty.
 *
 * - easy:    randomly pick from [best, second-best], weighted toward best
 * - medium:  30 % chance of playing the second-best move
 * - hard / extreme: always play the best move
 */
export function pickMoveForDifficulty(
  result: StockfishEvalResult,
  difficulty: Difficulty,
): string | null {
  const { bestMove, secondBestMove } = result;
  if (!bestMove) return null;

  switch (difficulty) {
    case "easy": {
      const pool = [bestMove, secondBestMove].filter(Boolean) as string[];
      pool.push(bestMove); // weight best move slightly higher
      return pool[Math.floor(Math.random() * pool.length)];
    }
    case "medium":
      if (secondBestMove && Math.random() < 0.3) return secondBestMove;
      return bestMove;
    case "hard":
    case "extreme":
    default:
      return bestMove;
  }
}
