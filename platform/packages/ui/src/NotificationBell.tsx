"use client";
import { useState } from "react";

export interface Notification {
  id: string;
  type: "approval" | "fix_complete" | "drift" | "deadline" | "threat";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  href: string;
}

const TYPE_COLORS: Record<string, string> = {
  approval: "#c084fc", fix_complete: "#4ade80", drift: "#fbbf24", deadline: "#f87171", threat: "#ef4444",
};

export function NotificationBell({ notifications, onMarkRead, onClearAll }: {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors" aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 z-50 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && <button onClick={onClearAll} className="text-xs text-[var(--accent)] hover:underline">Mark all read</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No notifications</div>
              ) : notifications.slice(0, 10).map((n) => (
                <a key={n.id} href={n.href} onClick={() => { onMarkRead(n.id); setOpen(false); }}
                  className={`block px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--hover-bg)] transition-colors ${!n.read ? "bg-[var(--hover-bg)]" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: TYPE_COLORS[n.type] ?? "#6b7280" }} />
                    <div>
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{n.description}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">{n.timestamp}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
