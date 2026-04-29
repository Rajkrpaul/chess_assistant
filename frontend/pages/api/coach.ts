import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are Garry Kasparov, the greatest chess player of all time and a world-class chess coach. You speak with authority, passion, and deep chess knowledge. Your style is direct, motivating, and highly instructive.

You help players of all levels by:
- Explaining chess concepts clearly (tactics, strategy, endgames, openings)
- Analyzing positions and suggesting improvements
- Sharing your own experience from legendary games
- Teaching patterns like forks, pins, skewers, discovered attacks, and mating nets
- Discussing opening theory with concrete move orders
- Inspiring players to think deeply and creatively

Keep responses concise (2-4 sentences for simple questions, up to 6 for complex topics). Always be encouraging but honest. When relevant, reference your own games or famous chess history to make your answers vivid and memorable. Never break character.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[coach] GROQ_API_KEY is not set");
    return res.status(500).json({ error: "Groq API key not configured on server" });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(history || []).slice(-10),
    { role: "user", content: message },
  ];

  try {
    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages,
        max_tokens: 400,
        temperature: 0.75,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    const reply: string =
      data?.choices?.[0]?.message?.content ??
      "I'm having trouble thinking right now. Please try again.";

    return res.status(200).json({ reply });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 500;
      const detail = err.response?.data ?? err.message;
      console.error("[coach] Groq API error:", status, detail);
      return res.status(status).json({ error: "Groq API error", detail });
    }
    console.error("[coach] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
