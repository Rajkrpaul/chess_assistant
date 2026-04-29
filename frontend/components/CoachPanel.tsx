import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

interface ChatMessage {
  id: string;
  sender: "coach" | "user";
  text: string;
}

const SUGGESTIONS = [
  "Best opening for white?",
  "How do I avoid blunders?",
  "Explain the Sicilian Defense",
  "Tips for the endgame",
];

function KasparovAvatar({ size = 56, border }: { size?: number; border?: string }) {
  const [imgError, setImgError] = useState(false);
  const { config } = useTheme();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: border ?? `2px solid ${config.accentPrimary}`, background: `linear-gradient(135deg, #1a1a2e, #16213e)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {!imgError ? (
        <img
          src="/kasparov_coach.png"
          alt="Kasparov"
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontSize: size * 0.45, lineHeight: 1 }}>♔</span>
      )}
    </div>
  );
}

export default function CoachPanel() {
  const { config } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "coach",
      text: "♟ Welcome! I'm Garry Kasparov — 13th World Chess Champion and your personal coach. Ask me anything about openings, tactics, strategy, or endgames. Let's sharpen your game!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const typingId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: typingId, sender: "coach", text: "…" }]);

    // Snapshot history BEFORE this message for context
    const contextHistory = [...historyRef.current];
    historyRef.current = [...historyRef.current, { role: "user", content: text }];

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: contextHistory }),
      });

      const data = await res.json();
      const reply: string = data.reply ?? "I couldn't respond right now — please try again.";

      setMessages((prev) =>
        prev.map((m) => (m.id === typingId ? { ...m, text: reply } : m))
      );
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingId
            ? { ...m, text: "Connection error. Please check your network and try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'DM Sans', sans-serif", color: config.textPrimary }}>
      
      {/* ── Profile Header ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "20px 16px", borderBottom: `1px solid ${config.glassBorder}`, gap: "14px" }}>
        <KasparovAvatar size={56} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, whiteSpace: "nowrap" }}>Kasparov</h3>
            <span style={{ color: "#3B82F6", fontSize: "0.8rem" }}>✔</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: config.textSecondary, marginBottom: "2px" }}>World Chess Champion · Your Coach</div>
          <div style={{ fontSize: "0.68rem", color: config.textSecondary, opacity: 0.8 }}>
            Ask me anything about chess
          </div>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {messages.map((msg) => {
          const isCoach = msg.sender === "coach";
          const isTyping = msg.text === "…";
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "10px",
                alignSelf: isCoach ? "flex-start" : "flex-end",
                maxWidth: "88%",
                alignItems: "flex-end",
              }}
            >
              {isCoach && <KasparovAvatar size={28} border={`1px solid ${config.accentPrimary}55`} />}
              <div
                style={{
                  background: isCoach ? `${config.textSecondary}15` : `${config.accentPrimary}33`,
                  border: `1px solid ${isCoach ? config.glassBorder : `${config.accentPrimary}55`}`,
                  padding: "10px 14px",
                  borderRadius: "12px",
                  borderBottomLeftRadius: isCoach ? "2px" : "12px",
                  borderBottomRightRadius: !isCoach ? "2px" : "12px",
                  fontSize: "0.8rem",
                  lineHeight: 1.55,
                  opacity: isTyping ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {isTyping ? (
                  <span style={{ letterSpacing: "0.25em", fontSize: "1rem" }}>⋯</span>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Input Area ── */}
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${config.glassBorder}` }}>
        {/* Quick suggestions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSend(s)}
              disabled={isLoading}
              style={{
                background: "transparent",
                border: `1px solid ${config.glassBorder}`,
                color: config.textSecondary,
                padding: "5px 10px",
                borderRadius: "16px",
                fontSize: "0.68rem",
                cursor: isLoading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                opacity: isLoading ? 0.5 : 1,
                transition: "all 0.15s",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Text input row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: `${config.textSecondary}12`,
            borderRadius: "8px",
            padding: "8px 12px",
            border: `1px solid ${config.glassBorder}`,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="Ask Kasparov anything about chess..."
            disabled={isLoading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: config.textPrimary,
              outline: "none",
              fontSize: "0.8rem",
            }}
          />
          <button
            type="button"
            onClick={() => handleSend(input)}
            disabled={isLoading || !input.trim()}
            style={{
              background: "transparent",
              border: "none",
              color:
                isLoading || !input.trim() ? config.textSecondary : config.accentPrimary,
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              padding: "4px 6px",
              fontSize: "1rem",
              transition: "color 0.2s",
            }}
          >
            {isLoading ? "⏳" : "➤"}
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: "0.6rem",
            color: config.textSecondary,
            marginTop: "8px",
            opacity: 0.7,
          }}
        >
          ⚡ Powered by Groq · Responses may be inaccurate. Verify important moves.
        </div>
      </div>
    </div>
  );
}
