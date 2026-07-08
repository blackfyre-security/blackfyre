"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Dark terminal-style code block with copy-to-clipboard. Client Component so it
 * can hold copied-state and touch the clipboard API. Self-contained dark styling
 * (hardcoded zinc/lime) so it sits on a vibrant `Section variant="dark"`.
 *
 * Comment lines are dimmed; command lines get an accent `$` prefix.
 */
export default function CopyBlock({
  code,
  label = "bash — local eval",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (insecure context / denied) — text stays selectable.
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#c6f24e]/70" aria-hidden="true" />
        <span className="ml-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy quickstart commands"}
          aria-live="polite"
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 bg-transparent px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6f24e]"
        >
          {copied ? (
            <>
              <Check size={12} strokeWidth={2} className="text-[#c6f24e]" />
              Copied
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={2} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Command body */}
      <div className="overflow-x-auto px-5 py-4">
        <pre className="m-0 font-mono text-[12.5px] leading-[1.7]">
          <code>
            {lines.map((line, i) => {
              const trimmed = line.trimStart();
              if (trimmed.length === 0) {
                return <span key={i}>{"\n"}</span>;
              }
              if (trimmed.startsWith("#")) {
                return (
                  <span key={i} className="text-zinc-500">
                    {line}
                    {"\n"}
                  </span>
                );
              }
              return (
                <span key={i} className="whitespace-pre text-zinc-200">
                  <span className="select-none text-[#c6f24e]">$ </span>
                  {line}
                  {"\n"}
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
