"use client";

export function CopilotInput({ onSubmit, placeholder }: { onSubmit?: (q: string) => void; placeholder?: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-indigo-700/50 bg-indigo-950/30 px-3 py-2.5 cursor-pointer hover:border-indigo-600 transition-colors"
      onClick={() => {
        if (onSubmit) onSubmit("");
        else if (typeof window !== "undefined") window.location.href = "/copilot";
      }}
    >
      <span className="text-indigo-400 text-sm">✦</span>
      <span className="text-sm text-gray-500 flex-1">{placeholder ?? "Ask a question about your compliance..."}</span>
      <span className="text-indigo-700 text-sm">→</span>
    </div>
  );
}
