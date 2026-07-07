// Sandbox tenant fixtures — ONE fully-populated demo tenant ("Sandbox Corp").
// Built from the canonical framework registry + scaffolder. All randomness is
// deterministic via a seeded PRNG (mulberry32) keyed on (frameworkId+controlId).
// No Math.random anywhere.

import {
  FRAMEWORK_REGISTRY,
  type ControlDefinition,
} from "@/lib/frameworks/registry";
import {
  computeAllProgress,
  scaffoldTenantControls,
  type TenantControlRecord,
  type TenantControlStatus,
  type TenantFrameworkProgress,
} from "@/lib/tenant/scaffold";

// ---------------------------------------------------------------------------
// Deterministic PRNG: xmur3 string hash -> mulberry32 32-bit float generator.
// ---------------------------------------------------------------------------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(key: string): () => number {
  const seedFn = xmur3(key);
  return mulberry32(seedFn());
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// Tenant identity
// ---------------------------------------------------------------------------

export interface SandboxTenant {
  id: string;
  name: string;
  legalName: string;
  plan: "explore" | "defend" | "scale";
  region: string;
  industry: string;
  employees: number;
  primaryContact: string;
  createdAt: string;
  frameworks: string[];
}

export const SANDBOX_TENANT_ID = "sandbox-demo" as const;

export const SANDBOX_FRAMEWORK_IDS: string[] = [
  "iso-27001-2022",
  "soc2-2017",
  "hipaa-security",
  "dpdpa-2023",
  "pci-dss-v4.0.1",
  "gdpr-2016",
  "iso-42001-2023",
  "nist-csf-2.0",
];

export const SANDBOX_TENANT: SandboxTenant = {
  id: SANDBOX_TENANT_ID,
  name: "Sandbox Corp",
  legalName: "Sandbox Corp Pvt. Ltd.",
  plan: "defend",
  region: "global",
  industry: "SaaS / Healthcare",
  employees: 248,
  primaryContact: "ciso@sandbox.example",
  createdAt: "2025-09-01T00:00:00.000Z",
  frameworks: SANDBOX_FRAMEWORK_IDS,
};

// ---------------------------------------------------------------------------
// Populate control records deterministically.
// Status distribution: ~75% passing, ~12% in_progress, ~8% not_started, ~5% failing.
// ---------------------------------------------------------------------------

const OWNER_POOL: string[] = [
  "ana.singh@sandbox.example",
  "marcus.delgado@sandbox.example",
  "priya.iyer@sandbox.example",
  "jordan.kim@sandbox.example",
  "leila.haddad@sandbox.example",
  "sam.okafor@sandbox.example",
];

const REVIEW_DAYS_BACK = [2, 5, 7, 11, 14, 21, 28, 35, 60, 90];
const REFERENCE_NOW_ISO = "2026-05-12T12:00:00.000Z";
const REFERENCE_NOW_MS = Date.parse(REFERENCE_NOW_ISO);

function pickStatus(roll: number): TenantControlStatus {
  if (roll < 0.75) return "passing";
  if (roll < 0.87) return "in_progress";
  if (roll < 0.95) return "not_started";
  return "failing";
}

function populateRecord(blank: TenantControlRecord): TenantControlRecord {
  const rng = seededRng(`${blank.frameworkId}::${blank.controlId}`);
  const status = pickStatus(rng());
  const owner = pick(rng, OWNER_POOL);
  const daysBack = pick(rng, REVIEW_DAYS_BACK);
  const lastReviewed =
    status === "not_started"
      ? null
      : new Date(REFERENCE_NOW_MS - daysBack * 86_400_000).toISOString();
  const evidenceCount =
    status === "not_started"
      ? 0
      : status === "in_progress"
        ? 1 + Math.floor(rng() * 2)
        : status === "failing"
          ? Math.floor(rng() * 2)
          : 2 + Math.floor(rng() * 5);
  const notes =
    status === "failing"
      ? "Auto-flagged by scanner: evidence stale or control drift detected."
      : status === "in_progress"
        ? "Owner gathering evidence."
        : null;
  return {
    ...blank,
    status,
    evidenceCount,
    lastReviewedAt: lastReviewed,
    ownerId: status === "not_started" ? null : owner,
    notes,
  };
}

const __BLANK_RECORDS = scaffoldTenantControls(
  SANDBOX_TENANT_ID,
  SANDBOX_FRAMEWORK_IDS,
);

export const SANDBOX_CONTROLS: TenantControlRecord[] = __BLANK_RECORDS.map(
  populateRecord,
);

export const SANDBOX_PROGRESS: TenantFrameworkProgress[] = computeAllProgress(
  SANDBOX_TENANT_ID,
  SANDBOX_CONTROLS,
);

// Posture score = aggregate passing / aggregate total across all selected frameworks.
function computePostureScore(progress: TenantFrameworkProgress[]): number {
  let totalControls = 0;
  let totalPassing = 0;
  for (const p of progress) {
    totalControls += p.totalControls;
    totalPassing += p.passing;
  }
  if (totalControls === 0) return 0;
  return Math.round((totalPassing / totalControls) * 1000) / 10;
}

export const SANDBOX_POSTURE_SCORE: number = computePostureScore(SANDBOX_PROGRESS);

// ---------------------------------------------------------------------------
// Findings — replace hardcoded 18 from (dashboard)/page.tsx. ~20 tied to real
// framework + control IDs. Stable IDs.
// ---------------------------------------------------------------------------

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus =
  | "open"
  | "in_remediation"
  | "awaiting_review"
  | "accepted_risk"
  | "resolved";

export interface SandboxFinding {
  id: string;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  frameworkId: string;
  controlId: string;
  asset: string;
  detector: string;          // agent id e.g. "IAM-01"
  openedAt: string;
  lastSeenAt: string;
  owner: string;
  description: string;
}

interface FindingSeed {
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  frameworkId: string;
  controlId: string;
  asset: string;
  detector: string;
  daysOpen: number;
  description: string;
}

const FINDING_SEEDS: FindingSeed[] = [
  {
    title: "Privileged IAM role missing MFA enforcement",
    severity: "critical",
    status: "open",
    frameworkId: "iso-27001-2022",
    controlId: "ISO-27001-A.8.2",
    asset: "aws::iam::role/ProdAdmin",
    detector: "IAM-01",
    daysOpen: 1,
    description:
      "Production admin role allows console sign-in without MFA. Violates least-privilege and MFA enforcement requirements.",
  },
  {
    title: "S3 bucket public-read ACL on customer logs",
    severity: "critical",
    status: "in_remediation",
    frameworkId: "pci-dss-v4.0.1",
    controlId: "PCI-DSS-1.3",
    asset: "aws::s3::sbx-customer-logs",
    detector: "STO-03",
    daysOpen: 3,
    description:
      "Logs bucket exposes objects to public-read ACL. Cardholder-adjacent data must be private.",
  },
  {
    title: "TLS 1.0 enabled on payments edge",
    severity: "high",
    status: "open",
    frameworkId: "pci-dss-v4.0.1",
    controlId: "PCI-DSS-4.1",
    asset: "edge::pay.sandbox.example",
    detector: "NET-02",
    daysOpen: 5,
    description:
      "Edge listener accepts TLS 1.0 handshakes. PCI-DSS 4.x requires strong cryptography only.",
  },
  {
    title: "EBS snapshot encryption disabled in 1 account",
    severity: "high",
    status: "open",
    frameworkId: "iso-27001-2022",
    controlId: "ISO-27001-A.8.24",
    asset: "aws::ec2::account/staging",
    detector: "STO-03",
    daysOpen: 7,
    description:
      "Default EBS snapshot encryption disabled on staging account. Requires SSE-KMS default at the account level.",
  },
  {
    title: "Stale offboarded user with active SSO session",
    severity: "high",
    status: "in_remediation",
    frameworkId: "soc2-2017",
    controlId: "SOC2-CC6.2",
    asset: "iam::okta::user/charlie.exited",
    detector: "IAM-01",
    daysOpen: 2,
    description:
      "User exited 11 days ago but SSO session still refreshable. Termination procedure not executed end-to-end.",
  },
  {
    title: "ePHI table missing column-level encryption",
    severity: "high",
    status: "awaiting_review",
    frameworkId: "hipaa-security",
    controlId: "HIPAA-164.312(a)(2)(iv)",
    asset: "pg::prod.patients",
    detector: "STO-03",
    daysOpen: 4,
    description:
      "Identifiable patient columns persisted without column-level encryption. Addressable spec under §164.312(a)(2)(iv).",
  },
  {
    title: "Data Principal access request SLA breached (15 days)",
    severity: "medium",
    status: "open",
    frameworkId: "dpdpa-2023",
    controlId: "DPDPA-S11",
    asset: "privacy::dsr-queue",
    detector: "PRV-07",
    daysOpen: 6,
    description:
      "Two pending DPDPA Section 11 access requests have aged past the 15-day target.",
  },
  {
    title: "Vendor contract missing DPDPA processor clause",
    severity: "medium",
    status: "in_remediation",
    frameworkId: "dpdpa-2023",
    controlId: "DPDPA-S8",
    asset: "vendor::analytics-co",
    detector: "AIG-06",
    daysOpen: 12,
    description:
      "Sub-processor agreement lacks the DPDPA-aligned data fiduciary obligations clause.",
  },
  {
    title: "AI model deployed without impact assessment",
    severity: "high",
    status: "open",
    frameworkId: "iso-42001-2023",
    controlId: "ISO-42001-A.5.2",
    asset: "ai::risk-scorer-v3",
    detector: "AIG-06",
    daysOpen: 4,
    description:
      "Risk scoring model v3 was deployed without a completed AI System Impact Assessment.",
  },
  {
    title: "GDPR Article 30 RoPA out of date",
    severity: "medium",
    status: "open",
    frameworkId: "gdpr-2016",
    controlId: "GDPR-Art30",
    asset: "privacy::ropa",
    detector: "PRV-07",
    daysOpen: 9,
    description:
      "Records of Processing Activities last updated 7 months ago; multiple new vendors added since.",
  },
  {
    title: "DLP rule allows unredacted PAN in support tickets",
    severity: "high",
    status: "open",
    frameworkId: "pci-dss-v4.0.1",
    controlId: "PCI-DSS-3.5",
    asset: "saas::zendesk",
    detector: "PRV-07",
    daysOpen: 5,
    description:
      "DLP exception lets primary account numbers reach support tooling without masking.",
  },
  {
    title: "Backup restore test missing for Q1",
    severity: "medium",
    status: "in_remediation",
    frameworkId: "iso-27001-2022",
    controlId: "ISO-27001-A.8.13",
    asset: "ops::backup-suite",
    detector: "CMP-04",
    daysOpen: 14,
    description:
      "Quarterly restore drill was not performed in Q1. Required by backup policy and ISO 27001 A.8.13.",
  },
  {
    title: "Critical CVE outstanding > 30 days on edge nodes",
    severity: "high",
    status: "open",
    frameworkId: "nist-csf-2.0",
    controlId: "NIST-CSF-PR.PS",
    asset: "infra::edge-fleet",
    detector: "SEC-05",
    daysOpen: 31,
    description:
      "CVE flagged critical by CERT-In advisory remains unpatched on 4 edge nodes past SLA.",
  },
  {
    title: "Logging pipeline dropped events for 47 minutes",
    severity: "medium",
    status: "resolved",
    frameworkId: "soc2-2017",
    controlId: "SOC2-CC7.2",
    asset: "log::pipeline",
    detector: "SEC-05",
    daysOpen: 0,
    description:
      "Audit log pipeline gap detected. Root cause: rotation lag. Backfilled from journal store.",
  },
  {
    title: "Production change deployed without ticket",
    severity: "medium",
    status: "awaiting_review",
    frameworkId: "soc2-2017",
    controlId: "SOC2-CC8.1",
    asset: "ci::prod-deploy/main",
    detector: "CMP-04",
    daysOpen: 2,
    description:
      "Pipeline run pushed to prod outside the change management ticket. Likely glass-break.",
  },
  {
    title: "Network segment lacks egress filtering",
    severity: "medium",
    status: "open",
    frameworkId: "nist-csf-2.0",
    controlId: "NIST-CSF-PR.IR",
    asset: "vpc::stage-east",
    detector: "NET-02",
    daysOpen: 8,
    description:
      "Staging VPC allows unrestricted egress to internet. Requires explicit allow-list.",
  },
  {
    title: "Workforce HIPAA training overdue for 6 users",
    severity: "low",
    status: "in_remediation",
    frameworkId: "hipaa-security",
    controlId: "HIPAA-164.308(a)(5)(i)",
    asset: "hr::lms",
    detector: "CMP-04",
    daysOpen: 10,
    description:
      "Six workforce members past their annual HIPAA awareness training deadline.",
  },
  {
    title: "GDPR Art.32 encryption attestation missing for vendor",
    severity: "low",
    status: "open",
    frameworkId: "gdpr-2016",
    controlId: "GDPR-Art32",
    asset: "vendor::email-svc",
    detector: "AIG-06",
    daysOpen: 17,
    description:
      "Vendor has not returned signed encryption attestation. Required for Art.32 evidence.",
  },
  {
    title: "AI training data lacks provenance tags for 12% of rows",
    severity: "medium",
    status: "open",
    frameworkId: "iso-42001-2023",
    controlId: "ISO-42001-A.7.5",
    asset: "ai::train-set/risk-scorer",
    detector: "AIG-06",
    daysOpen: 6,
    description:
      "Provenance metadata missing for portion of training corpus. ISO 42001 A.7.5 requires complete provenance.",
  },
  {
    title: "DPDPA grievance redressal mailbox unmonitored on weekends",
    severity: "low",
    status: "accepted_risk",
    frameworkId: "dpdpa-2023",
    controlId: "DPDPA-S13",
    asset: "privacy::grievance",
    detector: "PRV-07",
    daysOpen: 22,
    description:
      "Grievance redressal channel not staffed on weekends. Risk accepted with compensating SLA target.",
  },
];

function buildFindings(seeds: FindingSeed[]): SandboxFinding[] {
  return seeds.map((seed, idx) => {
    const id = `FND-SBX-${String(idx + 1).padStart(3, "0")}`;
    const openedAt = new Date(
      REFERENCE_NOW_MS - seed.daysOpen * 86_400_000,
    ).toISOString();
    const lastSeenAt = new Date(
      REFERENCE_NOW_MS - Math.floor(seed.daysOpen / 2) * 86_400_000,
    ).toISOString();
    // Deterministic owner assignment based on finding id.
    const rng = seededRng(`finding::${id}`);
    const owner = pick(rng, OWNER_POOL);
    // Resolve the actual control title for the description prefix, when present.
    const fw = FRAMEWORK_REGISTRY[seed.frameworkId];
    const ctrl: ControlDefinition | undefined = fw?.controls.find(
      (c) => c.id === seed.controlId,
    );
    const description = ctrl
      ? `${seed.description} (Maps to ${fw?.shortName} ${ctrl.ref}: ${ctrl.title}.)`
      : seed.description;
    return {
      id,
      title: seed.title,
      severity: seed.severity,
      status: seed.status,
      frameworkId: seed.frameworkId,
      controlId: seed.controlId,
      asset: seed.asset,
      detector: seed.detector,
      openedAt,
      lastSeenAt,
      owner,
      description,
    };
  });
}

export const SANDBOX_FINDINGS: SandboxFinding[] = buildFindings(FINDING_SEEDS);

// ---------------------------------------------------------------------------
// Scan agents — 7 with stable IDs
// ---------------------------------------------------------------------------

export type AgentStatus = "healthy" | "degraded" | "offline";

export interface SandboxAgent {
  id: string;
  name: string;
  scope: string;
  status: AgentStatus;
  lastRunAt: string;
  cadence: string;
  controlsCovered: number;
  findingsOpen: number;
}

export const SANDBOX_AGENTS: SandboxAgent[] = [
  {
    id: "IAM-01",
    name: "Identity & Access Sentinel",
    scope: "IAM, SSO, RBAC, privileged sessions",
    status: "healthy",
    lastRunAt: new Date(REFERENCE_NOW_MS - 3 * 60_000).toISOString(),
    cadence: "every 15m",
    controlsCovered: 42,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "IAM-01" && f.status !== "resolved").length,
  },
  {
    id: "NET-02",
    name: "Network Boundary Watcher",
    scope: "VPC, WAF, TLS, edge",
    status: "healthy",
    lastRunAt: new Date(REFERENCE_NOW_MS - 9 * 60_000).toISOString(),
    cadence: "every 30m",
    controlsCovered: 31,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "NET-02" && f.status !== "resolved").length,
  },
  {
    id: "STO-03",
    name: "Storage & Crypto Inspector",
    scope: "S3, EBS, RDS, KMS, encryption posture",
    status: "degraded",
    lastRunAt: new Date(REFERENCE_NOW_MS - 18 * 60_000).toISOString(),
    cadence: "every 30m",
    controlsCovered: 27,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "STO-03" && f.status !== "resolved").length,
  },
  {
    id: "CMP-04",
    name: "Change & Compliance Auditor",
    scope: "CI/CD, change management, training",
    status: "healthy",
    lastRunAt: new Date(REFERENCE_NOW_MS - 6 * 60_000).toISOString(),
    cadence: "every 1h",
    controlsCovered: 38,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "CMP-04" && f.status !== "resolved").length,
  },
  {
    id: "SEC-05",
    name: "SOC Pipeline Monitor",
    scope: "SIEM, vulnerability mgmt, patching",
    status: "healthy",
    lastRunAt: new Date(REFERENCE_NOW_MS - 2 * 60_000).toISOString(),
    cadence: "every 10m",
    controlsCovered: 24,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "SEC-05" && f.status !== "resolved").length,
  },
  {
    id: "AIG-06",
    name: "AI Governance Watchdog",
    scope: "ISO 42001 AI lifecycle, model risk",
    status: "healthy",
    lastRunAt: new Date(REFERENCE_NOW_MS - 12 * 60_000).toISOString(),
    cadence: "every 2h",
    controlsCovered: 19,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "AIG-06" && f.status !== "resolved").length,
  },
  {
    id: "PRV-07",
    name: "Privacy Rights & DSR Bot",
    scope: "GDPR / DPDPA / CCPA DSRs, RoPA, DLP",
    status: "healthy",
    lastRunAt: new Date(REFERENCE_NOW_MS - 4 * 60_000).toISOString(),
    cadence: "every 30m",
    controlsCovered: 22,
    findingsOpen: SANDBOX_FINDINGS.filter((f) => f.detector === "PRV-07" && f.status !== "resolved").length,
  },
];

export const SANDBOX_AGENT_COUNT: number = SANDBOX_AGENTS.length;

// ---------------------------------------------------------------------------
// Activity feed — deterministic sequence. No Math.random rotation.
// Use getFeedLine(index) to read the next line.
// ---------------------------------------------------------------------------

const FEED_LINES: string[] = [
  "IAM-01 swept 1,432 identities. 1 high-severity finding raised.",
  "NET-02 verified TLS posture on 26 edge listeners.",
  "STO-03 inspected 318 S3 buckets. 1 public-read ACL detected.",
  "CMP-04 reconciled 47 production changes against tickets.",
  "SEC-05 ingested 11.4M SIEM events in last 10 minutes.",
  "AIG-06 evaluated 5 model deployments against ISO 42001 A.6.",
  "PRV-07 closed 3 DSRs; 2 remain inside SLA.",
  "Evidence vault rotated KMS keys (annual schedule).",
  "Auto-remediation: re-enabled MFA on 4 stale break-glass users.",
  "Continuous monitoring: SOC 2 CC7.2 attestation green.",
  "DPDPA grievance mailbox auto-acknowledged 2 new requests.",
  "GDPR Art.30 RoPA diff prepared for legal review.",
  "Patch agent shipped 12 high-severity CVEs to staging.",
  "Vendor risk: 1 new sub-processor flagged for DPA refresh.",
  "AI Governance: provenance audit completed on training set v7.",
  "Backup drill simulated full restore of patients DB in 11m23s.",
  "PCI-DSS quarterly external scan kicked off.",
  "Privacy Rights bot received 1 CCPA opt-out; honored in 4s.",
  "ISO 27001 internal audit: 3 controls upgraded passing → passing-with-exception.",
  "Incident response tabletop drill scheduled for next Friday.",
];

/**
 * Deterministic feed accessor. Returns the line at `index` modulo feed length.
 */
export function getFeedLine(index: number): string {
  if (FEED_LINES.length === 0) return "";
  const i = ((index % FEED_LINES.length) + FEED_LINES.length) % FEED_LINES.length;
  return FEED_LINES[i] as string;
}

export const SANDBOX_FEED: { length: number; lines: readonly string[]; getFeedLine: typeof getFeedLine } = {
  length: FEED_LINES.length,
  lines: FEED_LINES,
  getFeedLine,
};
