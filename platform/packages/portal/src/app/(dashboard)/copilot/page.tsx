"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  sources?: string[];
  timestamp: string;
}

type RecentConv = { title: string; date: string };

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentConv[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.getCopilot()
      .then((res) => {
        const c = res.copilot ?? {};
        setSuggested(c.suggestedQuestions ?? []);
        setRecent((c.recentConversations ?? []) as RecentConv[]);
        setMessages((c.seedThread ?? []) as Message[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load copilot"))
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input, timestamp: "Just now" };
    const q = input;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await api.askCopilot(q);
      setMessages((prev) => [...prev, res.answer as Message]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString() + "-err",
        role: "ai",
        content: err instanceof Error ? err.message : "Failed to get response.",
        timestamp: "Just now",
      }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading copilot…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 flex flex-col">
        <p className="halo-eyebrow">§ 05 · Copilot</p>
        <h1 className="mt-2 mb-4 text-xl font-semibold text-text-primary">
          <span className="text-indigo-400 mr-2">✦</span>AI Copilot
        </h1>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`max-w-[85%] ${msg.role === "ai" ? "ml-auto" : ""}`}>
              <div className={`rounded-xl px-4 py-3 ${msg.role === "user" ? "bg-surface border border-border" : "bg-indigo-950/50 border border-indigo-800/50"}`}>
                <div className={`text-xs mb-2 ${msg.role === "user" ? "text-text-muted" : "text-indigo-400"}`}>
                  {msg.role === "user" ? "You" : "✦ AI Copilot"}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {msg.sources.map((s) => (
                      <span key={s} className="text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                )}
                {msg.role === "ai" && (
                  <div className="flex gap-3 mt-3">
                    <button className="text-[10px] text-green-500 hover:text-green-400">👍 Helpful</button>
                    <button className="text-[10px] text-text-muted hover:text-text-secondary">👎</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="max-w-[85%] ml-auto">
              <div className="rounded-xl px-4 py-3 bg-indigo-950/50 border border-indigo-800/50 text-xs text-indigo-300">✦ thinking…</div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your compliance, findings, risks..."
            className="flex-1 rounded-xl bg-bg border border-border px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
          />
          <button onClick={handleSend} disabled={sending} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl text-sm font-medium transition-colors">
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      <div className="w-72 shrink-0 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Suggested Questions</h3>
          <div className="space-y-2">
            {suggested.map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="w-full text-left text-sm px-3 py-2 rounded-lg bg-surface border border-border hover:border-indigo-700/50 hover:bg-indigo-950/20 transition-colors text-text-secondary"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Recent Conversations</h3>
          <div className="space-y-2">
            {recent.map((c) => (
              <div key={c.title} className="px-3 py-2 rounded-lg bg-surface border border-border">
                <div className="text-sm text-text-secondary">{c.title}</div>
                <div className="text-[10px] text-text-muted">{c.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
