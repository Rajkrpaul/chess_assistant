"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Theme = "modern" | "classic" | "ancient";

export interface ThemeConfig {
  name: string;
  boardDark: string;
  boardLight: string;
  background: string;
  accentPrimary: string;
  accentSecondary: string;
  glassBg: string;
  glassBorder: string;
  textPrimary: string;
  textSecondary: string;
  evalBarWhite: string;
  evalBarBlack: string;
  highlightBest: string;
  highlightSecond: string;
  btnBg: string;
  btnText: string;
  label: string;
}

export const THEMES: Record<Theme, ThemeConfig> = {
  modern: {
    name: "Modern",
    boardDark: "#4A90D9",
    boardLight: "#E8EEF4",
    background: "#0D1117",
    accentPrimary: "#4A90D9",
    accentSecondary: "#7EC8E3",
    glassBg: "rgba(255,255,255,0.04)",
    glassBorder: "rgba(74,144,217,0.2)",
    textPrimary: "#E6EDF3",
    textSecondary: "rgba(230,237,243,0.5)",
    evalBarWhite: "#F0F6FF",
    evalBarBlack: "#1C2128",
    highlightBest: "rgba(100, 210, 100, 0.6)",
    highlightSecond: "rgba(255, 220, 60, 0.5)",
    btnBg: "linear-gradient(135deg, #4A90D9, #2C70B9)",
    btnText: "#fff",
    label: "Modern — Clean & Glassmorphic",
  },
  classic: {
    name: "Classic",
    boardDark: "#6B4A1E",
    boardLight: "#D4B483",
    background: "#0D0A07",
    accentPrimary: "#C49A2A",
    accentSecondary: "#8B6914",
    glassBg: "rgba(10,8,5,0.65)",
    glassBorder: "rgba(139,105,20,0.18)",
    textPrimary: "#F5F0E8",
    textSecondary: "rgba(245,240,232,0.4)",
    evalBarWhite: "#F5F0E8",
    evalBarBlack: "#1A1510",
    highlightBest: "rgba(100, 210, 80, 0.65)",
    highlightSecond: "rgba(255, 200, 50, 0.5)",
    btnBg: "linear-gradient(135deg, #C49A2A, #8B6914)",
    btnText: "#0D0A07",
    label: "Classic — Wooden Warmth",
  },
  ancient: {
    name: "Ancient",
    boardDark: "#2A1F0E",
    boardLight: "#8A6B3A",
    background: "#080608",
    accentPrimary: "#D4AF37",
    accentSecondary: "#9B7D1F",
    glassBg: "rgba(5,4,2,0.75)",
    glassBorder: "rgba(212,175,55,0.15)",
    textPrimary: "#EDE0C4",
    textSecondary: "rgba(237,224,196,0.38)",
    evalBarWhite: "#EDE0C4",
    evalBarBlack: "#120E07",
    highlightBest: "rgba(212, 175, 55, 0.7)",
    highlightSecond: "rgba(200, 120, 30, 0.5)",
    btnBg: "linear-gradient(135deg, #D4AF37, #7A5C10)",
    btnText: "#080608",
    label: "Ancient — Royal Gold",
  },
};

// Per-theme light mode palettes — warm and professional, not cold/clinical
const LIGHT_OVERRIDES: Record<Theme, Partial<ThemeConfig>> = {
  modern: {
    background: "#EEF3FA",              // cool-white with a blue tint
    glassBg: "rgba(235, 243, 255, 0.92)",
    glassBorder: "rgba(74, 144, 217, 0.3)",
    textPrimary: "#0D1B2E",             // deep navy, not pure black
    textSecondary: "#3A5068",
    evalBarWhite: "#F0F6FF",
    evalBarBlack: "#1C2B3E",
    btnBg: "linear-gradient(135deg, #4A90D9, #2C70B9)",
    btnText: "#fff",
  },
  classic: {
    background: "#F7F0E3",              // warm parchment
    glassBg: "rgba(255, 251, 240, 0.93)",
    glassBorder: "rgba(180, 140, 60, 0.28)",
    textPrimary: "#1C1207",             // deep warm brown
    textSecondary: "#5C4020",
    evalBarWhite: "#FFF8EC",
    evalBarBlack: "#2C1F0E",
    btnBg: "linear-gradient(135deg, #C49A2A, #8B6914)",
    btnText: "#1C1207",
  },
  ancient: {
    background: "#F5EDD8",              // aged papyrus
    glassBg: "rgba(252, 246, 228, 0.93)",
    glassBorder: "rgba(180, 140, 40, 0.3)",
    textPrimary: "#1A1005",
    textSecondary: "#5A3F10",
    evalBarWhite: "#FDF4D8",
    evalBarBlack: "#1A1005",
    btnBg: "linear-gradient(135deg, #D4AF37, #7A5C10)",
    btnText: "#1A1005",
  },
};

interface ThemeContextValue {
  theme: Theme;
  config: ThemeConfig;
  setTheme: (t: Theme) => void;
  isLightMode: boolean;
  toggleLightMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "classic",
  config: THEMES.classic,
  setTheme: () => {},
  isLightMode: false,
  toggleLightMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("classic");
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("chessTheme") as Theme | null;
    if (saved && THEMES[saved]) setThemeState(saved);
    const savedLight = localStorage.getItem("chessLightMode");
    if (savedLight) setIsLightMode(savedLight === "true");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("chessTheme", t);
  }, []);

  const toggleLightMode = useCallback(() => {
    setIsLightMode((prev) => {
      const next = !prev;
      localStorage.setItem("chessLightMode", String(next));
      return next;
    });
  }, []);

  const baseConfig = THEMES[theme];
  const config: ThemeConfig = isLightMode
    ? { ...baseConfig, ...LIGHT_OVERRIDES[theme] }
    : baseConfig;

  return (
    <ThemeContext.Provider value={{ theme, config, setTheme, isLightMode, toggleLightMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}