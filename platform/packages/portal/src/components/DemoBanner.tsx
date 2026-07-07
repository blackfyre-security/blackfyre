"use client";

/**
 * DemoBanner — shown only in development when NEXT_PUBLIC_DEMO_MODE=true.
 * Never renders in production builds (NODE_ENV check is evaluated at build time).
 */
export function DemoBanner() {
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "var(--accent)",
        color: "var(--accent-fg)",
        textAlign: "center",
        padding: "6px 16px",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        userSelect: "none",
      }}
    >
      DEMO MODE — fixture data, not your real account
    </div>
  );
}
