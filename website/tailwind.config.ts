import type { Config } from "tailwindcss";

/**
 * Halo design system — CSS-variable tokens swap under [data-theme].
 * Defaults resolve to the dark palette at the :root scope in globals.css;
 * [data-theme="light"] overrides for light mode. Tailwind consumes the vars
 * so classes like `bg-bg`, `text-accent`, `border-border` stay theme-agnostic.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-alt": "var(--surface-alt)",
        text: "var(--text)",
        "text-muted": "var(--muted)",
        "text-dim": "var(--dim)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        warn: "var(--warn)",
        crit: "var(--crit)",
        // vibrant redesign: intermediate zinc used by dashboard chart bars
        "zinc-850": "#1f1f23",
      },
      fontFamily: {
        sans: [
          "var(--font-display)",
          "Space Grotesk",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Space Grotesk",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        tightest: "-0.035em",
        display: "-0.03em",
      },
      boxShadow: {
        "halo-lift": "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)",
        "halo-glow": "0 8px 28px -8px var(--accent)",
      },
      backgroundImage: {
        "halo-radial": "radial-gradient(ellipse 900px 400px at 80% 10%, var(--accent-glow), transparent 60%)",
      },
      keyframes: {
        haloWordIn: {
          from: { opacity: "0", transform: "translateY(12px)", filter: "blur(6px)" },
          to: { opacity: "1", transform: "none", filter: "blur(0)" },
        },
        halopulse: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.92)" },
        },
        halocursor: {
          "0%,49%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        haloslidein: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "none" },
        },
        halofadeup: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "halo-word-in": "haloWordIn 500ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        "halo-pulse": "halopulse 1.8s ease-in-out infinite",
        "halo-cursor": "halocursor 0.8s steps(1) infinite",
        "halo-slide-in": "haloslidein 260ms ease-out",
        "halo-fade-up": "halofadeup 700ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
