"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface Settings {
  depth: number;
  skillLevel: number;
  showEvalBar: boolean;
  showBestMoveArrows: boolean;
  advancedAnalysis: boolean;
  showHints: boolean;  // ← new: auto-hint prompt after idle in Play mode
}

const defaultSettings: Settings = {
  depth: 14,
  skillLevel: 20,
  showEvalBar: true,
  showBestMoveArrows: true,
  advancedAnalysis: false,
  showHints: true,   // on by default so existing users see no behaviour change
};

interface SettingsContextValue {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  updateSetting: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("chessSettings");
    if (saved) {
      try {
        // Merge with defaults so new keys are always present
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("chessSettings", JSON.stringify(next));
      return next;
    });
  }, []);

  if (!isLoaded) return null;

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}