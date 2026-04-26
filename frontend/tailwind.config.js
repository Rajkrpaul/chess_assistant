/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        ivory: "#F5F0E8",
        ebony: "#1A1510",
        oak: "#8B6914",
        oak_light: "#C49A2A",
        felt: "#2D5016",
        felt_light: "#4A7A28",
        amber: "#D4870A",
        cream: "#E8DCC8",
        shadow: "#0D0A07",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(212, 135, 10, 0.4)" },
          "50%": { boxShadow: "0 0 24px rgba(212, 135, 10, 0.8)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
