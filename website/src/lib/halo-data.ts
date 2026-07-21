/**
 * Halo in-page copy/data for the open-source Blackfyre site. All figures are
 * code-of-record (40+ SDK auditors · 9 frameworks · 678 controls · 3 clouds + on-prem).
 * Types are stable; canonical framework/auditor/site data lives in `@/data/*`.
 */

export const FRAMEWORKS = [
  "SOC 2",
  "ISO 27001",
  "HIPAA",
  "GDPR",
  "PCI DSS",
  "DPDPA",
  "ISO 42001",
  "PDPPL",
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

/**
 * Illustrative sample of the 55 SDK auditors (real auditor names). Not a live
 * feed — the full catalog is in `@/data/auditors`.
 */
export const AGENTS: readonly Agent[] = [
  { id: "IAM", name: "AWS IAM Auditor", scope: "identity", scans: 0, findings: 0 },
  { id: "S3", name: "AWS S3 Auditor", scope: "data", scans: 0, findings: 0 },
  { id: "EC2", name: "AWS EC2 & VPC Auditor", scope: "network", scans: 0, findings: 0 },
  { id: "LMB", name: "AWS Lambda Auditor", scope: "compute", scans: 0, findings: 0 },
  { id: "SEC", name: "AWS Secrets Manager Auditor", scope: "secrets", scans: 0, findings: 0 },
] as const;

export interface ComplianceScore {
  fw: string;
  controls: number;
  pass: number;
  pct: number;
}

/**
 * Per-framework control counts (code-of-record). `pass`/`pct` describe control
 * coverage mapped by the platform, not any real customer posture.
 */
export const COMPLIANCE_SCORES: readonly ComplianceScore[] = [
  { fw: "NIST 800-53", controls: 298, pass: 298, pct: 100 },
  { fw: "HIPAA", controls: 113, pass: 113, pct: 100 },
  { fw: "GDPR", controls: 99, pass: 99, pct: 100 },
  { fw: "ISO 27001", controls: 93, pass: 93, pct: 100 },
  { fw: "ISO 42001", controls: 22, pass: 22, pct: 100 },
] as const;

/** Placeholder wordmarks — retained for the (unused) HaloCustomers component; never rendered on the OSS site. */
export const CUSTOMERS = [
  "AXIOM",
  "NORTHWIND",
  "OCTAVE",
  "MERIDIAN",
  "KEYSTONE",
  "HELIOS",
  "SABLE",
  "VANTA·GO",
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
    t: "Connect a read-only role",
    d: "Grant Blackfyre a read-only, least-privilege cross-account IAM role. No write keys, ever. On-prem targets connect over AD / SNMP / IdP / EDR.",
    min: "read-only",
  },
  {
    n: "02",
    t: "Auditors scan",
    d: "55 SDK auditors sweep AWS, Azure, GCP and on-prem — plus Prowler (900+ AWS checks) and Checkov / Semgrep / Bandit running as container Lambdas.",
    min: "40+ SDK auditors",
  },
  {
    n: "03",
    t: "Findings map to controls",
    d: "Every finding maps to the affected controls across 9 frameworks and 678 controls, with weighted per-framework scoring.",
    min: "678 controls",
  },
  {
    n: "04",
    t: "AI + heuristics remediate",
    d: "Claude (Anthropic API or AWS Bedrock) drafts gap analysis, MITRE ATT&CK mapping and remediation. With no key it degrades to deterministic heuristics.",
    min: "AI + heuristics",
  },
  {
    n: "05",
    t: "Evidence for auditors",
    d: "Results land in a hash-verified vault: SHA-256 hash per item, S3 Object Lock + versioning, AES-256-GCM PII encryption — export-ready for auditors.",
    min: "hash-verified",
  },
] as const;

export interface LogLine {
  t: string;
  agent: string;
  level: "ok" | "warn" | "crit";
  msg: string;
}

/** Illustrative scan-log lines for in-page demos. Not a live feed. */
export const LOG_LINES: readonly LogLine[] = [
  { t: "00:00:01.204", agent: "IAM", level: "ok", msg: "Enumerated principals via AWS SDK. No privilege escalations." },
  { t: "00:00:01.418", agent: "S3", level: "ok", msg: "Buckets checked for public access + SSE-KMS encryption." },
  { t: "00:00:01.602", agent: "EC2", level: "warn", msg: "Security group allows 0.0.0.0/0 on port 22. Mapped to controls." },
  { t: "00:00:01.811", agent: "PROWLER", level: "ok", msg: "Prowler container Lambda: 900+ AWS checks complete." },
  { t: "00:00:02.012", agent: "SEC", level: "crit", msg: "Secret exposure flagged. Evidence pinned with SHA-256." },
  { t: "00:00:02.220", agent: "CHECKOV", level: "ok", msg: "IaC scan (Terraform/CFN/K8s) normalized into findings." },
] as const;

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    q: "Is it really free?",
    a: "Yes. Blackfyre is Apache-2.0 licensed — self-host it on your own infrastructure, with every feature, no license fee, forever. The full source is on GitHub.",
  },
  {
    q: "How do the scanners access my cloud?",
    a: "Through a read-only, least-privilege cross-account IAM role — no write keys. Scanners collect the minimum posture data needed and never touch PII, customer records, or business content.",
  },
  {
    q: "Do I need an API key for the AI features?",
    a: "No. AI is provider-agnostic: point it at Anthropic's API or use AWS Bedrock via the Lambda's IAM role (no key). With no provider configured it degrades gracefully to deterministic heuristics.",
  },
  {
    q: "How is multi-tenancy isolated?",
    a: "By the database, not the app. Postgres 16 row-level security runs below the ORM — a non-owner role, FORCE ROW LEVEL SECURITY, and a request-scoped tenant binding that fails closed (ADR-0001).",
  },
  {
    q: "Which frameworks are covered?",
    a: "Nine, mapping 678 controls: SOC 2, ISO 27001, HIPAA, GDPR, PCI DSS, DPDPA, ISO 42001, PDPPL, and NIST 800-53. Every finding maps to the controls it affects.",
  },
  {
    q: "Is there a hosted option?",
    a: "A managed cloud is planned at blackfyre.tech — join for early access. Production isn't live yet, so self-hosting is the way to run Blackfyre today.",
  },
] as const;
