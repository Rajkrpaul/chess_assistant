import React from "react";
import { useSettings } from "../context/SettingsContext";
import { useTheme, THEMES, Theme } from "../context/ThemeContext";

export default function SettingsPanel() {
  const { settings, updateSetting } = useSettings();
  const { theme, setTheme, isLightMode, toggleLightMode, config } = useTheme();

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "24px", color: config.textPrimary }}>Settings</h2>

      {/* Engine Settings */}
      <section style={{ marginBottom: "32px", padding: "20px", background: config.glassBg, borderRadius: "12px", border: `1px solid ${config.glassBorder}` }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "16px", color: config.accentPrimary }}>Engine Settings</h3>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem", color: config.textSecondary }}>
            <span>Analysis Depth</span>
            <span>{settings.depth}</span>
          </label>
          <input
            type="range"
            min="1"
            max="25"
            value={settings.depth}
            onChange={(e) => updateSetting("depth", parseInt(e.target.value))}
            style={{ width: "100%", accentColor: config.accentPrimary }}
          />
          <p style={{ fontSize: "0.75rem", color: config.textSecondary, marginTop: "4px" }}>Higher depth takes longer but provides more accurate analysis.</p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem", color: config.textSecondary }}>
            <span>Engine Skill Level (0 - 20)</span>
            <span>{settings.skillLevel}</span>
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={settings.skillLevel}
            onChange={(e) => updateSetting("skillLevel", parseInt(e.target.value))}
            style={{ width: "100%", accentColor: config.accentSecondary }}
          />
          <p style={{ fontSize: "0.75rem", color: config.textSecondary, marginTop: "4px" }}>Controls how strong the engine plays against you.</p>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", cursor: "pointer", fontSize: "0.9rem", color: config.textPrimary }}>
          <input
            type="checkbox"
            checked={settings.showEvalBar}
            onChange={(e) => updateSetting("showEvalBar", e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: config.accentPrimary }}
          />
          Show Evaluation Bar
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", cursor: "pointer", fontSize: "0.9rem", color: config.textPrimary }}>
          <input
            type="checkbox"
            checked={settings.showBestMoveArrows}
            onChange={(e) => updateSetting("showBestMoveArrows", e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: config.accentPrimary }}
          />
          Show Best Move Arrows
        </label>

        {/* ── Hints toggle ───────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderRadius: "10px",
          background: `${config.accentPrimary}0D`,
          border: `1px solid ${config.accentPrimary}22`,
        }}>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: config.textPrimary, marginBottom: "2px" }}>
              💡 Auto-Hints (Play vs Computer)
            </div>
            <div style={{ fontSize: "0.72rem", color: config.textSecondary }}>
              Suggest a hint after {Math.round(12)} seconds of inactivity on your turn
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSetting("showHints", !settings.showHints)}
            aria-label={settings.showHints ? "Disable hints" : "Enable hints"}
            aria-pressed={settings.showHints}
            style={{
              flexShrink: 0,
              marginLeft: "16px",
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              border: "none",
              background: settings.showHints ? config.accentPrimary : `${config.textSecondary}44`,
              position: "relative",
              cursor: "pointer",
              transition: "background 0.25s ease",
              padding: 0,
            }}
          >
            <span style={{
              display: "block",
              position: "absolute",
              top: "3px",
              left: settings.showHints ? "23px" : "3px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.25s ease",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }} />
          </button>
        </div>
      </section>

      {/* UI Settings */}
      <section style={{ marginBottom: "32px", padding: "20px", background: config.glassBg, borderRadius: "12px", border: `1px solid ${config.glassBorder}` }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "16px", color: config.accentPrimary }}>Appearance</h3>
        
        <div style={{ marginBottom: "16px" }}>
          <span style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: config.textSecondary }}>Color Mode</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => isLightMode && toggleLightMode()}
              style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `1px solid ${!isLightMode ? config.accentPrimary : config.glassBorder}`, background: !isLightMode ? `${config.accentPrimary}22` : "transparent", color: config.textPrimary, cursor: "pointer" }}
            >
              🌙 Dark
            </button>
            <button
              onClick={() => !isLightMode && toggleLightMode()}
              style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `1px solid ${isLightMode ? config.accentPrimary : config.glassBorder}`, background: isLightMode ? `${config.accentPrimary}22` : "transparent", color: config.textPrimary, cursor: "pointer" }}
            >
              ☀️ Light
            </button>
          </div>
        </div>

        <div>
          <span style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: config.textSecondary }}>Board Style</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(Object.keys(THEMES) as Theme[]).map((t) => (
              <label key={t} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", color: config.textPrimary }}>
                <input
                  type="radio"
                  name="boardTheme"
                  checked={theme === t}
                  onChange={() => setTheme(t)}
                  style={{ width: "16px", height: "16px", accentColor: config.accentPrimary }}
                />
                {THEMES[t].name}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* AI Behavior */}
      <section style={{ padding: "20px", background: config.glassBg, borderRadius: "12px", border: `1px solid ${config.glassBorder}` }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "16px", color: config.accentPrimary }}>AI Behavior</h3>
        
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", color: config.textPrimary }}>
          <input
            type="checkbox"
            checked={settings.advancedAnalysis}
            onChange={(e) => updateSetting("advancedAnalysis", e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: config.accentPrimary }}
          />
          Use Advanced Analysis mode (deep insight)
        </label>
        <p style={{ fontSize: "0.75rem", color: config.textSecondary, marginTop: "4px", marginLeft: "24px" }}>When disabled, the assistant provides simpler, beginner-friendly explanations.</p>
      </section>
    </div>
  );
}