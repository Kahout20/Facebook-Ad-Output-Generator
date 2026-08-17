import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F3F6FA",
        paper: "#0A0E17",
        surface: "#121826",
        line: "#232B3D",
        muted: "#8A93A6",
        brand: {
          DEFAULT: "#2DD4BF",
          dark: "#14B8A6",
          light: "rgba(45, 212, 191, 0.12)",
        },
        accent: {
          DEFAULT: "#8B5CF6",
          dark: "#7C3AED",
          light: "rgba(139, 92, 246, 0.14)",
        },
        danger: "#F87171",
        success: "#34D399",
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.6)",
        pop: "0 12px 32px -8px rgba(45,212,191,0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.35s ease-out both",
        pulseSoft: "pulseSoft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
