/**
 * bundle-assembler.ts
 * Top-level orchestrator. Reads all findings, runs all generators,
 * writes fake-org/scan-bundle.json.
 *
 * Gracefully handles missing azure/gcp findings.json.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { generateEvidence, type Finding } from "./evidence-generator.js";
import { generateDrift } from "./drift-generator.js";
import { generateThreatIntel } from "./threat-intel-generator.js";
import { generateRemediations } from "./remediation-generator.js";
import { generatePolicies } from "./policy-generator.js";
import { generateReports } from "./report-generator.js";
import { generateLearning } from "./learning-generator.js";
import { generateComplianceScores } from "./compliance-scorer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_ORG_DIR = resolve(__dirname, "..");
const OUTPUT_PATH = resolve(FAKE_ORG_DIR, "scan-bundle.json");

const TENANT_ID = "tenant-acme-bank-001";
const SCAN_ID = "scan-" + createHash("sha256").update("acme-bank-2026-q1").digest("hex").slice(0, 12);

// ─── helpers ─────────────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function readJsonSafe(path: string, fallback: unknown[] = []): unknown[] {
  if (!existsSync(path)) {
    console.warn(`  [WARN] Missing: ${path} — using empty fallback`);
    return fallback;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    // Support both {findings:[...]} and [...] shapes
    if (Array.isArray(parsed)) return parsed;
    if (parsed.findings && Array.isArray(parsed.findings)) return parsed.findings;
    return fallback;
  } catch (e) {
    console.warn(`  [WARN] Failed to parse ${path}: ${e}`);
    return fallback;
  }
}

function assignFindingIds(findings: Finding[], cloudPrefix: string): Finding[] {
  return findings.map((f, idx) => ({
    ...f,
    id: f.id || `f-${cloudPrefix}-${sha256(f.resourceId + f.title).slice(0, 8)}-${idx}`,
    cloud: f.cloud || cloudPrefix,
  }));
}

// ─── static data ─────────────────────────────────────────────────────────────

function buildTeam() {
  const members = [
    { id: "u-001", name: "Priya Sharma", role: "CISO", email: "priya.sharma@acme-bank.com", avatar: null, joinedAt: "2022-03-01", mfaEnabled: true },
    { id: "u-002", name: "Aditya Verma", role: "Cloud Security Architect", email: "aditya.verma@acme-bank.com", avatar: null, joinedAt: "2022-07-15", mfaEnabled: true },
    { id: "u-003", name: "Meera Nair", role: "Security Engineer", email: "meera.nair@acme-bank.com", avatar: null, joinedAt: "2023-01-10", mfaEnabled: true },
    { id: "u-004", name: "Rahul Gupta", role: "Compliance Analyst", email: "rahul.gupta@acme-bank.com", avatar: null, joinedAt: "2023-04-01", mfaEnabled: false },
    { id: "u-005", name: "Sneha Pillai", role: "SOC Analyst", email: "sneha.pillai@acme-bank.com", avatar: null, joinedAt: "2023-09-01", mfaEnabled: true },
    { id: "u-006", name: "Vikram Singh", role: "DevSecOps Engineer", email: "vikram.singh@acme-bank.com", avatar: null, joinedAt: "2024-02-01", mfaEnabled: true },
    { id: "u-007", name: "Ananya Krishnan", role: "GRC Manager", email: "ananya.krishnan@acme-bank.com", avatar: null, joinedAt: "2024-06-01", mfaEnabled: true },
    { id: "u-008", name: "Dev Patel", role: "Penetration Tester", email: "dev.patel@acme-bank.com", avatar: null, joinedAt: "2025-01-15", mfaEnabled: true },
  ];
  return members;
}

function buildIntegrations() {
  return [
    { id: "intg-aws-prod-001", provider: "aws", name: "AWS Production", accountId: "123456789012", region: "us-east-1", status: "healthy", lastSyncAt: new Date(Date.now() - 3600000).toISOString(), findingsCount: 39 },
    { id: "intg-aws-stg-002", provider: "aws", name: "AWS Staging", accountId: "987654321098", region: "us-east-1", status: "healthy", lastSyncAt: new Date(Date.now() - 7200000).toISOString(), findingsCount: 12 },
    { id: "intg-azure-prod-002", provider: "azure", name: "Azure Production", subscriptionId: "sub-acme-001", tenantId: "aad-acme-001", status: "healthy", lastSyncAt: new Date(Date.now() - 5400000).toISOString(), findingsCount: 40 },
    { id: "intg-gcp-prod-003", provider: "gcp", name: "GCP Production", projectId: "acme-bank-prod", organizationId: "org-acme-001", status: "healthy", lastSyncAt: new Date(Date.now() - 4800000).toISOString(), findingsCount: 35 },
    { id: "intg-k8s-prod-004", provider: "kubernetes", name: "EKS Production Cluster", clusterArn: "arn:aws:eks:us-east-1:123456789012:cluster/acme-prod", status: "healthy", lastSyncAt: new Date(Date.now() - 3600000).toISOString(), findingsCount: 8 },
    { id: "intg-github-001", provider: "github", name: "GitHub Enterprise", orgName: "acme-bank", status: "healthy", lastSyncAt: new Date(Date.now() - 86400000).toISOString(), findingsCount: 5 },
    { id: "intg-jira-001", provider: "jira", name: "Jira Cloud", projectKey: "SEC", status: "healthy", lastSyncAt: new Date(Date.now() - 1800000).toISOString(), findingsCount: 0 },
  ];
}

function buildSubscription() {
  return {
    id: "sub-acme-bank-001",
    tenantId: TENANT_ID,
    plan: "enterprise",
    status: "active",
    seats: 25,
    usedSeats: 8,
    features: ["multi-cloud", "auto-remediation", "ai-insights", "compliance-reports", "threat-intel", "policy-management"],
    billingCycle: "annual",
    renewalDate: "2027-04-01",
    contractValue: 84000,
    currency: "USD",
  };
}

function buildAlerts(findings: Finding[]) {
  const criticalFindings = findings.filter((f) => f.severity === "critical").slice(0, 5);
  return [
    ...criticalFindings.map((f, idx) => ({
      id: `alert-${idx + 1}`,
      type: "new_critical_finding",
      severity: "critical",
      title: f.title,
      message: `Critical finding detected: ${f.title} on ${f.resourceId}`,
      findingId: f.id,
      createdAt: new Date(Date.now() - idx * 3600000).toISOString(),
      acknowledged: false,
      assignedTo: null,
    })),
    {
      id: "alert-drift-1",
      type: "drift_detected",
      severity: "high",
      title: "CloudTrail trail deleted",
      message: "A CloudTrail trail was deleted in us-east-1. Audit visibility impacted.",
      findingId: null,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      acknowledged: false,
      assignedTo: "aditya.verma@acme-bank.com",
    },
    {
      id: "alert-cve-1",
      type: "new_cve_correlation",
      severity: "critical",
      title: "New critical CVE correlated to 4 findings",
      message: "CVE-2026-90001 (Kubernetes RBAC RCE) correlates to 4 open findings. Exploit in wild confirmed.",
      findingId: null,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      acknowledged: false,
      assignedTo: null,
    },
    {
      id: "alert-score-drop",
      type: "compliance_score_drop",
      severity: "medium",
      title: "SOC2 score dropped 3 points",
      message: "SOC2 compliance score dropped from 68 to 65 due to 2 new high-severity findings.",
      findingId: null,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      acknowledged: true,
      assignedTo: "rahul.gupta@acme-bank.com",
    },
  ];
}

function buildScanHistory(allFindings: Finding[]) {
  const scans = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const scanDate = d.toISOString();
    const count = Math.max(20, allFindings.length - Math.floor(i * 0.5));
    scans.push({
      id: `scan-hist-${i}`,
      tenantId: TENANT_ID,
      startedAt: scanDate,
      completedAt: new Date(d.getTime() + 5 * 60000).toISOString(),
      status: "completed",
      totalFindings: count,
      newFindings: i === 0 ? allFindings.length : Math.floor(Math.random() * 5),
      resolvedFindings: i === 0 ? 0 : Math.floor(Math.random() * 3),
      clouds: ["aws", "azure", "gcp"],
    });
  }
  return scans;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Blackfyre Scan Bundle Assembler ===\n");

  // 1. Load findings from all clouds
  const awsFindingsRaw = readJsonSafe(resolve(FAKE_ORG_DIR, "last-scan.json"));
  const azureFindingsRaw = readJsonSafe(resolve(FAKE_ORG_DIR, "azure", "findings.json"));
  const gcpFindingsRaw = readJsonSafe(resolve(FAKE_ORG_DIR, "gcp", "findings.json"));

  const awsFindings = assignFindingIds(awsFindingsRaw as Finding[], "aws");
  const azureFindings = assignFindingIds(azureFindingsRaw as Finding[], "azure");
  const gcpFindings = assignFindingIds(gcpFindingsRaw as Finding[], "gcp");

  const allFindings = [...awsFindings, ...azureFindings, ...gcpFindings];

  console.log(`Findings loaded:`);
  console.log(`  AWS:   ${awsFindings.length}`);
  console.log(`  Azure: ${azureFindings.length}`);
  console.log(`  GCP:   ${gcpFindings.length}`);
  console.log(`  Total: ${allFindings.length}\n`);

  // 2. Run generators
  console.log("Running generators...");

  process.stdout.write("  evidence...");
  const evidence = generateEvidence(allFindings, SCAN_ID);
  console.log(` ${evidence.length}`);

  process.stdout.write("  drift...");
  const drift = generateDrift(allFindings);
  console.log(` ${drift.length}`);

  process.stdout.write("  threat intel...");
  const threatIntel = generateThreatIntel(allFindings);
  console.log(` ${threatIntel.cves.length} CVEs, ${threatIntel.correlations.length} correlations`);

  process.stdout.write("  remediations...");
  const remediations = generateRemediations(allFindings);
  console.log(` ${remediations.length}`);

  process.stdout.write("  policies...");
  const policies = generatePolicies();
  console.log(` ${policies.length}`);

  process.stdout.write("  reports...");
  const reports = generateReports(allFindings);
  console.log(` ${reports.length}`);

  process.stdout.write("  learning...");
  const learning = generateLearning();
  console.log(` ${learning.patterns.length} industries`);

  process.stdout.write("  compliance scores...");
  const compliance = generateComplianceScores(allFindings);
  console.log(` ${compliance.scores.length} frameworks`);

  // 3. Build static data
  const team = buildTeam();
  const integrations = buildIntegrations();
  const subscription = buildSubscription();
  const alerts = buildAlerts(allFindings);
  const scans = buildScanHistory(allFindings);

  // 4. Build metadata
  const bySeverity: Record<string, number> = {};
  const byCloud: Record<string, number> = { aws: awsFindings.length, azure: azureFindings.length, gcp: gcpFindings.length };
  for (const f of allFindings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  const bundle = {
    metadata: {
      generatedAt: new Date().toISOString(),
      scanId: SCAN_ID,
      tenantId: TENANT_ID,
      totalFindings: allFindings.length,
      byCloud,
      bySeverity,
      version: "1.0.0",
    },
    scans,
    findings: allFindings,
    evidence,
    drift,
    threatIntel,
    remediations,
    policies,
    reports,
    compliance,
    learning,
    team,
    integrations,
    subscription,
    alerts,
  };

  // 5. Validate and write
  const json = JSON.stringify(bundle, null, 2);
  // Validate it can be parsed back
  JSON.parse(json);

  writeFileSync(OUTPUT_PATH, json, "utf-8");

  const sizeMb = (Buffer.byteLength(json, "utf-8") / 1024).toFixed(1);

  console.log("\n=== Bundle Written ===");
  console.log(`  Path: ${OUTPUT_PATH}`);
  console.log(`  Size: ${sizeMb} KB`);
  console.log("\nTop-level key counts:");
  console.log(`  findings:      ${bundle.findings.length}`);
  console.log(`  evidence:      ${bundle.evidence.length}`);
  console.log(`  drift:         ${bundle.drift.length}`);
  console.log(`  threatIntel:   cves=${bundle.threatIntel.cves.length}, correlations=${bundle.threatIntel.correlations.length}`);
  console.log(`  remediations:  ${bundle.remediations.length}`);
  console.log(`  policies:      ${bundle.policies.length}`);
  console.log(`  reports:       ${bundle.reports.length}`);
  console.log(`  compliance:    scores=${bundle.compliance.scores.length}, trend=${bundle.compliance.trend.length}`);
  console.log(`  learning:      patterns=${bundle.learning.patterns.length}`);
  console.log(`  team:          ${bundle.team.length}`);
  console.log(`  integrations:  ${bundle.integrations.length}`);
  console.log(`  scans:         ${bundle.scans.length}`);
  console.log(`  alerts:        ${bundle.alerts.length}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
