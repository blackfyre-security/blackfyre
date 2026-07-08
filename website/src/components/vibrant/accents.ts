// Vibrant redesign — literal Tailwind class maps per accent.
// Tailwind JIT cannot generate classes from interpolated strings, so every
// accent's classes are spelled out here and referenced by key.

export type Accent = "blue" | "purple" | "pink" | "emerald" | "amber" | "lime";

interface AccentSet {
  /** eyebrow pill on a LIGHT section */
  pillLight: string;
  /** eyebrow pill on a DARK section */
  pillDark: string;
  /** gradient for an accent heading word (bg-clip-text) */
  headingGrad: string;
  /** solid heading word color (light section) */
  headingSolid: string;
  /** icon-tile idle + hover-invert (light) */
  tileIdle: string;
  tileHover: string;
  /** dark card hover border + glow-to color */
  cardBorder: string;
  cardGlow: string;
  /** accent text on dark */
  textDark: string;
  /** accent text on light */
  textLight: string;
  /** solid dot / chip fill */
  dot: string;
}

export const ACCENTS: Record<Accent, AccentSet> = {
  blue: {
    pillLight: "text-blue-600 bg-blue-50",
    pillDark: "text-blue-400 bg-blue-950/50 border border-blue-900/50",
    headingGrad: "from-zinc-900 via-blue-600 to-zinc-900",
    headingSolid: "text-blue-600",
    tileIdle: "bg-blue-50 text-blue-600",
    tileHover: "group-hover:bg-blue-600 group-hover:text-white",
    cardBorder: "hover:border-blue-900/40",
    cardGlow: "to-blue-950/10",
    textDark: "text-blue-400",
    textLight: "text-blue-600",
    dot: "bg-blue-500",
  },
  purple: {
    pillLight: "text-purple-600 bg-purple-50",
    pillDark: "text-purple-400 bg-purple-950/50 border border-purple-900/50",
    headingGrad: "from-purple-400 via-pink-400 to-blue-400",
    headingSolid: "text-purple-600",
    tileIdle: "bg-purple-50 text-purple-600",
    tileHover: "group-hover:bg-purple-600 group-hover:text-white",
    cardBorder: "hover:border-purple-900/40",
    cardGlow: "to-purple-950/10",
    textDark: "text-purple-400",
    textLight: "text-purple-600",
    dot: "bg-purple-500",
  },
  pink: {
    pillLight: "text-pink-600 bg-pink-50",
    pillDark: "text-pink-400 bg-pink-950/50 border border-pink-900/50",
    headingGrad: "from-pink-400 via-rose-400 to-purple-400",
    headingSolid: "text-pink-600",
    tileIdle: "bg-pink-50 text-pink-600",
    tileHover: "group-hover:bg-pink-600 group-hover:text-white",
    cardBorder: "hover:border-pink-900/40",
    cardGlow: "to-pink-950/10",
    textDark: "text-pink-400",
    textLight: "text-pink-600",
    dot: "bg-pink-500",
  },
  emerald: {
    pillLight: "text-emerald-600 bg-emerald-50",
    pillDark: "text-emerald-400 bg-emerald-950/50 border border-emerald-900/50",
    headingGrad: "from-emerald-400 via-teal-400 to-blue-400",
    headingSolid: "text-emerald-600",
    tileIdle: "bg-green-50 text-green-600",
    tileHover: "group-hover:bg-green-600 group-hover:text-white",
    cardBorder: "hover:border-emerald-900/40",
    cardGlow: "to-emerald-950/10",
    textDark: "text-emerald-400",
    textLight: "text-emerald-600",
    dot: "bg-emerald-500",
  },
  amber: {
    pillLight: "text-amber-800 bg-amber-100",
    pillDark: "text-amber-400 bg-amber-950/50 border border-amber-900/50",
    headingGrad: "from-amber-500 via-orange-500 to-amber-700",
    headingSolid: "text-amber-700",
    tileIdle: "bg-amber-50 text-amber-600",
    tileHover: "group-hover:bg-amber-600 group-hover:text-white",
    cardBorder: "hover:border-amber-900/40",
    cardGlow: "to-amber-950/10",
    textDark: "text-amber-400",
    textLight: "text-amber-700",
    dot: "bg-amber-500",
  },
  lime: {
    pillLight: "text-lime-700 bg-lime-100",
    pillDark: "text-lime-300 bg-lime-950/40 border border-lime-900/50",
    headingGrad: "from-lime-500 via-lime-400 to-emerald-500",
    headingSolid: "text-lime-600",
    tileIdle: "bg-lime-50 text-lime-600",
    tileHover: "group-hover:bg-lime-500 group-hover:text-zinc-950",
    cardBorder: "hover:border-lime-900/40",
    cardGlow: "to-lime-950/10",
    textDark: "text-lime-300",
    textLight: "text-lime-600",
    dot: "bg-lime-400",
  },
};

/** The signature lime used for primary CTAs across the site. */
export const LIME = "#c6f24e";
export const LIME_HOVER = "#b0d93f";
