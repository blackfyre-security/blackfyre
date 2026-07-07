"use client";

/**
 * Dual browser-window mockup — desktop (large) + mobile browser (small).
 * Abstract app skeleton only — no fabricated content. Halo-token restyle.
 */
export default function WebMockups() {
  return (
    <div
      role="img"
      aria-label="Illustration of a desktop browser and a mobile browser rendering a practitioner-built web product"
      className="relative mx-auto w-full max-w-[520px]"
    >
      <DesktopWindow />
      <MobileWindow />
    </div>
  );
}

function DesktopWindow() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border-strong bg-surface shadow-halo-lift"
      style={{ aspectRatio: "16 / 10" }}
    >
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-alt px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-crit" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <div className="ml-4 flex-1 rounded-md border border-border bg-bg px-3 py-1">
          <span className="font-mono text-[10px] text-text-dim">
            blackfyre.xyz / web
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-dim">
          · ready
        </span>
      </div>

      {/* App content */}
      <div className="px-5 pt-4 pb-5">
        {/* Top nav */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.22em] text-text">
              BF
            </span>
            <span className="h-[3px] w-10 rounded-full bg-text/30" />
            <span className="h-[3px] w-8 rounded-full bg-text-muted/30" />
            <span className="h-[3px] w-12 rounded-full bg-text-muted/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="halo-live-dot" aria-hidden />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-dim">
              live
            </span>
          </div>
        </div>

        {/* Masthead */}
        <div className="mt-5">
          <span className="halo-eyebrow">§ 00 / Masthead</span>
          <div className="mt-2 h-[10px] w-[80%] rounded-full bg-text/40" />
          <div className="mt-2 h-[10px] w-[55%] rounded-full bg-text/30" />
          <div
            className="mt-3 h-[3px] w-32 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--accent), transparent)",
            }}
          />
        </div>

        {/* Three-column skeleton grid */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-surface-alt p-3"
            >
              <div className="h-[4px] w-8 rounded-full bg-accent/60" />
              <div className="mt-2 h-[4px] w-[90%] rounded-full bg-text/30" />
              <div className="mt-1.5 h-[4px] w-[70%] rounded-full bg-text-muted/30" />
              <div className="mt-1.5 h-[4px] w-[55%] rounded-full bg-text-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileWindow() {
  return (
    <div
      className="absolute -bottom-8 -right-4 w-[30%] min-w-[130px] max-w-[170px] overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-halo-lift sm:-bottom-10 sm:-right-6"
      style={{ aspectRatio: "9 / 16" }}
    >
      {/* Mobile chrome */}
      <div className="flex items-center justify-between border-b border-border bg-surface-alt px-3 py-1.5">
        <span className="font-mono text-[8px] text-text-dim">
          blackfyre.xyz
        </span>
        <div className="flex items-center gap-0.5">
          <span className="h-1 w-1 rounded-full bg-text-dim" />
          <span className="h-1 w-1 rounded-full bg-text-dim" />
          <span className="h-1 w-1 rounded-full bg-text-dim" />
        </div>
      </div>

      <div className="px-3 pt-3">
        {/* Monogram + nav dot */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.22em] text-text">
            BF
          </span>
          <span className="h-4 w-4 rounded-full border border-border" />
        </div>

        {/* Masthead */}
        <div className="mt-3">
          <div className="h-[6px] w-[85%] rounded-full bg-text/40" />
          <div className="mt-1.5 h-[6px] w-[60%] rounded-full bg-text/30" />
          <div
            className="mt-2 h-[2px] w-14 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--accent-2, var(--accent)), transparent)",
            }}
          />
        </div>

        {/* Stacked cards */}
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-surface-alt p-2"
            >
              <div className="h-[3px] w-6 rounded-full bg-accent/60" />
              <div className="mt-1 h-[3px] w-[85%] rounded-full bg-text/30" />
              <div className="mt-1 h-[3px] w-[55%] rounded-full bg-text-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
