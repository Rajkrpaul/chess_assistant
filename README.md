# ♟ Chess Strategy Assistant

An AI-powered chess analysis tool combining **Stockfish** (engine) + **Groq LLM** (explanations) + **Next.js** (frontend) into a polished, production-ready app.

---

## Features

- **Interactive chessboard** — drag-and-drop pieces, paste FEN strings, sample positions
- **Stockfish engine** — top 3 moves, evaluation score, configurable depth (5–22)
- **Evaluation bar** — animated visual showing White/Black advantage
- **AI explanations** — Groq explains moves in plain English for beginners
- **Graceful fallback** — works without Groq API key using rule-based explanations
- **Move highlighting** — gold squares on best move from/to squares
- **Server health indicator** — live status in the header

---

## Project Structure

```
chess-assistant/
├── backend/
│   ├── main.py                 FastAPI app, CORS, /analyze + /health routes
│   ├── models.py               Pydantic request/response schemas
│   ├── stockfish_service.py    Stockfish engine wrapper (python-chess)
│   ├── ai_service.py           Groq LLM explanation generator
│   ├── requirements.txt        Python dependencies
│   └── .env.example            Environment variable template
│
└── frontend/
    ├── components/
    │   ├── ChessAssistant.tsx  Main board, game state, drag-and-drop
    │   ├── AnalysisPanel.tsx   Results panel (move, eval, explanation)
    │   ├── EvaluationBar.tsx   Animated evaluation bar
    │   └── FenInput.tsx        FEN input + sample positions
    ├── pages/
    │   ├── _app.tsx            Global styles injection
    │   └── index.tsx           Entry page
    ├── services/
    │   └── api.ts              Axios API client
    ├── styles/
    │   └── globals.css         Design system (chess oak/ivory/gold theme)
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    └── .env.local.example
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| Stockfish | 15+ | See below |

---

## Step 1: Install Stockfish

### macOS
```bash
brew install stockfish
which stockfish
# → /opt/homebrew/bin/stockfish
```

### Ubuntu / Debian
```bash
sudo apt update && sudo apt install stockfish -y
which stockfish
# → /usr/bin/stockfish
```

### Windows
1. Download binary from https://stockfishchess.org/download/
2. Extract to a folder, e.g. `C:\stockfish\`
3. Note the full path to `stockfish.exe` — you'll need it for `.env`

### Verify install
```bash
stockfish
# Should show: Stockfish 16 by T. Romstad...
# Type "quit" to exit
```

---

## Step 2: Backend Setup

```bash
cd chess-assistant/backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

Edit `backend/.env`:
```env
GROQ_API_KEY=gsk_your-key-here         # Get from https://console.groq.com/keys
GROQ_MODEL=llama-3.3-70b-versatile    # or other Groq models
STOCKFISH_PATH=/usr/bin/stockfish     # Path from Step 1
```

> **Note:** `GROQ_API_KEY` is optional. Without it, the app uses rule-based fallback explanations.

---

## Step 3: Frontend Setup

```bash
cd chess-assistant/frontend

# Install Node dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
```

`frontend/.env.local` (default is fine for local dev):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Step 4: Run the Project

Open **two terminal windows**:

### Terminal 1 — Start Backend
```bash
cd chess-assistant/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Expected output:
```
INFO:     Stockfish engine initialized at: /usr/bin/stockfish
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Terminal 2 — Start Frontend
```bash
cd chess-assistant/frontend
npm run dev
```

Expected output:
```
  ▲ Next.js 14.2.3
  - Local: http://localhost:3000
  - Ready in 1.2s
```

**Open http://localhost:3000 in your browser.**

---

## API Reference

### `POST /analyze`

Request:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "depth": 15
}
```

Response:
```json
{
  "best_move": "e7e5",
  "evaluation": "+0.20",
  "explanation": "Playing e5 is a classic response, immediately fighting for the center...",
  "top_moves": [
    { "move": "e7e5", "evaluation": "+0.20" },
    { "move": "c7c5", "evaluation": "+0.35" },
    { "move": "e7e6", "evaluation": "+0.40" }
  ],
  "mate_in": null
}
```

### `GET /health`
```json
{ "status": "ok", "engine": true }
```

**Interactive docs:** http://localhost:8000/docs

---

## Production Build

### Backend (with gunicorn)
```bash
pip install gunicorn
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend
```bash
npm run build
npm run start
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Stockfish not found` | Check `STOCKFISH_PATH` in `.env`, run `which stockfish` |
| `CORS error` in browser | Ensure backend is on port 8000, frontend on 3000 |
| `Invalid FEN` error | Use standard FEN — try pasting from chess.com or lichess.org |
| `Groq API error` | Check `GROQ_API_KEY` in `.env`; app still works without it |
| Board not rendering | Disable SSR is handled via `dynamic()` — clear `.next` cache and rebuild |
| `Engine Offline` status | Start the backend first; wait for "Application startup complete" |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI + Uvicorn |
| Chess engine | Stockfish 15+ |
| Chess library | python-chess |
| AI explanations | Groq LLM |
| Frontend framework | Next.js 14 + TypeScript |
| Chessboard UI | react-chessboard |
| Game logic | chess.js |
| Styling | Tailwind CSS + custom CSS |
| HTTP client | Axios |
