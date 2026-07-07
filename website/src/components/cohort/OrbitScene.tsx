/**
 * OrbitScene — the cohort hero's animated illustration.
 *
 * Pure SVG + CSS-class animations (defined in globals.css under the COHORT
 * block). A glowing shield core sits inside two counter-rotating orbit rings
 * that carry cloud nodes; a scan beam sweeps the field, pulse rings emanate,
 * and a starfield twinkles behind. No JS — every motion is declarative CSS,
 * so it pauses automatically under prefers-reduced-motion.
 */
export default function OrbitScene({ className = "" }: { className?: string }) {
  // Deterministic "random" star field (no Math.random — keeps SSR stable).
  const stars = Array.from({ length: 34 }, (_, i) => ({
    x: (i * 73.3) % 520,
    y: (i * 129.7) % 520,
    r: 0.6 + ((i * 7) % 5) * 0.32,
    d: (i % 7) * 0.45,
  }));

  return (
    <svg
      viewBox="0 0 520 520"
      className={className}
      role="img"
      aria-label="Cloud-security orbit illustration: a glowing shield encircled by rotating cloud nodes under a scanning beam."
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="co-core" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="co-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="co-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="co-field">
          <circle cx="260" cy="260" r="240" />
        </clipPath>
      </defs>

      {/* Soft core glow */}
      <circle cx="260" cy="260" r="240" fill="url(#co-core)" opacity="0.5" />

      {/* Starfield */}
      <g clipPath="url(#co-field)">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="var(--accent)"
            className="co-twinkle"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}
      </g>

      {/* Scan beam sweeping the field */}
      <g clipPath="url(#co-field)">
        <rect
          x="20"
          y="0"
          width="480"
          height="150"
          fill="url(#co-beam)"
          className="co-scan"
        />
      </g>

      {/* Concentric guide rings + flowing dashed orbit */}
      <circle cx="260" cy="260" r="232" fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.5" />
      <circle cx="260" cy="260" r="186" fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.4" />
      <circle
        cx="260"
        cy="260"
        r="150"
        fill="none"
        stroke="url(#co-ring)"
        strokeWidth="1.5"
        className="co-dash-flow"
      />

      {/* Pulse rings from the core */}
      <g style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx="260" cy="260" r="60" fill="none" stroke="var(--accent)" strokeWidth="1.2" className="co-pulse-ring" />
        <circle
          cx="260"
          cy="260"
          r="60"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.2"
          className="co-pulse-ring"
          style={{ animationDelay: "1.5s" }}
        />
      </g>

      {/* Outer orbit ring carrying nodes (rotates CW) */}
      <g style={{ transformOrigin: "260px 260px" }} className="co-orbit">
        <circle cx="260" cy="78" r="9" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="260" cy="78" r="3.5" fill="var(--accent)" />
        <circle cx="442" cy="260" r="7" fill="var(--bg)" stroke="var(--accent-2)" strokeWidth="2" />
        <circle cx="260" cy="442" r="9" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="260" cy="442" r="3.5" fill="var(--accent)" />
        <circle cx="78" cy="260" r="7" fill="var(--bg)" stroke="var(--accent-2)" strokeWidth="2" />
      </g>

      {/* Inner orbit ring (rotates CCW) */}
      <g style={{ transformOrigin: "260px 260px" }} className="co-orbit-rev">
        <circle cx="370" cy="150" r="6" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="150" cy="370" r="6" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
        <circle cx="150" cy="150" r="5" fill="var(--bg)" stroke="var(--accent-2)" strokeWidth="2" />
        <circle cx="370" cy="370" r="5" fill="var(--bg)" stroke="var(--accent-2)" strokeWidth="2" />
      </g>

      {/* Central shield */}
      <g className="co-shield-glow" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <path
          d="M260 176 l64 26 v44 c0 46 -30 80 -64 96 c-34 -16 -64 -50 -64 -96 v-44 z"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <path
          d="M260 176 l64 26 v44 c0 46 -30 80 -64 96 z"
          fill="var(--accent)"
          opacity="0.12"
        />
        {/* check / lock glyph */}
        <path
          d="M234 262 l18 18 l34 -40"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
