"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AuthGuard from "@/components/AuthGuard";
import { DemoBanner } from "@/components/DemoBanner";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@blackfyre/ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AuthGuard>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantStatus, setTenantStatus] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const closeSidebar  = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    api.getSubscription()
      .then(res => setTenantStatus(res.status ?? "active"))
      .catch(() => setTenantStatus("active")); // fail open for now
  }, []);

  if (tenantStatus === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold font-heading mb-3" style={{ color: "var(--text-primary)" }}>Account Suspended</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Your account has been suspended. Please update your payment method or contact support.</p>
          <a href="mailto:support@blackfyre.tech" className="btn btn-primary mt-4 inline-block">Contact Support</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <DemoBanner />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      {/* Content area — offset by sidebar width on large screens */}
      <div className="lg:ml-[240px] flex flex-col min-h-screen">
        <TopBar onMenuToggle={toggleSidebar} />
        <main
          className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto"
          style={{ background: "var(--bg)" }}
        >
          {/* Per-page boundary keeps sidebar/topbar usable when a page crashes */}
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
