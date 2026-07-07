/**
 * Halo demo data — copy ported from the reference prototype.
 * Used for in-page animated product illustrations (agent scan matrix,
 * evidence feed, compliance bars). Not a source of truth for real
 * marketing copy; the live site content lives in `@/data/content`.
 */

export const FRAMEWORKS = [
  "SOC 2 Type II",
  "ISO 27001:2022",
  "HIPAA",
  "GDPR",
  "PCI-DSS v4.0",
  "DPDPA",
  "CERT-In",
  "ISO 42001",
  "NIST 800-53",
] as const;

export type Framework = (typeof FRAMEWORKS)[number];

export interface Agent {
  id: string;
  name: string;
  scope: "identity" | "network" | "data" | "compute" | "secrets";
  scans: number;
  findings: number;
}

export const AGENTS: readonly Agent[] = [
  { id: "IAM-01", name: "IAM Posture", scope: "identity", scans: 1284, findings: 3 },
  { id: "NET-02", name: "Network Egress", scope: "network", scans: 2104, findings: 12 },
  { id: "STO-03", name: "Storage Encryption", scope: "data", scans: 892, findings: 0 },
  { id: "CMP-04", name: "Compute Hardening", scope: "compute", scans: 3420, findings: 7 },
  { id: "SEC-05", name: "Secrets Drift", scope: "secrets", scans: 671, findings: 2 },
] as const;

export interface ComplianceScore {
  fw: string;
  controls: number;
  pass: number;
  pct: number;
}

export const COMPLIANCE_SCORES: readonly ComplianceScore[] = [
  { fw: "SOC 2 Type II", controls: 142, pass: 139, pct: 97.9 },
  { fw: "ISO 27001:2022", controls: 114, pass: 112, pct: 98.2 },
  { fw: "HIPAA", controls: 68, pass: 66, pct: 97.1 },
  { fw: "DPDPA", controls: 42, pass: 41, pct: 97.6 },
  { fw: "PCI-DSS v4.0", controls: 96, pass: 91, pct: 94.8 },
] as const;

export const CUSTOMERS = [
  "AXIOM",
  "NORTHWIND",
  "OCTAVE",
  "MERIDIAN",
  "KEYSTONE",
  "HELIOS",
  "SABLE",
  "VANTA\u00B7GO",
  "ORION PAY",
  "BLUELINK",
] as const;

export type Customer = (typeof CUSTOMERS)[number];

export interface HowStep {
  n: string;
  t: string;
  d: string;
  min: string;
}

export const HOW_STEPS: readonly HowStep[] = [
  {
    n: "01",
    t: "Connect",
    d: "OIDC into AWS, Azure, GCP. Optional on-prem agent. Read-only by default.",
    min: "< 5 min",
  },
  {
    n: "02",
    t: "Scan",
    d: "34 agents scan identity, network, storage, compute, secrets, and code paths.",
    min: "~10 min",
  },
  {
    n: "03",
    t: "Map",
    d: "Findings auto-mapped to the frameworks you're accountable to (SOC 2, ISO…).",
    min: "Continuous",
  },
  {
    n: "04",
    t: "Remediate",
    d: "AI drafts a playbook; your team approves; agent applies the change with audit.",
    min: "Per finding",
  },
  {
    n: "05",
    t: "Evidence",
    d: "Every control backed by SHA-256-pinned evidence in WORM storage, ready to export.",
    min: "Always",
  },
] as const;

export interface LogLine {
  t: string;
  agent: string;
  level: "ok" | "warn" | "crit";
  msg: string;
}

export const LOG_LINES: readonly LogLine[] = [
  { t: "00:00:01.204", agent: "IAM-01", level: "ok", msg: "Scanned 142 principals. 0 privilege escalations." },
  { t: "00:00:01.418", agent: "STO-03", level: "ok", msg: "All 38 buckets encrypted (SSE-KMS). WORM policy verified." },
  { t: "00:00:01.602", agent: "NET-02", level: "warn", msg: "3 security groups with 0.0.0.0/0 on port 22. Suggested fix queued." },
  { t: "00:00:01.811", agent: "CMP-04", level: "ok", msg: "Hardening baseline 98% on 214/218 instances." },
  { t: "00:00:02.012", agent: "SEC-05", level: "crit", msg: "Secret in commit b4f201 (git-sha). Rotated & remediation playbook drafted." },
  { t: "00:00:02.220", agent: "IAM-01", level: "ok", msg: "MFA enforced across all admin roles. Evidence pinned." },
  { t: "00:00:02.441", agent: "CMP-04", level: "ok", msg: "Kernel CVE-2024-1086 patched on 14 hosts." },
  { t: "00:00:02.640", agent: "NET-02", level: "ok", msg: "TLS 1.3 enforced on 62 public endpoints." },
  { t: "00:00:02.848", agent: "STO-03", level: "warn", msg: "S3 versioning off on 2 buckets. Evidence collected; fix proposed." },
  { t: "00:00:03.011", agent: "IAM-01", level: "ok", msg: "Access review cycle auto-scheduled for 72 roles." },
] as const;

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    q: "How long until findings appear?",
    a: "~10 minutes after first agent connection. A full posture map is built from the first scan cycle onward.",
  },
  {
    q: "Do you support on-prem?",
    a: "Yes. A lightweight agent runs on Linux/Windows and reports to the same control plane as cloud scans.",
  },
  {
    q: "Is evidence audit-defensible?",
    a: "Evidence is stored in S3 WORM with SHA-256 integrity and one-click bundle export for auditors.",
  },
  {
    q: "How is AI used in remediation?",
    a: "Gap analysis + playbook drafts. Every change is human-approved; the agent never writes to prod unsupervised.",
  },
  {
    q: "What about India-specific frameworks?",
    a: "DPDPA, CERT-In 6-hour SLA tracking, and RBI cyber framework are first-class — not bolt-ons.",
  },
] as const;
