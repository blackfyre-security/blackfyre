"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Urgency = "critical" | "high" | "medium" | "low";
type CalEvent = { id: string; type: string; title: string; framework: string; date: string; daysRemaining: number; readiness: number; urgency: Urgency };

const TYPE_ICONS: Record<string, string> = { deadline: "📅", audit: "🔍", scan: "🔄", renewal: "🔁", report: "📄", training: "📚" };
const URGENCY_COLORS: Record<Urgency, string> = { critical: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#4ade80" };

export default function CalendarPage() {
  const [view, setView] = useState<"list" | "month">("list");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCalendarEvents()
      .then((res) => setEvents((res.events ?? []) as CalEvent[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load calendar"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading calendar…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  const critical = events.filter((e) => e.urgency === "critical");

  return (
    <div className="animate-halo-fade-up">
      <p className="halo-eyebrow">§ 14 · Calendar</p>
      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 className="text-xl font-semibold text-text-primary">Compliance Calendar</h1>
        <div className="flex gap-2">
          <button onClick={() => setView("list")} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${view === "list" ? "border-indigo-600 bg-indigo-950/30 text-indigo-300" : "border-border text-text-muted"}`}>List</button>
          <button onClick={() => setView("month")} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${view === "month" ? "border-indigo-600 bg-indigo-950/30 text-indigo-300" : "border-border text-text-muted"}`}>Month</button>
          <button className="text-xs px-3 py-1.5 rounded-lg border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">+ Add Deadline</button>
        </div>
      </div>

      {critical.length > 0 && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4 mb-6">
          <div className="text-sm font-semibold text-red-400">
            {critical.length} critical deadline{critical.length > 1 ? "s" : ""} approaching
          </div>
        </div>
      )}

      <div className="space-y-3">
        {events.slice().sort((a, b) => a.daysRemaining - b.daysRemaining).map((event) => (
          <div key={event.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{TYPE_ICONS[event.type] ?? "📋"}</span>
                <div>
                  <div className="text-sm font-medium">{event.title}</div>
                  <div className="flex gap-3 text-xs text-text-muted mt-1">
                    <span>{event.framework}</span>
                    <span>{event.date}</span>
                    <span className="font-medium" style={{ color: URGENCY_COLORS[event.urgency] }}>
                      {event.daysRemaining}d remaining
                    </span>
                  </div>
                </div>
              </div>
              {event.type === "deadline" && (
                <div className="text-right">
                  <div className="text-xs text-text-muted mb-1">Readiness</div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full halo-progress-fill" style={{ width: `${event.readiness}%`, background: event.readiness >= 80 ? "#4ade80" : event.readiness >= 60 ? "#fbbf24" : "#f87171" }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: event.readiness >= 80 ? "#4ade80" : event.readiness >= 60 ? "#fbbf24" : "#f87171" }}>
                      {event.readiness}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
