import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14181F",
        paper: "#FAFAF9",
        surface: "#FFFFFF",
        line: "#E4E4E1",
        muted: "#6B7280",
        brand: {
          DEFAULT: "#2F5DE3",
          dark: "#1F3FAE",
          light: "#EEF2FF",
        },
        accent: {
          DEFAULT: "#F2A93C",
          dark: "#D98D1F",
        },
        danger: "#DC4C3E",
        success: "#1F9D6B",
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,24,31,0.04), 0 8px 24px -12px rgba(20,24,31,0.12)",
        pop: "0 12px 32px -8px rgba(47,93,227,0.35)",
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
