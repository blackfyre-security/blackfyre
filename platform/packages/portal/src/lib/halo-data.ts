/**
 * Halo demo data — copy ported from the website reference. Used by the
 * customer portal's Halo surface for agents / compliance bars / log feed
 * when no live data hook is wired. Marked as placeholder at the call site.
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

export interface ComplianceScoreDemo {
  fw: string;
  controls: number;
  pass: number;
  pct: number;
}

export const COMPLIANCE_SCORES: readonly ComplianceScoreDemo[] = [
  { fw: "SOC 2 Type II", controls: 142, pass: 139, pct: 97.9 },
  { fw: "ISO 27001:2022", controls: 114, pass: 112, pct: 98.2 },
  { fw: "HIPAA", controls: 68, pass: 66, pct: 97.1 },
  { fw: "DPDPA", controls: 42, pass: 41, pct: 97.6 },
  { fw: "PCI-DSS v4.0", controls: 96, pass: 91, pct: 94.8 },
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

export interface FeedLine {
  t: string;
  agent: string;
  msg: string;
  tone: "ok" | "warn" | "crit";
  _id?: number;
}

export const FEED_ROTATION: readonly Omit<FeedLine, "t">[] = [
  { agent: "IAM-01", msg: "Access review auto-scheduled for 72 roles", tone: "ok" },
  { agent: "NET-02", msg: "TLS 1.3 enforced on 3 new endpoints", tone: "ok" },
  { agent: "SEC-05", msg: "New secret detected in commit; remediation queued", tone: "warn" },
  { agent: "STO-03", msg: "WORM policy verified on 38 buckets", tone: "ok" },
  { agent: "CMP-04", msg: "Hardening baseline improved: 97% \u2192 98%", tone: "ok" },
  { agent: "IAM-01", msg: "MFA enforced on 3 new admin roles", tone: "ok" },
  { agent: "NET-02", msg: "Egress policy drift on vpc-a1b2", tone: "warn" },
  { agent: "STO-03", msg: "Evidence pinned for SOC 2 CC6.1", tone: "ok" },
] as const;
