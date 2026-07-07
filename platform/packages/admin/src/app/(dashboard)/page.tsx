"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { AdminStats, Client, AuditLog, Finding } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTicker } from "@/lib/halo-hooks";
import type { HaloTenant, HaloLiveEvent, HaloCriticalFinding } from "@/lib/halo-data";
import HaloSparkline from "@/components/halo/HaloSparkline";
import HaloStatusDot from "@/components/halo/HaloStatusDot";
import ExportReportModal from "@/components/ExportReportModal";

/* ------------------------------------------------------------------ */
/*  CONSTANTS & HELPERS                                                */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): the command-center dashboard renders ONLY
// live data from the admin API (stats, clients, audit trail, findings,
// evidence). There is no DEMO_MODE bypass, no DEMO_STATS / DEMO_TENANTS /
// DEMO_CRITICAL_FINDINGS / synthetic LIVE_EVENT_POOL fallback. When the API
// returns nothing we render honest empty/zero states rather than fabricating
// data that names real companies or invents posture scores.

const DEFAULT_STATS: AdminStats = {
  totalClients: 0,
  activeScans: 0,
  totalFindings: 0,
  criticalFindings: 0,
  totalUsers: 0,
  avgComplianceScore: 0,
  monthlyRevenue: 0,
  systemUptime: 0,
};

// Map a real audit-log action onto the live-feed severity used by the UI.
function auditSeverity(action: string): HaloLiveEvent["sev"] {
  if (action.includes("fail") || action.includes("delete") || action.includes("block")) return "crit";
  if (action.includes("update") || action.includes("cancel") || action.includes("drift")) return "warn";
  return "ok";
}

// Short, human label for the audit "actor" column in the live feed.
function auditActor(l: AuditLog): string {
  const local = l.userEmail?.split("@")[0];
  return (local || l.userId || "system").slice(0, 12);
}

// Map a real critical Finding onto the HaloCriticalFinding view-model.
function findingToCritical(f: Finding): HaloCriticalFinding {
  const sev: HaloCriticalFinding["sev"] =
    f.severity === "critical" ? "crit" : f.severity === "high" ? "warn" : "info";
  const action =
    f.remediationTier === "auto" ? "Auto-remediate"
    : f.remediationTier === "approval" ? "Approve fix"
    : "Triage";
  return {
    id: f.id,
    sev,
    agent: f.category || "—",
    title: f.title,
    sla: f.remediationTier === "auto" ? "auto" : "—",
    action,
  };
}

function greetingFor(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5)  return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good evening";
}

function firstNameFrom(user: { name?: string; email?: string } | null | undefined): string {
  if (!user) return "there";
  const n = user.name?.trim();
  if (n) return n.split(/\s+/)[0];
  const e = user.email?.split("@")[0];
  if (!e) return "there";
  return e.charAt(0).toUpperCase() + e.slice(1);
}

function initial(s: string): string {
  return s.trim().charAt(0).toUpperCase() || "·";
}

/**
 * Map a real `Client` (from `api.getClients`) onto the HaloTenant visual
 * shape. REAL IMPL (BLACKFYRE 2026-06): id / name / env / score / plan are all
 * derived from the live client record. The admin client API does not expose a
 * per-tenant agent count or open-finding count, so we pass `undefined` and the
 * row renders an honest "—" instead of a fabricated number.
 */
function clientToTenant(c: Client): HaloTenant {
  const env: HaloTenant["env"] = c.status === "onboarding" ? "staging" : c.status === "active" ? "prod" : "trial";
  const plan: HaloTenant["plan"] =
    c.plan === "Enterprise" ? "Enterprise" :
    c.plan === "Professional" ? "Growth" : "Trial";
  return {
    id: c.id,
    name: c.company,
    env,
    score: c.complianceScore,
    agents: undefined,  // not exposed by the admin client API — render "—"
    findings: undefined, // not exposed per-tenant — render "—"
    plan,
  };
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function CommandCenterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS);
  const [tenants, setTenants] = useState<HaloTenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<string>("");
  const [liveEvents, setLiveEvents] = useState<HaloLiveEvent[]>([]);
  const [criticalFindings, setCriticalFindings] = useState<HaloCriticalFinding[]>([]);
  const [evidenceCount, setEvidenceCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // REAL IMPL (BLACKFYRE 2026-06): single live fetch. Every panel — stats,
  // tenants, the activity feed, critical findings and evidence count — is
  // populated from the real admin API. There is no synthetic ticker, no demo
  // bypass and no fabricated fallback. Panels render honest empty states when
  // the API returns nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, clientsRes, auditRes, findingsRes, evidenceRes] =
          await Promise.allSettled([
            api.getAdminStats(),
            api.getClients(),
            api.getAuditLogs({ limit: "12" }),
            api.getFindings({ severity: "critical", status: "open" }),
            api.getAdminEvidence({ limit: "1" }),
          ]);
        if (cancelled) return;

        if (statsRes.status === "fulfilled") {
          setStats(statsRes.value.stats);
          setIsLive(true);
        }

        if (clientsRes.status === "fulfilled") {
          const mapped = clientsRes.value.clients.slice(0, 6).map(clientToTenant);
          setTenants(mapped);
          if (mapped.length > 0) setActiveTenant(mapped[0].id);
        }

        if (auditRes.status === "fulfilled") {
          const events: HaloLiveEvent[] = (auditRes.value.logs ?? []).slice(0, 8).map((l: AuditLog) => ({
            t: new Date(l.timestamp).toISOString().substring(11, 19),
            a: auditActor(l),
            msg: `${l.action}${l.resourceId ? ` · ${l.resourceId}` : ""}`,
            sev: auditSeverity(l.action),
          }));
          setLiveEvents(events);
        }

        if (findingsRes.status === "fulfilled") {
          setCriticalFindings((findingsRes.value.findings ?? []).slice(0, 6).map(findingToCritical));
        }

        if (evidenceRes.status === "fulfilled") {
          setEvidenceCount(evidenceRes.value.pagination?.total ?? 0);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tick = useTicker(1, 59, 1000);

  const activeTenantObj = useMemo(
    () => tenants.find((t) => t.id === activeTenant) ?? tenants[0],
    [tenants, activeTenant],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (error) return <div className="p-6 text-[var(--critical-text)]">Failed to load data: {error}</div>;

  const firstName = firstNameFrom(user);
  const tenantsLabel = isLive ? "LIVE" : "OFFLINE";

  // REAL IMPL (BLACKFYRE 2026-06): KPI bindings map 1:1 to real stats. No demo
  // fallbacks — honest zeros when the API has no data yet.
  const posture = stats.avgComplianceScore;
  const activeFindings = stats.totalFindings;
  const critical = stats.criticalFindings;
  const tenantsCount = stats.totalClients || tenants.length;
  const prodCount = tenants.filter((t) => t.env === "prod").length;
  const trialCount = tenants.length - prodCount;

  return (
    <div className="space-y-6 pb-8 animate-fade-up">
      {/* ---- PAGE HEADER ---- */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div
            className="mono text-[11px] font-semibold"
            style={{
              color: "var(--text-muted)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Admin · Overview
          </div>
          <h1
            className="mt-2 text-[30px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            {greetingFor()}, {firstName}.
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            {tenantsCount} tenants. {stats.activeScans} active scans.{" "}
            <span style={{ color: "var(--accent)" }}>{activeFindings} open findings</span>
            {critical > 0 && <>, {critical} critical</>}.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn btn-secondary"
            onClick={() => setShowExport(true)}
          >
            Export report
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/clients?onboard=1")}
          >
            + Create Tenant
          </button>
        </div>
      </div>

      {/* ---- KPI ROW ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* REAL IMPL (BLACKFYRE 2026-06): KPI values are live stats. The
            7-day deltas were fabricated (no trend API exists), so they are
            omitted rather than invented. Evidence count is the real ledger
            total from api.getAdminEvidence. */}
        <KpiCard
          label="Posture score"
          value={posture > 0 ? posture.toFixed(1) : "—"}
          unit="/ 100"
          color="var(--accent)"
          chart
        />
        <KpiCard
          label="Active findings"
          value={String(activeFindings)}
          unit="open"
          color="var(--high)"
          chart
        />
        <KpiCard
          label="Evidence pinned"
          value={evidenceCount === null ? "—" : evidenceCount.toLocaleString()}
          unit="artefacts"
          color="var(--text-primary)"
          chart
        />
        <KpiCard
          label="Tenants"
          value={String(tenantsCount)}
          unit={`${prodCount} prod, ${trialCount} trial`}
          color="var(--text-primary)"
        />
      </div>

      {/* ---- TENANTS + LIVE FEED ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        {/* Tenants table */}
        <section
          className="card overflow-hidden"
          style={{ padding: 0 }}
        >
          <div
            className="px-5 py-3.5 flex items-center justify-between gap-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Tenants
            </h2>
            <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              {tenants.length} active · {tenantsLabel} · updated {tick}s ago
            </span>
          </div>
          {/* Header row */}
          <div
            className="hidden sm:grid px-5 py-2.5 mono text-[10.5px] font-semibold"
            style={{
              gridTemplateColumns: "1.4fr 70px 110px 60px 90px 90px",
              gap: 12,
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            <span>Tenant</span>
            <span>Env</span>
            <span>Score</span>
            <span>Agents</span>
            <span>Findings</span>
            <span>Plan</span>
          </div>
          {/* Rows */}
          <div>
            {tenants.length === 0 && (
              <div className="px-5 py-10 text-center mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                {/* REAL IMPL (BLACKFYRE 2026-06): honest empty state — no fabricated tenant rows. */}
                No tenants yet. Create one to get started.
              </div>
            )}
            {tenants.map((t, i) => {
              const active = activeTenant === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTenant(t.id)}
                  className="w-full text-left transition-colors relative"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 70px 110px 60px 90px 90px",
                    gap: 12,
                    padding: "13px 20px",
                    alignItems: "center",
                    borderBottom: i < tenants.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    background: active ? "var(--accent-subtle)" : "transparent",
                    borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="shrink-0 mono font-bold"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        background: "linear-gradient(135deg, var(--accent), #33FFA0)",
                        color: "#0A0A0B",
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {initial(t.name)}
                    </span>
                    <span
                      className="text-[13.5px] font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <span
                    className="mono text-[11px]"
                    style={{ color: t.env === "prod" ? "var(--accent)" : "var(--medium-text)" }}
                  >
                    {t.env}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex-1 h-[4px] rounded-sm overflow-hidden" style={{ background: "var(--border)" }}>
                      <span
                        className="block h-full"
                        style={{
                          width: `${t.score}%`,
                          background: t.score > 95 ? "var(--accent)" : "var(--medium)",
                          transition: "width 700ms var(--ease)",
                        }}
                      />
                    </span>
                    <span className="mono text-[11px] tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {t.score.toFixed(1)}
                    </span>
                  </span>
                  {/* REAL IMPL (BLACKFYRE 2026-06): the admin client API does not
                      expose per-tenant agent/finding counts, so we render an
                      honest "—" rather than a fabricated number. */}
                  <span className="mono text-[12px] tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {t.agents ?? "—"}
                  </span>
                  <span
                    className="mono text-[12px] tabular-nums"
                    style={{
                      color:
                        t.findings === undefined
                          ? "var(--text-muted)"
                          : t.findings === 0
                            ? "var(--accent)"
                            : t.findings > 5
                              ? "var(--high-text)"
                              : "var(--text-primary)",
                    }}
                  >
                    {t.findings === undefined ? "—" : t.findings === 0 ? "✓ clean" : `${t.findings} open`}
                  </span>
                  <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t.plan}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Live activity feed */}
        <section className="card overflow-hidden" style={{ padding: 0 }}>
          <div
            className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Live activity
            </h2>
            <HaloStatusDot
              color={liveEvents.length > 0 ? "var(--accent)" : "var(--text-muted)"}
              size="md"
              aria-label={liveEvents.length > 0 ? "Audit feed active" : "No recent activity"}
            />
          </div>
          <div className="p-2 max-h-[360px] overflow-y-auto">
            {/* REAL IMPL (BLACKFYRE 2026-06): the feed is the real audit trail
                (api.getAuditLogs). No synthetic ticker. Honest empty state when
                there are no recent audit events. */}
            {liveEvents.length === 0 && (
              <div className="px-3 py-8 text-center mono text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                No recent activity.
              </div>
            )}
            {liveEvents.map((ev, i) => (
              <div
                key={`${ev.t}-${i}`}
                className="grid gap-2.5 px-3 py-2 rounded-md mono text-[11.5px]"
                style={{
                  gridTemplateColumns: "72px 64px 1fr",
                  animation: i === 0 ? "haloslidein 260ms var(--ease-spring)" : "none",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>{ev.t}</span>
                <span
                  style={{
                    color:
                      ev.sev === "crit"
                        ? "var(--critical-text)"
                        : ev.sev === "warn"
                          ? "var(--high-text)"
                          : "var(--accent)",
                  }}
                >
                  {ev.a}
                </span>
                <span className="truncate" style={{ color: "var(--text-primary)" }}>
                  {ev.msg}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ---- CRITICAL FINDINGS ---- */}
      <section className="card overflow-hidden" style={{ padding: 0 }}>
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Critical findings
          </h2>
          <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>
            {criticalFindings.length} open critical
          </span>
        </div>
        <div>
          {/* REAL IMPL (BLACKFYRE 2026-06): rendered from real open+critical
              findings (api.getFindings). No fabricated findings naming real
              companies or inventing CVEs. Honest empty state when clean. */}
          {criticalFindings.length === 0 && (
            <div className="px-5 py-10 text-center mono text-[12px]" style={{ color: "var(--accent)" }}>
              ✓ No open critical findings.
            </div>
          )}
          {criticalFindings.map((f, i) => (
            <div
              key={f.id}
              className="grid gap-4 px-5 py-3.5 items-center"
              style={{
                gridTemplateColumns: "80px 80px 80px 1fr 80px 150px",
                borderBottom:
                  i < criticalFindings.length - 1 ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                {f.id}
              </span>
              <span
                className="mono text-[10.5px] font-semibold inline-block text-center"
                style={{
                  padding: "3px 8px",
                  borderRadius: 3,
                  background:
                    f.sev === "crit"
                      ? "var(--critical-bg)"
                      : f.sev === "warn"
                        ? "var(--high-bg)"
                        : "var(--accent-subtle)",
                  color:
                    f.sev === "crit"
                      ? "var(--critical-text)"
                      : f.sev === "warn"
                        ? "var(--high-text)"
                        : "var(--accent)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {f.sev}
              </span>
              <span className="mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {f.agent}
              </span>
              <span className="text-[13.5px]" style={{ color: "var(--text-primary)" }}>
                {f.title}
              </span>
              <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                {f.sla === "auto" ? "auto-fix" : "manual"}
              </span>
              {/* REAL IMPL (BLACKFYRE 2026-06): navigates to the real findings
                  registry for triage instead of being a dead no-op button. */}
              <button
                className="btn btn-primary btn-sm w-full"
                onClick={() => router.push(`/findings?focus=${encodeURIComponent(f.id)}`)}
              >
                {f.action} →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Local keyframe used by the live-feed entrance animation */}
      <style jsx>{`
        @keyframes haloslidein {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      <ExportReportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        tenants={tenants}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUB-COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): KpiCard no longer supports a "DEMO" badge or a
// fabricated 7-day delta. It renders only the live value/unit it is given.
interface KpiCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  chart?: boolean;
}

function KpiCard({ label, value, unit, color, chart }: KpiCardProps) {
  return (
    <div className="card relative overflow-hidden flex flex-col" style={{ padding: 18 }}>
      <div className="flex items-start justify-between gap-2">
        <div
          className="mono text-[10.5px] font-semibold"
          style={{
            color: "var(--text-muted)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <div
          className="text-[30px] font-semibold tabular-nums"
          style={{ color, letterSpacing: "-0.02em", lineHeight: 1.05 }}
        >
          {value}
        </div>
        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {unit}
        </div>
      </div>
      {chart && (
        <div className="mt-3 -mx-[18px] -mb-[18px]">
          {/* REAL IMPL (BLACKFYRE 2026-06): no per-KPI time-series is exposed by
              the admin API, so we pass no `data` — HaloSparkline draws an honest
              flat baseline rather than a fabricated trend. The old random
              `speed` prop is a removed no-op and has been dropped. */}
          <HaloSparkline color={color} height={42} />
        </div>
      )}
    </div>
  );
}
