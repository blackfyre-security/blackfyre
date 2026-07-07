"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AuthGuard from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AuthGuard>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Fixed sidebar — 260px on desktop, overlay on mobile */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column offset by sidebar width on desktop */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden lg:ml-[240px] transition-all">
        <TopBar onMobileMenuToggle={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto" style={{ padding: "24px 28px" }}>
          <div className="animate-fade-up">
            {/* Per-page boundary keeps sidebar/topbar usable when a page crashes */}
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
