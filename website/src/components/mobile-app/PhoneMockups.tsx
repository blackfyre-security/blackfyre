"use client";

/**
 * Dual phone mockup — iOS (left) + Android (right).
 * Pure CSS/SVG. Halo-token restyle. Abstract app skeleton only (no fabricated data).
 */
export default function PhoneMockups() {
  return (
    <div
      role="img"
      aria-label="Illustration of the same app running on an iOS iPhone and an Android device"
      className="relative grid grid-cols-2 gap-4 sm:gap-6 md:gap-10"
    >
      <Phone variant="ios" className="-rotate-2 translate-y-4" />
      <Phone variant="android" className="rotate-2 -translate-y-2" />
    </div>
  );
}

function Phone({
  variant,
  className = "",
}: {
  variant: "ios" | "android";
  className?: string;
}) {
  const isIOS = variant === "ios";
  return (
    <div
      className={`relative mx-auto w-full max-w-[240px] sm:max-w-[260px] ${className}`}
      style={{ aspectRatio: "9 / 19.5" }}
    >
      {/* Outer bezel */}
      <div
        className="absolute inset-0 rounded-[2.4rem] p-[5px] shadow-halo-lift sm:rounded-[2.8rem]"
        style={{
          background:
            "linear-gradient(145deg, #2A2A2E 0%, #141416 40%, #0C0C0D 100%)",
        }}
      >
        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-bg sm:rounded-[2.4rem]">
          {/* iOS Dynamic Island / Android punchhole */}
          {isIOS ? (
            <div className="absolute left-1/2 top-2 z-10 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
          ) : (
            <div className="absolute left-1/2 top-3 z-10 h-2 w-2 -translate-x-1/2 rounded-full bg-black ring-2 ring-bg" />
          )}

          {/* Status bar (abstract) */}
          <div className="absolute inset-x-5 top-2 z-0 flex items-center justify-between text-[8px]">
            <span className="font-mono text-text-dim">9:41</span>
            <div className="flex items-center gap-1 opacity-60">
              <span className="h-[6px] w-[6px] rounded-sm bg-text-dim" />
              <span className="h-[6px] w-[10px] rounded-sm bg-text-dim" />
            </div>
          </div>

          {/* App content */}
          <div className="absolute inset-0 px-4 pt-10">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="halo-label">
                  {isIOS ? "iOS" : "ANDROID"}
                </p>
                <p className="mt-1 font-display text-[18px] leading-tight tracking-display text-text">
                  Your app
                </p>
              </div>
              <div className="h-7 w-7 rounded-full border border-border" />
            </div>

            {/* Hero card */}
            <div
              className={`mt-4 h-28 w-full overflow-hidden ${
                isIOS ? "rounded-2xl" : "rounded-xl"
              } border border-border bg-surface-alt`}
            >
              <div className="flex h-full flex-col justify-end p-3">
                <div className="h-[6px] w-16 rounded-full bg-text/40" />
                <div className="mt-2 h-[4px] w-24 rounded-full bg-text-muted/40" />
              </div>
            </div>

            {/* List rows */}
            <div className="mt-4 space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 ${
                    isIOS ? "rounded-xl" : "rounded-lg"
                  } bg-surface p-2.5`}
                >
                  <div className="h-6 w-6 rounded-md bg-accent/20" />
                  <div className="flex-1">
                    <div className="h-[4px] w-[70%] rounded-full bg-text/30" />
                    <div className="mt-1.5 h-[3px] w-[40%] rounded-full bg-text-muted/30" />
                  </div>
                </div>
              ))}
            </div>

            {/* Tab bar */}
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-2 backdrop-blur">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i === 0 ? "bg-accent" : "bg-text-dim/40"
                  }`}
                />
              ))}
            </div>

            {/* Home indicator */}
            {isIOS ? (
              <div className="absolute inset-x-0 bottom-1 flex justify-center">
                <div className="h-[3px] w-24 rounded-full bg-text/30" />
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-1 flex justify-center gap-8">
                <div className="h-[6px] w-[6px] rotate-45 border border-text/30" />
                <div className="h-[6px] w-[6px] rounded-full bg-text/30" />
                <div className="h-[6px] w-[8px] rounded-sm bg-text/30" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
