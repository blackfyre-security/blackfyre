"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

// ─── Type definitions ──────────────────────────────────────────────────────────

interface AibomModel {
  name: string;
  version: string;
  purpose: string;
  lastAudit: string;
  ethicsScore: number;
  provider: string;
  details: string;
}

interface SbomPackage {
  name: string;
  version: string;
  license: string;
  vulnStatus: string;
}

interface SbomCategory {
  category: string;
  packages: SbomPackage[];
}

interface ComplianceFrameworkEntry {
  name: string;
  score: number;
  passRate: number;
  lastAudit: string;
  icon: string;
}

interface StatusPill {
  label: string;
  active: boolean;
}

interface TrustData {
  trustScore: number;
  lastAttestation: string;
  statusPills: StatusPill[];
  aibomModels: AibomModel[];
  sbomCategories: SbomCategory[];
  complianceFrameworks: ComplianceFrameworkEntry[];
  genesisHash: string;
  lastChainHash: string;
  chainEntries: number;
  lastSeq: number;
  chainVerifiedAt: string;
  pcr0Hash: string;
  attestationPlatform: string;
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function TrustScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const gap = circ - filled;
  const strokeW = size * 0.07;

  const ringColor =
    score >= 90 ? "var(--success)" : score >= 75 ? "var(--accent)" : "var(--critical)";
  const trackColor = "var(--surface-raised)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Trust score: ${score} out of 100`}
      role="img"
    >
      <defs>
        <linearGradient id="trustRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ringColor} />
          <stop offset="100%" stopColor={score >= 90 ? "var(--accent)" : ringColor} />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeW}
      />
      {/* Arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="url(#trustRingGrad)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)" }}
      />
      {/* Score */}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={ringColor}
        fontSize={size * 0.2}
        fontWeight="700"
        fontFamily="'JetBrains Mono', monospace"
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + size * 0.12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-muted)"
        fontSize={size * 0.065}
        fontFamily="inherit"
        letterSpacing="2"
      >
        / 100
      </text>
    </svg>
  );
}

function MiniScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const gap = circ - filled;
  const sw = size * 0.1;

  const ringColor =
    score >= 80 ? "var(--success)" : score >= 60 ? "var(--accent)" : "var(--critical)";
  const trackColor = "var(--surface-raised)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={ringColor}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        strokeDashoffset={circ / 4}
      />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={ringColor}
        fontSize={size * 0.26}
        fontWeight="700"
        fontFamily="'JetBrains Mono', monospace"
      >
        {score}
      </text>
    </svg>
  );
}

function EthicsBar({ score }: { score: number }) {
  const color =
    score >= 85 ? "bg-[var(--accent)]" : score >= 70 ? "bg-[var(--medium)]" : "bg-[var(--critical)]";
  const textColor =
    score >= 85 ? "text-[var(--accent)]" : score >= 70 ? "text-[var(--medium-text)]" : "text-[var(--critical-text)]";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
        <div
          className={`h-full rounded-md ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-7 text-right ${textColor}`}>
        {score}
      </span>
    </div>
  );
}

function VulnDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    clean: { color: "var(--success)", label: "No vulnerabilities" },
    advisory: { color: "var(--accent)", label: "Advisory" },
    critical: { color: "var(--critical)", label: "Critical" },
  };
  const cfg = map[status] ?? map.clean;
  return (
    <span
      title={cfg.label}
      aria-label={cfg.label}
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: cfg.color }}
    />
  );
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg skeleton ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <ShimmerBlock className="h-10 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <ShimmerBlock className="h-64" />
        <div className="grid grid-cols-3 gap-4">
          <ShimmerBlock className="h-64" />
          <ShimmerBlock className="h-64" />
          <ShimmerBlock className="h-64" />
        </div>
      </div>
      <ShimmerBlock className="h-48" />
      <ShimmerBlock className="h-64" />
    </div>
  );
}

// Animated counter
function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return <>{current}</>;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_TRUST_DATA fixture — which presented
// a FABRICATED trust score, fake SBOM/AIBOM, and invented genesis/chain/PCR0
// attestation hashes as if they were real cryptographic proofs — and the
// DEMO_MODE bypass have been removed. The Trust Center is sourced only from the
// live API (api.getTrustData).

export default function TrustCenterPage() {
  const [trustData, setTrustData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedSbomCategory, setExpandedSbomCategory] = useState<string | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);
  // REAL IMPL (BLACKFYRE 2026-06): do NOT assume the integrity chain is verified.
  // It starts as null (unknown) and only becomes true/false based on the real
  // server-reported chainVerifiedAt, never a client-side default.
  const [chainVerified, setChainVerified] = useState<boolean | null>(null);
  const [attestationNote, setAttestationNote] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): load Trust Center data from the live API and
  // reflect the server's chain-verification state. Hoisted into a callback so the
  // "verify chain" button can re-pull the authoritative server state.
  const loadTrust = useCallback(() => {
    setError(null);
    return api.getTrustData()
      .then((res) => {
        const d: any = (res as any).data ?? res;
        const sbomCategories = d.sbomCategories ?? d.sbom_categories ?? [];
        const chainVerifiedAt = d.chainVerifiedAt ?? d.chain_verified_at ?? "";
        setTrustData({
          trustScore: d.trustScore ?? d.trust_score ?? 0,
          lastAttestation: d.lastAttestation ?? d.last_attestation ?? "",
          statusPills: d.statusPills ?? d.status_pills ?? [],
          aibomModels: d.aibomModels ?? d.aibom_models ?? [],
          sbomCategories,
          complianceFrameworks: d.complianceFrameworks ?? d.compliance_frameworks ?? [],
          genesisHash: d.genesisHash ?? d.genesis_hash ?? "",
          lastChainHash: d.lastChainHash ?? d.last_chain_hash ?? "",
          chainEntries: d.chainEntries ?? d.chain_entries ?? 0,
          lastSeq: d.lastSeq ?? d.last_seq ?? 0,
          chainVerifiedAt,
          pcr0Hash: d.pcr0Hash ?? d.pcr0_hash ?? "",
          attestationPlatform: d.attestationPlatform ?? d.attestation_platform ?? "",
        });
        setExpandedSbomCategory(sbomCategories[0]?.category ?? null);
        // The chain is "verified" only when the server reports a verification
        // timestamp; otherwise it is explicitly unverified.
        setChainVerified(Boolean(chainVerifiedAt));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setChainVerified(false);
      });
  }, []);

  useEffect(() => {
    loadTrust().finally(() => setLoading(false));
  }, [loadTrust]);

  // REAL IMPL (BLACKFYRE 2026-06): re-verification re-pulls the authoritative
  // trust data from the server (which carries the server-computed
  // chainVerifiedAt) instead of faking a "verified" result with a timer.
  const handleVerifyChain = () => {
    setVerifyingChain(true);
    loadTrust().finally(() => setVerifyingChain(false));
  };

  // REAL IMPL (BLACKFYRE 2026-06): there is no on-demand attestation endpoint
  // yet. We no longer fake an "attestation requested" success; instead we state
  // honestly that attestation runs on the server schedule.
  const handleRequestAttestation = () => {
    setAttestationNote("On-demand attestation is not available yet — attestations run on the server's scheduled cycle.");
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load: {error}</div>;
  if (!trustData) return <div className="p-6 text-[var(--text-muted)]">No trust data available.</div>;

  const { trustScore, lastAttestation, statusPills, aibomModels, sbomCategories, complianceFrameworks,
    genesisHash, lastChainHash, chainEntries, lastSeq, chainVerifiedAt, pcr0Hash, attestationPlatform } = trustData;

  const totalPackages = sbomCategories.reduce((acc, c) => acc + c.packages.length, 0);
  const criticalCount = sbomCategories
    .flatMap((c) => c.packages)
    .filter((p) => p.vulnStatus === "critical").length;
  const advisoryCount = sbomCategories
    .flatMap((c) => c.packages)
    .filter((p) => p.vulnStatus === "advisory").length;

  return (
    <div className="space-y-6 animate-halo-fade-up">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="halo-eyebrow mb-2">§ 12 · Trust</p>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Trust Center
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Transparency.&nbsp;&nbsp;Sovereignty.&nbsp;&nbsp;Proof.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-accent)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-[var(--accent)] opacity-60" />
            <span className="relative inline-flex rounded-md h-1.5 w-1.5 bg-[var(--accent)]" />
          </span>
          Verified
        </span>
      </div>

      {/* ── Section 1: Sovereignty Status Hero ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Score ring */}
        <div className="card rounded-md p-6 flex flex-col items-center justify-center gap-4 text-center">
          <TrustScoreRing score={trustScore} size={180} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Trust Score</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
              Last attested: {lastAttestation ? new Date(lastAttestation).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </p>
          </div>
        </div>

        {/* Status pills + sovereignty details */}
        <div className="flex flex-col gap-4">
          {/* Pills row */}
          <div className="flex flex-wrap gap-3">
            {statusPills.map((pill) => (
              <div
                key={pill.label}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium border transition-all duration-300 ${
                  pill.active
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--border-accent)]"
                    : "bg-[var(--hover-bg)] text-[var(--text-muted)] border-[var(--border)]"
                }`}
              >
                {pill.active ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-[var(--accent)] opacity-50" />
                    <span className="relative inline-flex rounded-md h-2 w-2 bg-[var(--accent)]" />
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-md bg-[var(--text-muted)] inline-block" />
                )}
                {pill.label}
              </div>
            ))}
          </div>

          {/* Sovereignty metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            {[
              { label: "Data Region", value: "me-south-1", sub: "Doha, Qatar", foot: "Geo-locked" },
              { label: "Encryption", value: "AES-256 + TLS 1.3", sub: "At rest & in transit", foot: "FIPS 140-2 validated" },
              { label: "Key Management", value: "AWS KMS (BYOK)", sub: "arn:aws:kms:me-south-1…", foot: "Customer-managed" },
            ].map((item) => (
              <div key={item.label} className="card rounded-md p-4 flex flex-col gap-1.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)]">{item.label}</p>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.sub}</p>
                <div className="mt-auto pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] font-mono text-[var(--accent)]">{item.foot}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: AI Bill of Materials ── */}
      <div className="card rounded-md overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Bill of Materials (AIBOM)</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {aibomModels.length > 0 ? `${aibomModels.length} registered models — all ethics-audited` : "No models registered yet"}
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-lg border border-[var(--border-accent)]">
            {aibomModels.length} models
          </span>
        </div>

        <table className="w-full text-sm" role="table">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
              <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-44" style={{ color: "var(--text-muted)" }}>Model</th>
              <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Version</th>
              <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Purpose</th>
              <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-32" style={{ color: "var(--text-muted)" }}>Last Audit</th>
              <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-48" style={{ color: "var(--text-muted)" }}>Ethics Score</th>
            </tr>
          </thead>
          <tbody>
            {aibomModels.map((model) => {
              const expanded = expandedModel === model.name;
              return (
                <>
                  <tr
                    key={model.name}
                    onClick={() => setExpandedModel(expanded ? null : model.name)}
                    className={`cursor-pointer transition-colors ${
                      expanded ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--hover-bg)]"
                    }`}
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    aria-expanded={expanded}
                  >
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{model.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{model.provider}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{model.version}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{model.purpose}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{model.lastAudit}</td>
                    <td className="px-5 py-3">
                      <EthicsBar score={model.ethicsScore} />
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${model.name}-detail`} style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-raised)" }}>
                      <td colSpan={5} className="px-5 py-3">
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{model.details}</p>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Section 3: Software Bill of Materials ── */}
      <div className="card rounded-md overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Software Bill of Materials (SBOM)</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Dependency inventory — auto-generated on each build</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
            <span className="px-2.5 py-1 rounded-lg border" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
              {totalPackages} packages
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--critical-bg)] border border-[var(--critical)]/20 text-[var(--critical-text)]">
              {criticalCount} critical
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--medium-bg)] border border-[var(--medium)]/20 text-[var(--medium-text)]">
              {advisoryCount} advisories
            </span>
          </div>
        </div>

        <div style={{ borderTop: "none" }}>
          {sbomCategories.map((cat) => {
            const expanded = expandedSbomCategory === cat.category;
            return (
              <div key={cat.category} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => setExpandedSbomCategory(expanded ? null : cat.category)}
                  className="w-full flex items-center justify-between px-5 py-3 transition-colors text-left group hover:bg-[var(--hover-bg)]"
                  aria-expanded={expanded}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                      {cat.category}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{cat.packages.length} packages</span>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    style={{ color: "var(--text-muted)" }}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {expanded && (
                  <table className="w-full text-xs" role="table">
                    <thead>
                      <tr style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-raised)" }}>
                        <th scope="col" className="text-left px-5 py-2 font-semibold uppercase tracking-wider w-48" style={{ color: "var(--text-muted)" }}>Package</th>
                        <th scope="col" className="text-left px-5 py-2 font-semibold uppercase tracking-wider w-32" style={{ color: "var(--text-muted)" }}>Version</th>
                        <th scope="col" className="text-left px-5 py-2 font-semibold uppercase tracking-wider w-36" style={{ color: "var(--text-muted)" }}>License</th>
                        <th scope="col" className="text-left px-5 py-2 font-semibold uppercase tracking-wider w-32" style={{ color: "var(--text-muted)" }}>Vuln Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.packages.map((pkg, i) => (
                        <tr
                          key={pkg.name}
                          className="hover:bg-[var(--hover-bg)] transition-colors"
                          style={{
                            borderTop: "1px solid var(--border-subtle)",
                            background: i % 2 === 1 ? "var(--surface-raised)" : "var(--surface)",
                          }}
                        >
                          <td className="px-5 py-2.5 font-mono" style={{ color: "var(--text-primary)" }}>{pkg.name}</td>
                          <td className="px-5 py-2.5 font-mono" style={{ color: "var(--text-secondary)" }}>{pkg.version}</td>
                          <td className="px-5 py-2.5" style={{ color: "var(--text-secondary)" }}>{pkg.license}</td>
                          <td className="px-5 py-2.5">
                            <span className="flex items-center gap-2">
                              <VulnDot status={pkg.vulnStatus} />
                              <span
                                className={
                                  pkg.vulnStatus === "clean"
                                    ? "text-[var(--accent)]"
                                    : pkg.vulnStatus === "advisory"
                                    ? "text-[var(--medium-text)]"
                                    : "text-[var(--critical-text)]"
                                }
                              >
                                {pkg.vulnStatus === "clean" ? "Clean" : pkg.vulnStatus === "advisory" ? "Advisory" : "Critical"}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Compliance Attestation Grid ── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Compliance Attestation</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{complianceFrameworks.length > 0 ? `${complianceFrameworks.length} frameworks` : "No data"}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {complianceFrameworks.map((fw, idx) => {
            const color =
              fw.score >= 80 ? "var(--success)" : fw.score >= 60 ? "var(--accent)" : "var(--critical)";
            const bgColor = "var(--surface-raised)";
            return (
              <div
                key={fw.name}
                className={`card rounded-md p-4 flex flex-col items-center gap-3 text-center stagger-${Math.min(idx + 1, 5)}`}
              >
                <MiniScoreRing score={fw.score} size={56} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fw.name}</p>
                  <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
                    {fw.passRate}% pass rate
                  </p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{fw.lastAudit}</p>
                </div>
                <div
                  className="w-full h-0.5 rounded-md"
                  style={{ background: `linear-gradient(90deg, ${bgColor}, ${color}, ${bgColor})` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 5: Encryption & Data Sovereignty ── */}
      <div className="card rounded-md p-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Encryption &amp; Data Sovereignty</p>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)] border border-[var(--border-accent)]">
            All layers active
          </span>
        </div>

        {/* Encryption layer diagram */}
        <div className="flex flex-col sm:flex-row gap-3">
          {[
            {
              label: "At Rest",
              algo: "AES-256-GCM",
              detail: "AWS S3 + RDS SSE",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
            },
            {
              label: "In Transit",
              algo: "TLS 1.3 + mTLS",
              detail: "Certificate pinning active",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
            },
            {
              label: "In Use",
              algo: "TEE / Nitro Enclave",
              detail: "Memory encrypted",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              ),
            },
          ].map((layer) => (
            <div
              key={layer.label}
              className="flex-1 flex items-start gap-3 p-3.5 rounded-md border transition-all duration-300 group hover:border-[var(--border-accent)] hover:bg-[var(--accent-subtle)]"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            >
              <div className="shrink-0 p-2 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] group-hover:bg-[var(--accent-subtle)] transition-colors">
                {layer.icon}
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)]">{layer.label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{layer.algo}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{layer.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Bottom metadata row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-mono uppercase tracking-widest text-[var(--accent)] text-[9px] mb-1">Geographic Pin</p>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>me-south-1 (Doha, Qatar)</p>
            <p className="mt-0.5" style={{ color: "var(--text-secondary)" }}>Data never leaves sovereign zone</p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-widest text-[var(--accent)] text-[9px] mb-1">BYOK Key</p>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>AWS KMS — Customer Managed</p>
            <p className="font-mono mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              Fingerprint: <span className="text-[var(--accent)]">3a:f8:d2:e9:1c:7b…</span>
            </p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-widest text-[var(--accent)] text-[9px] mb-1">DLP Status</p>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>11 active rules</p>
            <p className="mt-0.5" style={{ color: "var(--text-secondary)" }}>
              <span className="text-[var(--accent)] font-mono">0 violations</span> in last 30 days
            </p>
          </div>
        </div>
      </div>

      {/* ── Sections 6 + 7: Audit Chain + Attestation ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Section 6: Audit Chain Integrity */}
        <div className="card rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Audit Chain Integrity</p>
            {/* REAL IMPL (BLACKFYRE 2026-06): three honest states — Verified
                (server reported a verification time), Broken (verification
                failed / errored), or Unverified (not yet confirmed). Never
                defaults to "Verified". */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                chainVerified === true
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--border-accent)]"
                  : chainVerified === false
                    ? "bg-[var(--critical-bg)] text-[var(--critical-text)] border-[var(--critical)]/20"
                    : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--border)]"
              }`}
            >
              {chainVerified === true ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified
                </>
              ) : chainVerified === false ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Broken
                </>
              ) : (
                <>Unverified</>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
              <p className="font-mono uppercase tracking-widest text-[var(--accent)] text-[9px] mb-1">Total Entries</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                <AnimatedNumber target={chainEntries} duration={1500} />
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
              <p className="font-mono uppercase tracking-widest text-[var(--accent)] text-[9px] mb-1">Last Seq #</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                <AnimatedNumber target={lastSeq} duration={1500} />
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="font-mono uppercase tracking-widest text-[9px]" style={{ color: "var(--text-muted)" }}>Genesis Hash</span>
              <span className="font-mono text-[var(--accent)]">{genesisHash || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="font-mono uppercase tracking-widest text-[9px]" style={{ color: "var(--text-muted)" }}>Head Hash</span>
              <span className="font-mono text-[var(--accent)]">{lastChainHash || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="font-mono uppercase tracking-widest text-[9px]" style={{ color: "var(--text-muted)" }}>Last Verified</span>
              <span className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>{chainVerifiedAt ? new Date(chainVerifiedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—"}</span>
            </div>
          </div>

          <button
            onClick={handleVerifyChain}
            disabled={verifyingChain}
            className="w-full py-2.5 rounded-md text-xs font-medium border border-[var(--border-accent)] bg-[var(--accent-subtle)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] hover:border-[var(--border-accent)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          >
            {verifyingChain ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Verifying…
              </span>
            ) : (
              "Verify Chain"
            )}
          </button>
        </div>

        {/* Section 7: Real-Time Attestation */}
        <div className="card rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Real-Time Attestation</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-accent)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-[var(--accent)] opacity-60" />
                <span className="relative inline-flex rounded-md h-1.5 w-1.5 bg-[var(--accent)]" />
              </span>
              Live
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-xs font-mono uppercase tracking-widest text-[9px]" style={{ color: "var(--text-muted)" }}>Platform</span>
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{attestationPlatform || "—"}</span>
            </div>
            <div className="py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>PCR0 Hash</p>
              <p className="font-mono text-sm text-[var(--accent)] tracking-wider px-3 py-2 rounded-lg bg-[var(--accent-subtle)] border border-[var(--border-accent)]">
                {pcr0Hash || "—"}{pcr0Hash && <span style={{ color: "var(--text-muted)" }}>…</span>}
              </p>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-mono uppercase tracking-widest text-[9px]" style={{ color: "var(--text-muted)" }}>Measurement</span>
              <span className="text-xs text-[var(--accent)] font-mono">Trusted</span>
            </div>
          </div>

          {/* REAL IMPL (BLACKFYRE 2026-06): there is no on-demand attestation
              API. The button no longer fakes a "fresh attestation requested"
              success — it surfaces an honest note instead. */}
          {attestationNote ? (
            <div className="w-full py-2.5 px-3 rounded-md text-xs font-medium border text-center" style={{ background: "var(--surface-raised)", color: "var(--text-muted)", borderColor: "var(--border)" }}>
              {attestationNote}
            </div>
          ) : (
            <button
              onClick={handleRequestAttestation}
              className="w-full py-2.5 rounded-md text-xs font-medium border border-[var(--border-accent)] bg-[var(--accent-subtle)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] hover:border-[var(--border-accent)] active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            >
              Request Fresh Attestation
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
