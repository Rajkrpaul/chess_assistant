import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

export interface SavedPosition {
  id: string;
  title: string;
  fen: string;
  category: string;
  difficulty: string;
  favorite: boolean;
  timestamp: number;
}

const DEFAULT_POSITIONS: SavedPosition[] = [
  {
    id: "default-1",
    title: "Fried Liver Attack",
    fen: "r1bqkb1r/pppp1ppp/2n5/4N3/2B1p3/8/PPPP1PPP/RNBQK2R w KQkq - 0 1",
    category: "Opening Trap",
    difficulty: "Beginner",
    favorite: false,
    timestamp: Date.now() - 5000,
  },
  {
    id: "default-2",
    title: "Scholar’s Mate Threat",
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5Q2/PPPP1PPP/RNB1KB1R w KQkq - 2 3",
    category: "Opening Trap",
    difficulty: "Beginner",
    favorite: false,
    timestamp: Date.now() - 4000,
  },
  {
    id: "default-3",
    title: "Back Rank Mate Pattern",
    fen: "6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1",
    category: "Endgame Tactic",
    difficulty: "Beginner",
    favorite: false,
    timestamp: Date.now() - 3000,
  },
  {
    id: "default-4",
    title: "Smothered Mate Setup",
    fen: "rn1qkb1r/ppp2ppp/3b4/3pp3/8/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
    category: "Middlegame Tactic",
    difficulty: "Intermediate",
    favorite: false,
    timestamp: Date.now() - 2000,
  },
  {
    id: "default-5",
    title: "Endgame King Opposition",
    fen: "8/8/8/3k4/8/3K4/8/8 w - - 0 1",
    category: "Endgame Concept",
    difficulty: "Intermediate",
    favorite: false,
    timestamp: Date.now() - 1000,
  },
];

interface SavedPositionsPanelProps {
  onLoad: (fen: string) => void;
}

export default function SavedPositionsPanel({ onLoad }: SavedPositionsPanelProps) {
  const { config } = useTheme();
  const [positions, setPositions] = useState<SavedPosition[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => {
    const saved = localStorage.getItem("chessSavedPositions");
    if (saved) {
      try {
        setPositions(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing saved positions", e);
        setPositions(DEFAULT_POSITIONS);
      }
    } else {
      setPositions(DEFAULT_POSITIONS);
      localStorage.setItem("chessSavedPositions", JSON.stringify(DEFAULT_POSITIONS));
    }
  }, []);

  const savePositions = (newPositions: SavedPosition[]) => {
    setPositions(newPositions);
    localStorage.setItem("chessSavedPositions", JSON.stringify(newPositions));
  };

  const handleDelete = (id: string) => {
    savePositions(positions.filter((p) => p.id !== id));
  };

  const toggleFavorite = (id: string) => {
    savePositions(positions.map((p) => p.id === id ? { ...p, favorite: !p.favorite } : p));
  };

  const exportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(positions, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "chess_saved_positions.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          // Merge imported positions, avoiding duplicate IDs
          const existingIds = new Set(positions.map((p) => p.id));
          const newPositions = [...positions, ...imported.filter(p => !existingIds.has(p.id))];
          savePositions(newPositions);
          alert(`Successfully imported ${imported.length} positions!`);
        }
      } catch (error) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const filteredPositions = positions.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.fen.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "All" || p.category === filterCategory || (filterCategory === "Favorites" && p.favorite);
    return matchesSearch && matchesCategory;
  });

  const categories = ["All", "Favorites", ...Array.from(new Set(positions.map(p => p.category)))];

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: config.textPrimary, margin: 0 }}>Saved Positions</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={exportJson} style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: "transparent", color: config.textSecondary, cursor: "pointer", fontSize: "0.85rem" }}>
            Export JSON
          </button>
          <label style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: "transparent", color: config.textSecondary, cursor: "pointer", fontSize: "0.85rem", display: "inline-block" }}>
            Import JSON
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search by title or FEN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: config.glassBg, color: config.textPrimary, fontSize: "0.9rem", outline: "none" }}
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: "10px 16px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: config.glassBg, color: config.textPrimary, fontSize: "0.9rem", outline: "none", cursor: "pointer" }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredPositions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: config.textSecondary }}>No positions found.</div>
        ) : (
          filteredPositions.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: config.glassBg, border: `1px solid ${config.glassBorder}`, borderRadius: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: config.accentPrimary }}>{p.title}</h3>
                  <button onClick={() => toggleFavorite(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>
                    {p.favorite ? "⭐" : "☆"}
                  </button>
                  <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "10px", background: `${config.textSecondary}22`, color: config.textSecondary }}>{p.category}</span>
                  <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "10px", background: `${config.accentSecondary}22`, color: config.accentSecondary }}>{p.difficulty}</span>
                </div>
                <div style={{ fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace", color: config.textSecondary, marginTop: "8px" }}>
                  {p.fen}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginLeft: "16px" }}>
                <button
                  onClick={() => onLoad(p.fen)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: config.accentPrimary, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Load
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: `1px solid ${config.glassBorder}`, background: "rgba(239, 68, 68, 0.1)", color: "#EF4444", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
