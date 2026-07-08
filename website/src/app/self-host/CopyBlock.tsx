"use client";

import { useState } from "react";

/**
 * Terminal-style code block with a copy-to-clipboard button. Client Component
 * so it can hold copied-state and touch the clipboard API. Purely presentational
 * otherwise — pass the raw command text as `code`.
 */
export default function CopyBlock({
  code,
  label = "bash — local stack",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (insecure context / denied) — no-op, text stays selectable.
    }
  };

  return (
    <div className="halo-card overflow-hidden p-0">
      {/* Terminal chrome */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-alt px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-crit/70" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/70" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" aria-hidden="true" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-border-strong hover:text-text"
          aria-live="polite"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-[1.7] text-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}
