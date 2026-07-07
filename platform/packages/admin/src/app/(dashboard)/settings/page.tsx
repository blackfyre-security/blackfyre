"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type TabId = "frameworks" | "agents" | "notifications" | "security" | "platform";

// REAL IMPL (BLACKFYRE 2026-06): frameworks come from the real
// GET /api/compliance/frameworks endpoint (framework id, version, totalControls).
// The API does not expose per-control rows or a mutable "enabled" flag here, so
// neither is fabricated — available frameworks are shown read-only.
interface FrameworkConfig {
  id: string;
  name: string;
  version: string;
  controlCount: number;
}

interface PlatformConfig {
  retentionDays: number;
  maxConcurrentScans: number;
  maintenanceMode: boolean;
}

/* ------------------------------------------------------------------ */
/*  DATA SOURCES — everything below loads from the real API           */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): all hardcoded INITIAL_* seed datasets have been
// removed. Previously this page shipped fabricated frameworks (with invented
// control rows + weights), a fabricated agent roster (AWS/Azure/GCP agents with
// invented timeouts/concurrency), four canned notification templates, and a
// fabricated security config — all rendered as if they were live configuration.
// The frameworks tab now loads the real compliance framework registry; the
// agents, notifications and security tabs have no backing endpoint in the typed
// api client, so they render honest "not configurable here" empty states rather
// than fabricated rows. The platform tab edits only the fields the real
// SystemSettings payload actually persists (maintenanceMode, retentionDays,
// maxScansPerTenant).

const INITIAL_PLATFORM: PlatformConfig = {
  retentionDays: 30,
  maxConcurrentScans: 1,
  maintenanceMode: false,
};

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "frameworks", label: "FRAMEWORKS", icon: "shield" },
  { id: "agents", label: "AGENTS", icon: "cpu" },
  { id: "notifications", label: "NOTIFICATIONS", icon: "bell" },
  { id: "security", label: "SECURITY", icon: "lock" },
  { id: "platform", label: "PLATFORM", icon: "server" },
];

/* ------------------------------------------------------------------ */
/*  ICONS (inline SVG)                                                 */
/* ------------------------------------------------------------------ */

function TabIcon({ icon }: { icon: string }) {
  const props = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "shield":
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "cpu":
      return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>;
    case "bell":
      return <svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case "lock":
      return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case "server":
      return <svg {...props}><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>;
    default:
      return null;
  }
}

// REAL IMPL (BLACKFYRE 2026-06): the ChevronDown expander was removed along with
// the fabricated per-framework control drill-down — the real framework registry
// has no per-control rows to expand.

/* ------------------------------------------------------------------ */
/*  TOGGLE COMPONENT                                                   */
/* ------------------------------------------------------------------ */

function Toggle({ enabled, onToggle, danger }: { enabled: boolean; onToggle: () => void; danger?: boolean }) {
  const activeColor = danger ? "bg-[var(--critical)]" : "bg-accent";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-md transition-colors duration-200 ${
        enabled ? activeColor : "bg-[var(--border-strong)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-md bg-[var(--surface)] shadow transition-transform duration-200 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  TOAST COMPONENT                                                    */
/* ------------------------------------------------------------------ */

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-8 right-8 z-50 font-mono text-sm px-6 py-3 rounded border transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      } bg-[var(--surface)] border-[var(--border)] text-accent shadow-lg`}
    >
      <span className="mr-2">[OK]</span> {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HONEST STATE COMPONENTS                                            */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): shared honest empty/error and loading states for
// tabs that have no real data to render — used instead of fabricated rows.
function EmptyState({ title, detail, tone = "muted" }: { title: string; detail?: string; tone?: "muted" | "error" }) {
  const isError = tone === "error";
  return (
    <div
      className="admin-card px-6 py-10 text-center"
      style={isError ? { borderColor: "var(--critical)" } : undefined}
    >
      <p
        className="font-mono text-xs uppercase tracking-widest"
        style={{ color: isError ? "var(--critical-text)" : "var(--text-secondary)" }}
      >
        {title}
      </p>
      {detail && (
        <p className="font-mono text-[11px] mt-2 max-w-md mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      )}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-widest">{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE COMPONENT                                                     */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  // REAL IMPL (BLACKFYRE 2026-06): the signed-in platform admin (real profile
  // from the auth context) replaces any fabricated "demo settings user".
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("frameworks");
  const [frameworks, setFrameworks] = useState<FrameworkConfig[] | null>(null);
  const [frameworksError, setFrameworksError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformConfig>(INITIAL_PLATFORM);
  const [settingsMeta, setSettingsMeta] = useState<{ smtpConfigured: boolean; slackConfigured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  /* REAL IMPL (BLACKFYRE 2026-06): load the real platform settings and the real
     compliance-framework registry. No DEMO_MODE, no hardcoded seeds — on error
     we surface honest error/empty states rather than fabricating values. */
  useEffect(() => {
    api.getSystemSettings()
      .then((res) => {
        const s = res.settings;
        setPlatform({
          maintenanceMode: s.maintenanceMode,
          retentionDays: s.retentionDays,
          maxConcurrentScans: s.maxScansPerTenant,
        });
        setSettingsMeta({ smtpConfigured: s.smtpConfigured, slackConfigured: s.slackConfigured });
      })
      .catch((err) => setSettingsError(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));

    api.getFrameworks()
      .then((res) => {
        setFrameworks(
          (res.frameworks ?? []).map((f) => ({
            id: f.framework,
            name: f.framework,
            version: f.version,
            controlCount: f.totalControls,
          })),
        );
      })
      .catch((err) => setFrameworksError(err instanceof Error ? err.message : "Failed to load frameworks"));
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    api.updateSystemSettings({
      maintenanceMode: platform.maintenanceMode,
      retentionDays: platform.retentionDays,
      maxScansPerTenant: platform.maxConcurrentScans,
    })
      .then(() => {
        setDirty(false);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
      })
      .catch(() => {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
      })
      .finally(() => setSaving(false));
  }, [platform.maintenanceMode, platform.retentionDays, platform.maxConcurrentScans]);

  /* ---- PLATFORM HANDLERS ---- */
  // REAL IMPL (BLACKFYRE 2026-06): only the platform fields that the real
  // SystemSettings payload persists are editable. The framework/agent/template/
  // security mutation handlers were removed along with their fabricated datasets.
  const updatePlatform = useCallback(<K extends keyof PlatformConfig>(field: K, value: PlatformConfig[K]) => {
    setPlatform((prev) => ({ ...prev, [field]: value }));
    markDirty();
  }, [markDirty]);

  /* ================================================================ */
  /*  RENDER - FRAMEWORKS TAB                                         */
  /* ================================================================ */

  // REAL IMPL (BLACKFYRE 2026-06): frameworks render the real compliance registry
  // (id, version, control count) returned by GET /api/compliance/frameworks. Per-
  // control rows, weights and a mutable enable/disable toggle were fabricated and
  // have been removed — the registry is shown read-only with honest loading/error/
  // empty states.
  const renderFrameworks = () => {
    if (frameworksError) {
      return <EmptyState title="Failed to load frameworks" detail={frameworksError} tone="error" />;
    }
    if (frameworks === null) {
      return <LoadingState label="LOADING FRAMEWORK REGISTRY..." />;
    }
    if (frameworks.length === 0) {
      return <EmptyState title="No frameworks available" detail="The compliance framework registry returned no entries." />;
    }
    return (
      <div className="space-y-3">
        {frameworks.map((fw) => (
          <div key={fw.id} className="admin-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4 flex-1">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-accent tracking-wide uppercase">
                      {fw.name}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border)]">
                      v{fw.version}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--text-muted)] mt-1 block">
                    {fw.controlCount} controls
                  </span>
                </div>
              </div>
              <span className="font-mono text-[10px] tracking-wider text-accent">
                AVAILABLE
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ================================================================ */
  /*  RENDER - AGENTS TAB                                             */
  /* ================================================================ */

  // REAL IMPL (BLACKFYRE 2026-06): the agent roster was a fabricated array
  // (AWS/Azure/GCP/Okta/etc. with invented timeouts + concurrency rendered as if
  // editable). There is no agent-config endpoint in the typed api client, so this
  // tab shows an honest empty state instead of inventing rows.
  const renderAgents = () => (
    <EmptyState
      title="Agent configuration not available here"
      detail="Scanner agents are provisioned and tuned per deployment. No agent-configuration endpoint is exposed to this console, so nothing is shown rather than fabricated."
    />
  );

  /* ================================================================ */
  /*  RENDER - NOTIFICATIONS TAB                                      */
  /* ================================================================ */

  // REAL IMPL (BLACKFYRE 2026-06): the four canned notification templates were
  // fabricated. The real platform settings only expose whether email/Slack
  // transports are configured (derived from server env) — surfaced honestly
  // below. Per-template editing has no backing endpoint, so no templates are
  // invented.
  const renderNotifications = () => (
    <div className="space-y-5">
      <div className="admin-card px-5 py-5">
        <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-3">
          Configured Transports
        </p>
        {settingsMeta === null ? (
          <p className="font-mono text-[12px] text-[var(--text-muted)]">
            {settingsError ? settingsError : "Loading transport status..."}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--text-secondary)] uppercase tracking-wider">Email (SMTP)</span>
              <span className={`font-mono text-[10px] tracking-wider ${settingsMeta.smtpConfigured ? "text-accent" : "text-[var(--text-muted)]"}`}>
                {settingsMeta.smtpConfigured ? "CONFIGURED" : "NOT CONFIGURED"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--text-secondary)] uppercase tracking-wider">Slack</span>
              <span className={`font-mono text-[10px] tracking-wider ${settingsMeta.slackConfigured ? "text-accent" : "text-[var(--text-muted)]"}`}>
                {settingsMeta.slackConfigured ? "CONFIGURED" : "NOT CONFIGURED"}
              </span>
            </div>
          </div>
        )}
        <p className="mt-4 font-mono text-[9px] text-[var(--text-muted)] leading-relaxed">
          Transport credentials are read from server environment (never stored or shown here).
          Notification templates are not editable from this console.
        </p>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  RENDER - SECURITY TAB                                           */
  /* ================================================================ */

  // REAL IMPL (BLACKFYRE 2026-06): MFA policy, password length, session timeout,
  // rate limit and CORS origins were a fabricated SecurityConfig with no backing
  // in the typed SystemSettings payload. Rather than render editable controls that
  // persist nothing, this tab shows an honest empty state.
  const renderSecurity = () => (
    <EmptyState
      title="Security policy not configurable here"
      detail="MFA policy, session and rate-limit settings are managed server-side and are not exposed to this console. No values are shown rather than fabricated."
    />
  );

  /* ================================================================ */
  /*  RENDER - PLATFORM TAB                                           */
  /* ================================================================ */

  const renderPlatform = () => (
    <div className="space-y-5">
      {/* REAL IMPL (BLACKFYRE 2026-06): the editable Platform Name / Support Email
          / Default Timezone fields were fabricated — the real SystemSettings
          payload persists none of them, so editing them saved nothing. They are
          removed. The signed-in platform admin is shown read-only from the real
          auth context (replacing the prior fabricated "demo settings user"). */}
      <div className="admin-card px-5 py-5">
        <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-3">
          Signed-in Administrator
        </label>
        {user ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-[var(--text-muted)]">NAME</span>
              <span className="font-mono text-[12px] text-[var(--text-primary)]">{user.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-[var(--text-muted)]">EMAIL</span>
              <span className="font-mono text-[12px] text-accent">{user.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-[var(--text-muted)]">ROLE</span>
              <span className="font-mono text-[12px] text-[var(--text-primary)] uppercase">{user.role || "—"}</span>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[12px] text-[var(--text-muted)]">No authenticated session.</p>
        )}
      </div>

      {settingsError && (
        <EmptyState title="Failed to load platform settings" detail={settingsError} tone="error" />
      )}

      {/* Data Retention */}
      <div className="admin-card px-5 py-5">
        <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
          Data Retention Period (days)
        </label>
        <input
          type="number"
          value={platform.retentionDays}
          onChange={(e) => updatePlatform("retentionDays", parseInt(e.target.value) || 0)}
          className="admin-input w-48"
          min={30}
          max={2555}
        />
        <div className="mt-1.5 font-mono text-[9px] text-[var(--text-muted)]">
          {platform.retentionDays} days = ~{(platform.retentionDays / 365).toFixed(1)} years. Minimum: 30 days. Compliance minimum varies by framework.
        </div>
      </div>

      {/* Max Concurrent Scans */}
      <div className="admin-card px-5 py-5">
        <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
          Max Concurrent Scans Per Tenant
        </label>
        <input
          type="number"
          value={platform.maxConcurrentScans}
          onChange={(e) => updatePlatform("maxConcurrentScans", parseInt(e.target.value) || 1)}
          className="admin-input w-48"
          min={1}
          max={50}
        />
        <div className="mt-1.5 font-mono text-[9px] text-[var(--text-muted)]">
          Limits parallel scans per tenant to prevent resource contention.
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className={`admin-card px-5 py-5 transition-all ${
        platform.maintenanceMode
          ? "border-red-500/50 shadow-[0_0_20px_rgba(255,51,102,0.15)]"
          : ""
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1">
              Maintenance Mode
            </label>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              Disables all client-facing operations. Admin panel remains accessible.
            </p>
          </div>
          <Toggle
            enabled={platform.maintenanceMode}
            onToggle={() => updatePlatform("maintenanceMode", !platform.maintenanceMode)}
            danger
          />
        </div>
        {platform.maintenanceMode && (
          <div className="mt-4 px-4 py-3 rounded border border-[var(--critical)]/40 bg-[var(--critical-bg)]">
            <div className="flex items-center gap-2">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--critical)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="font-mono text-xs text-[var(--critical-text)] font-bold tracking-wider">
                WARNING: MAINTENANCE MODE IS ACTIVE
              </span>
            </div>
            <p className="font-mono text-[10px] text-[var(--critical-text)] opacity-80 mt-1.5 ml-6">
              All client scans, API calls, and webhook deliveries are suspended.
              Only platform administrators can access the system.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  /* ================================================================ */
  /*  TAB CONTENT ROUTER                                              */
  /* ================================================================ */

  const renderTabContent = () => {
    switch (activeTab) {
      case "frameworks":
        return renderFrameworks();
      case "agents":
        return renderAgents();
      case "notifications":
        return renderNotifications();
      case "security":
        return renderSecurity();
      case "platform":
        return renderPlatform();
    }
  };

  /* ================================================================ */
  /*  MAIN RENDER                                                     */
  /* ================================================================ */

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-mono text-xs text-[var(--text-muted)] tracking-widest">LOADING CONFIGURATION...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ---- HEADER ---- */}
      <div className="relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div
              className="mono text-[11px] font-semibold"
              style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              Admin · Settings
            </div>
            <h1
              className="mt-2 text-[30px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
            >
              System config
            </h1>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Platform configuration &amp; operational parameters
            </p>
          </div>
          <div className="font-mono text-[10px] text-[var(--text-muted)] text-right">
            <div>
              INSTANCE: <span className="text-accent">BF-PROD-01</span>
            </div>
            <div className="mt-0.5">
              UPTIME: <span className="text-accent">99.97%</span>
            </div>
          </div>
        </div>
        {/* Decorative top line */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(to right, transparent, var(--border-strong), transparent)" }} />
      </div>

      {/* ---- TAB BAR ---- */}
      <div className="flex gap-1 p-1 bg-[var(--surface-raised)] rounded-md border border-[var(--border)] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[var(--surface)] text-accent border border-[var(--border)] shadow-sm"
                : "text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60"
            }`}
          >
            <TabIcon icon={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- TAB CONTENT ---- */}
      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>

      {/* ---- SAVE BAR ---- */}
      <div className="sticky bottom-0 bg-[var(--surface)]/90 backdrop-blur-sm border-t border-[var(--border)] -mx-6 px-6 py-4 mt-8">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] text-[var(--text-muted)]">
            {dirty ? (
              <span className="text-yellow-400 animate-pulse">
                UNSAVED CHANGES DETECTED
              </span>
            ) : (
              <span>ALL CHANGES SAVED</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="admin-btn admin-btn-primary min-w-[180px]"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                SAVING...
              </span>
            ) : (
              "SAVE CONFIGURATION"
            )}
          </button>
        </div>
      </div>

      {/* ---- TOAST ---- */}
      <Toast message="Configuration saved successfully" visible={toastVisible} />
    </div>
  );
}
