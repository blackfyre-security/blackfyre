import { ShieldCheck } from "lucide-react";

/* ── Perf-style bar chart (framework posture) ───────────────────────────── */
function PostureChart() {
  const bars = [
    { h: "40%", c: "bg-zinc-850" },
    { h: "62%", c: "bg-zinc-800" },
    { h: "48%", c: "bg-blue-500/30" },
    { h: "92%", c: "bg-blue-500" },
    { h: "70%", c: "bg-zinc-850" },
  ];
  return (
    <div className="rounded-lg border border-zinc-900 bg-zinc-900/10 p-2.5">
      <p className="mb-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-zinc-500">
        Framework posture
      </p>
      <div className="flex h-10 items-end gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className={`flex-1 rounded-sm ${b.c}`} style={{ height: b.h }} />
        ))}
      </div>
    </div>
  );
}

/* ── Dashboard window (compliance console) ──────────────────────────────── */
export function DashboardMockup() {
  const tiles = [
    { label: "Frameworks", value: "9", status: "Scored", color: "text-emerald-400" },
    { label: "Auditors", value: "55", status: "Read-only", color: "text-blue-400" },
    { label: "Evidence", value: "SHA-256", status: "Object Lock", color: "text-purple-400" },
  ];
  return (
    <div aria-hidden className="absolute z-10 w-[360px] -translate-y-4 rounded-2xl border border-zinc-800 bg-[#0c0c10] p-3 shadow-2xl transition-transform duration-500 ease-out hover:-translate-y-6 sm:w-[450px]">
      {/* titlebar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="ml-1.5 h-2 w-2 rounded-full bg-yellow-500" />
          <span className="ml-1.5 h-2 w-2 rounded-full bg-green-500" />
          <span className="ml-3 font-mono text-[9px] text-zinc-500">blackfyre.tech/app</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
          <span className="font-mono text-[8px] text-zinc-400">LIVE SCAN</span>
        </div>
      </div>
      {/* body */}
      <div className="mt-3 space-y-4 text-white">
        <div className="space-y-3 rounded-xl border border-zinc-900/60 bg-[#060608] p-3 text-[10px]">
          <div className="flex justify-between border-b border-zinc-900/50 pb-2 font-semibold text-zinc-400">
            <span>COMPLIANCE POSTURE</span>
            <span className="font-mono text-blue-500">678 CONTROLS MAPPED</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-zinc-800/35 bg-zinc-900/40 p-2">
                <p className="font-mono text-[8px] uppercase text-zinc-500">{t.label}</p>
                <p className="mt-0.5 text-xs font-bold text-white">{t.value}</p>
                <p className={`mt-1 text-[8px] ${t.color}`}>✓ {t.status}</p>
              </div>
            ))}
          </div>
          <PostureChart />
        </div>
      </div>
    </div>
  );
}

/* ── Phone / scan-status mockup ─────────────────────────────────────────── */
export function PhoneMockup() {
  return (
    <div aria-hidden className="absolute bottom-6 right-0 z-20 w-[170px] translate-x-4 translate-y-6 rounded-[28px] border-4 border-zinc-800/80 bg-zinc-950 p-2.5 shadow-2xl transition-transform duration-500 hover:translate-y-4 sm:translate-x-6">
      <span className="absolute left-1/2 top-2 z-30 h-2.5 w-12 -translate-x-1/2 rounded-full bg-zinc-800" />
      <div className="flex h-[220px] flex-col justify-between rounded-[22px] bg-white p-3 text-zinc-950">
        <div className="flex justify-between text-[8px]">
          <span className="font-bold text-zinc-400">SCAN</span>
          <span className="font-mono text-emerald-600">RUNNING</span>
        </div>
        <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-2 text-center">
          <ShieldCheck className="mx-auto h-4 w-4 text-zinc-800" />
          <p className="mt-1 text-[9px] font-bold">Read-only scan</p>
          <p className="text-[7px] text-zinc-400">cross-account IAM</p>
        </div>
        <div className="mt-3 space-y-1.5 text-[8px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">AWS · Azure · GCP</span>
            <span className="font-mono font-bold text-blue-600">3 CLOUDS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Findings mapped</span>
            <span className="font-mono font-bold text-emerald-600">678</span>
          </div>
        </div>
        <div className="mt-3 flex h-5 items-center justify-center rounded-md bg-zinc-950 text-[8px] font-bold text-white">
          View report
        </div>
      </div>
    </div>
  );
}

/* ── Floating "read-only access" chip ───────────────────────────────────── */
export function FloatingChip() {
  return (
    <div aria-hidden className="absolute right-2 top-10 z-20 w-[140px] -translate-y-8 translate-x-2 rounded-xl border border-zinc-100 bg-white p-3 shadow-xl sm:right-6 sm:translate-x-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] font-bold uppercase text-zinc-400">Access</span>
        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
      </div>
      <p className="mt-1 text-[10px] font-bold text-zinc-800">Read-only, always</p>
      <p className="mt-0.5 text-[9px] leading-snug text-zinc-500">
        Cross-account IAM role — no write keys, ever.
      </p>
    </div>
  );
}

/* ── The composed device cluster (hero right column) ────────────────────── */
export function DeviceCluster() {
  return (
    <div className="relative flex h-[520px] w-full items-center justify-center">
      <div
        aria-hidden
        className="absolute h-[440px] w-[440px] rounded-full border border-dashed border-zinc-200 motion-safe:animate-[spin_120s_linear_infinite]"
      />
      <div aria-hidden className="absolute h-[320px] w-[320px] rounded-full border border-zinc-100" />
      <DashboardMockup />
      <PhoneMockup />
      <FloatingChip />
    </div>
  );
}
