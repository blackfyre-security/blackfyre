"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { BillingOverview } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type PlanType = "retainer" | "project" | "hourly" | "annual";
type PaymentStatus = "paid" | "overdue" | "pending";

interface BillingClient {
  id: string;
  name: string;
  plan: PlanType;
  monthlyRate: number;
  paymentStatus: PaymentStatus;
  lastInvoiceDate: string;
  nextDue: string;
}

interface PlanInfo {
  name: string;
  type: PlanType;
  basePrice: number;
  activeClients: number;
  totalRevenue: number;
}

interface MrrDataPoint {
  month: string;
  value: number;
}


/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatINRShort(amount: number): string {
  if (amount >= 10_00_000) return `${(amount / 10_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

function planColor(plan: PlanType | string): { text: string; border: string; bg: string } {
  const map: Record<string, { text: string; border: string; bg: string }> = {
    // Current SaaS tiers (DB enum)
    comply:   { text: "text-[var(--low-text)]",    border: "border-[var(--low-text)]/25",    bg: "bg-[var(--low-bg)]"    },
    protect:  { text: "text-accent",               border: "border-accent/25",               bg: "bg-accent/[0.08]"      },
    defend:   { text: "text-[var(--info-text)]",   border: "border-[var(--info-text)]/25",   bg: "bg-[var(--info-bg)]"   },
    // Legacy names (kept so older client records still render)
    retainer: { text: "text-accent",               border: "border-accent/25",               bg: "bg-accent/[0.08]"      },
    project:  { text: "text-[var(--low-text)]",    border: "border-[var(--low-text)]/25",    bg: "bg-[var(--low-bg)]"    },
    hourly:   { text: "text-[var(--medium-text)]", border: "border-[var(--medium-text)]/25", bg: "bg-[var(--medium-bg)]" },
    annual:   { text: "text-[var(--info-text)]",   border: "border-[var(--info-text)]/25",   bg: "bg-[var(--info-bg)]"   },
  };
  return map[plan] ?? { text: "text-[var(--text-muted)]", border: "border-[var(--border)]", bg: "bg-[var(--surface-2)]" };
}

function planBarColor(plan: PlanType | string): string {
  const map: Record<string, string> = {
    comply:   "var(--low-text)",
    protect:  "var(--accent)",
    defend:   "var(--info-text)",
    retainer: "var(--accent)",
    project:  "var(--low-text)",
    hourly:   "var(--medium-text)",
    annual:   "var(--info-text)",
  };
  return map[plan] ?? "var(--text-muted)";
}

function statusStyle(status: PaymentStatus | string | undefined): { dot: string; text: string; label: string } {
  const map: Record<string, { dot: string; text: string; label: string }> = {
    paid:        { dot: "bg-accent",                              text: "text-accent",                    label: "PAID"     },
    overdue:     { dot: "bg-[var(--critical)] animate-pulse",     text: "text-[var(--critical-text)]",    label: "OVERDUE"  },
    pending:     { dot: "bg-[var(--medium)]",                     text: "text-[var(--medium-text)]",      label: "PENDING"  },
    // Tenant onboardingStatus values that get returned in the client list
    active:      { dot: "bg-accent",                              text: "text-accent",                    label: "ACTIVE"   },
    configuring: { dot: "bg-[var(--medium)]",                     text: "text-[var(--medium-text)]",      label: "SETUP"    },
    scanning:    { dot: "bg-[var(--info)]",                       text: "text-[var(--info-text)]",        label: "SCANNING" },
    suspended:   { dot: "bg-[var(--critical)]",                   text: "text-[var(--critical-text)]",    label: "SUSPENDED"},
  };
  return map[status ?? ""] ?? { dot: "bg-[var(--text-muted)]", text: "text-[var(--text-muted)]", label: String(status ?? "UNKNOWN").toUpperCase() };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE COMPONENT                                                */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): the fabricated billing dataset (₹425k MRR,
// per-client invoices naming real companies, an invented MRR growth trend and
// plan revenue) and the DEMO_MODE bypass have been removed. Billing is sourced
// only from the live API (api.getBillingStats). Empty/error states are honest.

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [mrrTrend, setMrrTrend] = useState<MrrDataPoint[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceClient, setInvoiceClient] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoicePeriod, setInvoicePeriod] = useState("March 2026");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceSent, setInvoiceSent] = useState(false);

  // REAL IMPL (BLACKFYRE 2026-06): always load billing from the live API. No
  // demo bypass, no fabricated revenue figures.
  useEffect(() => {
    Promise.all([api.getBillingStats()])
      .then(([res]) => {
        const d = res as any;
        const billingData: BillingOverview = d.billing ?? d ?? {
          totalMRR: 0, activeSubscriptions: 0, churnRate: 0, avgRevenuePerClient: 0,
        };
        setBilling(billingData);
        setClients(d.clients ?? []);
        setMrrTrend(d.mrrTrend ?? d.mrr_trend ?? []);
        setPlans(d.plans ?? []);
        setIsLive(true);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>;
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load: {error}</div>;

  const mrr = billing?.totalMRR ?? 0;
  const arr = mrr * 12;
  const activeClients = billing?.activeSubscriptions ?? 0;
  const avgRPC = billing?.avgRevenuePerClient ?? 0;

  /* MRR chart calculations */
  const mrrMax = Math.max(...mrrTrend.map((d) => d.value));

  /* Revenue breakdown */
  const totalPlanRevenue = plans.reduce((s, p) => s + p.totalRevenue, 0);

  // REAL IMPL (BLACKFYRE 2026-06): the admin API does not yet expose an invoice
  // dispatch endpoint. The previous handler faked success ("INVOICE DISPATCHED
  // · logged to audit trail") without sending anything — a fabricated
  // security/audit event. We keep the local "acknowledged" state but the UI now
  // states honestly that no invoice was actually dispatched. No fake audit log.
  function handleSendInvoice() {
    setInvoiceSent(true);
    setTimeout(() => {
      setShowInvoiceModal(false);
      setInvoiceSent(false);
      setInvoiceClient("");
      setInvoiceAmount("");
      setInvoicePeriod("March 2026");
      setInvoiceNotes("");
    }, 1500);
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ---- HEADER ---- */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="mono text-[11px] font-semibold"
            style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Admin · Billing
          </div>
          <div className="flex items-center gap-3 mt-2">
            <h1
              className="text-[30px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
            >
              Revenue command
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded-md border ${
                isLive
                  ? "text-accent border-accent/30 bg-accent/[0.05]"
                  : "text-[var(--medium-text)] border-[var(--medium-text)]/30 bg-[var(--medium-bg)]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? "bg-accent animate-pulse" : "bg-[var(--medium)]"
                }`}
              />
              {isLive ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Billing overview · plan management · invoice generation
          </p>
        </div>
        <button
          onClick={() => setShowInvoiceModal(true)}
          className="admin-btn admin-btn-primary gap-2"
        >
          <span className="text-sm">$</span>
          GENERATE INVOICE
        </button>
      </div>

      {/* ---- REVENUE STATS (4 cards) ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RevenueCard label="MONTHLY RECURRING REVENUE" value={formatINR(mrr)} accent="var(--accent)" />
        <RevenueCard label="ANNUAL RUN RATE" value={formatINR(arr)} accent="var(--low-text)" />
        <RevenueCard label="ACTIVE CLIENTS" value={String(activeClients)} accent="var(--info-text)" />
        <RevenueCard label="AVG REVENUE / CLIENT" value={formatINR(avgRPC)} accent="var(--medium-text)" />
      </div>

      {/* ---- MRR TREND + REVENUE BREAKDOWN ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* MRR Trend Chart */}
        <div className="card p-4 relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase">
              MRR TREND -- LAST 6 MONTHS
            </h3>
            <span className="font-mono text-[10px] text-accent/60">
              {mrrTrend.length >= 2
                ? `+${(((mrrTrend[mrrTrend.length - 1].value - mrrTrend[0].value) / (mrrTrend[0].value || 1)) * 100).toFixed(1)}% GROWTH`
                : "—"}
            </span>
          </div>
          <div className="flex items-end gap-2 h-40">
            {mrrTrend.map((d, i) => {
              const heightPct = (d.value / mrrMax) * 100;
              const isLatest = i === mrrTrend.length - 1;
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="font-mono text-[9px] text-[var(--text-muted)]">
                    {formatINRShort(d.value)}
                  </span>
                  <div className="w-full flex justify-center" style={{ height: "120px" }}>
                    <div className="w-full max-w-[40px] flex items-end h-full">
                      <div
                        className="w-full rounded-t transition-all duration-700"
                        style={{
                          height: `${heightPct}%`,
                          background: isLatest
                            ? "linear-gradient(to top, var(--accent-muted), var(--accent))"
                            : "linear-gradient(to top, rgba(0,255,136,0.08), rgba(0,255,136,0.3))",
                          boxShadow: isLatest
                            ? "0 0 12px rgba(0,255,136,0.4)"
                            : "none",
                        }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-[var(--text-muted)] whitespace-nowrap">
                    {d.month}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Baseline grid lines */}
          <div className="absolute left-4 right-4 top-[4.5rem] flex flex-col justify-between h-[120px] pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-full border-t border-dashed border-accent/[0.06]" />
            ))}
          </div>
        </div>

        {/* Revenue Breakdown by Plan */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase">
              REVENUE BREAKDOWN BY PLAN
            </h3>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              TOTAL {formatINR(totalPlanRevenue)}
            </span>
          </div>
          <div className="space-y-4">
            {plans.map((p) => {
              const pct = totalPlanRevenue > 0 ? (p.totalRevenue / totalPlanRevenue) * 100 : 0;
              const barColor = planBarColor(p.type);
              return (
                <div key={p.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: barColor }}
                      />
                      <span className="font-mono text-xs text-[var(--text-primary)] tracking-wider">
                        {p.name.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {p.activeClients} client{p.activeClients !== 1 ? "s" : ""}
                      </span>
                      <span className="font-mono text-xs font-bold" style={{ color: barColor }}>
                        {formatINR(p.totalRevenue)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-md bg-[var(--surface-raised)] overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        opacity: 0.7,
                        boxShadow: `0 0 8px ${barColor}40`,
                      }}
                    />
                  </div>
                  <div className="text-right mt-0.5">
                    <span className="font-mono text-[9px] text-[var(--text-muted)]">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- CLIENT BILLING TABLE ---- */}
      <div className="card overflow-hidden relative">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-heading text-xs font-bold text-accent tracking-widest">
            CLIENT BILLING LEDGER
          </h3>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {clients.length} ACTIVE ACCOUNTS
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">Client</th>
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">Plan</th>
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase text-right">Monthly Rate</th>
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">Payment Status</th>
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">Last Invoice</th>
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">Next Due</th>
                <th className="px-4 py-2.5 font-mono text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const pc = planColor(c.plan);
                const ss = statusStyle(c.paymentStatus);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--border)] transition-all duration-200 hover:bg-[var(--hover-bg)] group"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs group-hover:text-accent transition-colors" style={{ color: "var(--text-primary)" }}>
                        {c.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${pc.text} ${pc.border} ${pc.bg}`}>
                        {c.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-mono text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        {formatINR(c.monthlyRate)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${ss.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {formatDate(c.lastInvoiceDate)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {formatDate(c.nextDue)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setInvoiceClient(c.name);
                            setInvoiceAmount(String(c.monthlyRate));
                            setShowInvoiceModal(true);
                          }}
                          className="font-mono text-[10px] px-2.5 py-1 rounded border transition-all"
                          style={{ borderColor: "var(--border)", color: "var(--accent)", background: "var(--accent-subtle)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-bg)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-subtle)"; }}
                        >
                          INVOICE
                        </button>
                        <button className="font-mono text-[10px] px-2.5 py-1 rounded border border-[var(--medium-text)]/20 text-[var(--medium-text)] bg-[var(--medium-bg)] hover:border-[var(--medium-text)]/40 transition-all">
                          ADJUST
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Table summary footer */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface-raised)]">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              PAID: <span className="text-[var(--accent)]">{clients.filter((c) => c.paymentStatus === "paid").length}</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              PENDING: <span className="text-[var(--medium-text)]">{clients.filter((c) => c.paymentStatus === "pending").length}</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              OVERDUE: <span className="text-[var(--critical-text)]">{clients.filter((c) => c.paymentStatus === "overdue").length}</span>
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-accent">
            TOTAL MRR: {formatINR(clients.reduce((s, c) => s + c.monthlyRate, 0))}
          </span>
        </div>
      </div>

      {/* ---- PLAN MANAGEMENT ---- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-xs font-bold text-accent tracking-widest">
            PLAN MANAGEMENT
          </h3>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {plans.length} ACTIVE PLANS
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <PlanCard key={p.type} plan={p} />
          ))}
        </div>
      </div>

      {/* ---- COLLECTION SUMMARY ---- */}
      <div className="card p-4">
        <h3 className="font-heading text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3">
          COLLECTION PIPELINE
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CollectionCard
            label="COLLECTED THIS MONTH"
            value={formatINR(clients.filter((c) => c.paymentStatus === "paid").reduce((s, c) => s + c.monthlyRate, 0))}
            color="var(--accent)"
            icon="^"
          />
          <CollectionCard
            label="PENDING COLLECTION"
            value={formatINR(clients.filter((c) => c.paymentStatus === "pending").reduce((s, c) => s + c.monthlyRate, 0))}
            color="var(--medium-text)"
            icon="~"
          />
          <CollectionCard
            label="OVERDUE AMOUNT"
            value={formatINR(clients.filter((c) => c.paymentStatus === "overdue").reduce((s, c) => s + c.monthlyRate, 0))}
            color="var(--critical)"
            icon="!"
          />
        </div>
      </div>

      {/* ---- INVOICE GENERATION MODAL ---- */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => {
              if (!invoiceSent) {
                setShowInvoiceModal(false);
              }
            }}
          />
          {/* Modal */}
          <div className="relative card p-6 w-full max-w-md mx-4 border border-[var(--border)]">
            {/* top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading text-sm font-bold text-accent tracking-widest">
                GENERATE INVOICE
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="font-mono text-[var(--text-muted)] hover:text-[var(--critical-text)] transition-colors text-lg leading-none"
              >
                x
              </button>
            </div>

            {invoiceSent ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-md border-2 flex items-center justify-center" style={{ borderColor: "var(--medium)" }}>
                  <span className="font-mono text-xl" style={{ color: "var(--medium-text)" }}>!</span>
                </div>
                <p className="font-mono text-sm tracking-wider" style={{ color: "var(--medium-text)" }}>
                  INVOICE NOT SENT
                </p>
                <p className="font-mono text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
                  Automated invoice dispatch is not yet available.
                  <br />Generate the invoice from your billing system.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Client select */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider block mb-1.5">
                    CLIENT
                  </label>
                  <select
                    value={invoiceClient}
                    onChange={(e) => {
                      setInvoiceClient(e.target.value);
                      const match = clients.find((c) => c.name === e.target.value);
                      if (match) setInvoiceAmount(String(match.monthlyRate));
                    }}
                    className="admin-input"
                    style={{ appearance: "none" }}
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider block mb-1.5">
                    AMOUNT (INR)
                  </label>
                  <input
                    type="number"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="admin-input"
                  />
                  {invoiceAmount && (
                    <span className="font-mono text-[9px] text-[var(--text-muted)] mt-1 block">
                      {formatINR(Number(invoiceAmount))}
                    </span>
                  )}
                </div>

                {/* Period */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider block mb-1.5">
                    BILLING PERIOD
                  </label>
                  <input
                    type="text"
                    value={invoicePeriod}
                    onChange={(e) => setInvoicePeriod(e.target.value)}
                    placeholder="e.g. March 2026"
                    className="admin-input"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider block mb-1.5">
                    NOTES
                  </label>
                  <textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={3}
                    className="admin-input resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSendInvoice}
                    disabled={!invoiceClient || !invoiceAmount}
                    className="admin-btn admin-btn-primary flex-1"
                  >
                    DISPATCH INVOICE
                  </button>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    className="admin-btn admin-btn-ghost flex-1"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUB-COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

function RevenueCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="card hover:shadow-md transition-shadow px-4 py-4 flex flex-col justify-between gap-1 relative overflow-hidden"
      style={{ borderLeftWidth: "2px", borderLeftColor: accent }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom right, ${accent}08, transparent)`,
        }}
      />
      <p className="font-mono text-2xl font-bold relative" style={{ color: accent }}>
        {value}
      </p>
      <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider relative">
        {label}
      </p>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanInfo }) {
  const pc = planColor(plan.type);
  const barColor = planBarColor(plan.type);

  return (
    <div className="card hover:shadow-md transition-shadow p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom right, ${barColor}06, transparent)`,
        }}
      />
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${pc.text} ${pc.border} ${pc.bg} font-bold tracking-wider`}>
          {plan.name.toUpperCase()}
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>
      {/* Stats */}
      <div className="space-y-2 relative">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)]">BASE PRICE</span>
          <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
            {formatINR(plan.basePrice)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)]">ACTIVE CLIENTS</span>
          <span className="font-mono text-sm font-bold" style={{ color: barColor }}>
            {plan.activeClients}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)]">TOTAL REVENUE</span>
          <span className="font-mono text-sm font-bold" style={{ color: barColor }}>
            {formatINR(plan.totalRevenue)}
          </span>
        </div>
      </div>
      {/* Revenue bar */}
      <div className="w-full h-1 rounded-md bg-[var(--surface-raised)] overflow-hidden mt-3 relative">
        <div
          className="h-full rounded-md transition-all duration-1000"
          style={{
            width: `${(plan.totalRevenue / 8_00_000) * 100}%`,
            backgroundColor: barColor,
            opacity: 0.6,
            boxShadow: `0 0 6px ${barColor}40`,
          }}
        />
      </div>
      {/* Edit button */}
      <button
        className="w-full mt-3 font-mono text-[10px] py-1.5 rounded border transition-all relative"
        style={{
          color: barColor,
          borderColor: `${barColor}30`,
          backgroundColor: `${barColor}05`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${barColor}60`;
          e.currentTarget.style.backgroundColor = `${barColor}12`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `${barColor}30`;
          e.currentTarget.style.backgroundColor = `${barColor}05`;
        }}
      >
        EDIT PLAN
      </button>
    </div>
  );
}

function CollectionCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-md border p-3 flex items-center gap-3"
      style={{
        borderColor: `${color}20`,
        backgroundColor: `${color}05`,
      }}
    >
      <div
        className="w-8 h-8 rounded-md border flex items-center justify-center font-mono text-sm shrink-0"
        style={{
          borderColor: `${color}30`,
          backgroundColor: `${color}10`,
          color: color,
        }}
      >
        {icon}
      </div>
      <div>
        <p className="font-mono text-sm font-bold" style={{ color }}>
          {value}
        </p>
        <p className="font-mono text-[9px] text-[var(--text-muted)] tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}
