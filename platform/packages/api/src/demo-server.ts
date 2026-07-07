/**
 * BLACKFYRE Demo App Builder
 *
 * Exports `buildDemoApp(bundle)` which constructs the Fastify demo API.
 * Two consumers:
 *   - demo-server-runner.ts  → loads scan-bundle.json from filesystem, calls .listen() (used by `npm run demo` for local dev)
 *   - demo-lambda.ts         → imports scan-bundle.json statically, wraps app in @fastify/aws-lambda (deployed via SST stage `demo`)
 *
 * Demo server has no DB, no Redis, no auth — accepts admin@acme.com / any password.
 * Never deploy the real production handler against demo data.
 */

import { createHash, randomBytes } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { getAllFrameworkRegistries } from "./compliance/control-registry.js";
import { calculateFrameworkScore } from "./compliance/scoring.js";
import { getAllIndustryProfiles, getIndustryProfile } from "./compliance/industry-profiles.js";

export const DEMO_PORT = 4001;

const TENANT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Acme Corp",
  slug: "acme-corp",
  plan: "retainer",
  industryProfile: "fintech",
  onboardingStatus: "active",
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-03-27T00:00:00Z",
};

const USER = {
  id: "aaaa1111-1111-1111-1111-111111111111",
  tenantId: TENANT.id,
  email: "admin@acme.com",
  name: "Admin User",
  role: "owner",
};

function getDefaultMockStatuses(): Record<string, Map<string, string>> {
  return {
    soc2: new Map([["CC6.1", "fail"], ["CC6.2", "pass"], ["CC6.3", "pass"], ["CC6.6", "pass"], ["CC6.7", "pass"], ["CC6.8", "partial"], ["CC8.1", "pass"], ["CC3.1", "pass"], ["CC3.2", "partial"], ["CC7.1", "pass"], ["CC7.2", "pass"], ["A1.1", "pass"], ["A1.2", "partial"], ["CC2.1", "pass"], ["CC1.1", "pass"]]),
    iso27001: new Map([["A.8.5", "pass"], ["A.8.3", "pass"], ["A.5.15", "partial"], ["A.8.24", "pass"], ["A.8.20", "pass"], ["A.8.21", "partial"], ["A.8.15", "pass"], ["A.8.16", "pass"], ["A.5.24", "pass"], ["A.5.25", "partial"], ["A.5.9", "pass"], ["A.5.10", "pass"]]),
    hipaa: new Map([["164.312(a)(1)", "pass"], ["164.312(d)", "fail"], ["164.312(b)", "pass"], ["164.312(e)(1)", "pass"], ["164.312(c)(1)", "pass"], ["164.308(a)(1)(i)", "partial"], ["164.308(a)(3)(i)", "pass"], ["164.308(a)(5)(i)", "fail"], ["164.310(a)(1)", "pass"], ["164.310(d)(1)", "pass"]]),
    gdpr: new Map([["Art.32(1)", "pass"], ["Art.25(1)", "pass"], ["Art.25(2)", "partial"], ["Art.7", "pass"], ["Art.17", "partial"], ["Art.20", "pass"], ["Art.33", "pass"], ["Art.34", "pass"], ["Art.30", "pass"], ["Art.35", "partial"], ["Art.46", "na"]]),
    pcidss: new Map([["1.1", "pass"], ["1.2", "pass"], ["3.1", "partial"], ["3.5", "pass"], ["4.1", "pass"], ["7.1", "fail"], ["8.3.1", "fail"], ["8.2.1", "pass"], ["10.1", "pass"], ["10.2", "partial"], ["6.1", "pass"], ["6.2", "pass"], ["11.3", "pass"], ["11.1", "na"]]),
    "nist-csf": new Map([
      ["ID.AM-1", "pass"], ["ID.AM-2", "pass"], ["ID.AM-3", "partial"], ["ID.AM-4", "pass"], ["ID.AM-5", "partial"],
      ["PR.AC-1", "pass"], ["PR.AC-2", "partial"], ["PR.AC-3", "pass"], ["PR.AC-4", "fail"], ["PR.AC-5", "pass"],
      ["PR.DS-1", "pass"], ["PR.DS-2", "pass"], ["PR.DS-3", "partial"], ["PR.DS-4", "pass"],
      ["DE.CM-1", "partial"], ["DE.CM-3", "pass"], ["DE.CM-7", "partial"], ["DE.CM-8", "pass"],
      ["RS.RP-1", "pass"], ["RS.CO-1", "pass"], ["RS.CO-2", "partial"],
      ["RC.RP-1", "pass"], ["RC.IM-1", "partial"],
    ]),
  };
}

export interface DemoBundle {
  findings?: any[];
  scans?: any[];
  remediations?: any[];
  alerts?: any[];
  drift?: any[];
  reports?: any[];
  team?: any[];
  integrations?: any[];
  policies?: any[];
  evidence?: any[];
  threatIntel?: { cves?: any[]; summary?: any };
  subscription?: any;
  compliance?: { scores?: any[]; trend?: any[]; frameworks?: string[] };
  learning?: { patterns?: any[]; byIndustry?: Record<string, any> };
  [key: string]: any;
}

export async function buildDemoApp(bundle: DemoBundle | null = null): Promise<FastifyInstance> {
  // ── Data arrays — prefer bundle, fall back to hardcoded ──────────────

  const findings: any[] = bundle?.findings ?? [
    { id: "f001", scanId: "s001", tenantId: TENANT.id, title: "MFA not enforced on admin accounts", description: "3 admin IAM users lack MFA. ARN: arn:aws:iam::123456789012:user/admin-user-1", severity: "critical", status: "open", category: "iam", resourceType: "IAM User", resourceId: "arn:aws:iam::123456789012:user/admin-user-1", resourceRegion: "us-east-1", remediationTier: "approval", autoFixAvailable: false, dedupHash: "abc1" },
    { id: "f002", scanId: "s001", tenantId: TENANT.id, title: "S3 bucket publicly accessible", description: "Bucket acme-uploads has public read ACL enabled", severity: "critical", status: "open", category: "config", resourceType: "S3 Bucket", resourceId: "arn:aws:s3:::acme-uploads", resourceRegion: "us-east-1", remediationTier: "auto", autoFixAvailable: true, dedupHash: "abc2" },
    { id: "f003", scanId: "s001", tenantId: TENANT.id, title: "CloudTrail logging disabled in us-west-2", description: "No audit trail for us-west-2 region", severity: "high", status: "open", category: "logging", resourceType: "CloudTrail", resourceId: "arn:aws:cloudtrail:us-west-2:123456789012:trail/acme-trail", resourceRegion: "us-west-2", remediationTier: "auto", autoFixAvailable: true, dedupHash: "abc3" },
    { id: "f004", scanId: "s001", tenantId: TENANT.id, title: "TLS 1.0 enabled on load balancer", description: "ALB alb-main accepts TLS 1.0 connections", severity: "high", status: "in_progress", category: "encryption", resourceType: "ALB", resourceId: "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/alb-main/abc123", resourceRegion: "us-east-1", remediationTier: "manual", autoFixAvailable: false, dedupHash: "abc4" },
    { id: "f005", scanId: "s001", tenantId: TENANT.id, title: "Root account has active access keys", description: "AWS root account access key is active and not rotated in 180+ days", severity: "critical", status: "open", category: "iam", resourceType: "Root Account", resourceId: "arn:aws:iam::123456789012:root", resourceRegion: "us-east-1", remediationTier: "manual", autoFixAvailable: false, dedupHash: "abc5" },
    { id: "f006", scanId: "s001", tenantId: TENANT.id, title: "Security group allows 0.0.0.0/0 on SSH", description: "Port 22 open to the internet on sg-0abc12345", severity: "high", status: "resolved", category: "network", resourceType: "Security Group", resourceId: "arn:aws:ec2:us-east-1:123456789012:security-group/sg-0abc12345", resourceRegion: "us-east-1", remediationTier: "auto", autoFixAvailable: true, dedupHash: "abc6" },
    { id: "f007", scanId: "s001", tenantId: TENANT.id, title: "Okta MFA not enforced for all users", description: "12 of 48 Okta users have MFA disabled", severity: "medium", status: "open", category: "identity", resourceType: "Okta Policy", resourceId: "00p1abc123MFApolicy", resourceRegion: null, remediationTier: "approval", autoFixAvailable: false, dedupHash: "abc7" },
    { id: "f008", scanId: "s001", tenantId: TENANT.id, title: "Jamf FileVault not enabled on 5 devices", description: "FileVault disk encryption disabled on 5 managed macOS devices", severity: "medium", status: "acknowledged", category: "endpoint", resourceType: "Jamf Policy", resourceId: "jamf-policy-filevault-001", resourceRegion: null, remediationTier: "manual", autoFixAvailable: false, dedupHash: "abc8" },
    { id: "f009", scanId: "s002", tenantId: TENANT.id, title: "EC2 instance using IMDSv1", description: "Instance i-0abc1234 accepts IMDSv1 requests, exposing metadata to SSRF", severity: "high", status: "open", category: "config", resourceType: "EC2 Instance", resourceId: "arn:aws:ec2:us-east-1:123456789012:instance/i-0abc12345678", resourceRegion: "us-east-1", remediationTier: "auto", autoFixAvailable: true, dedupHash: "abc9" },
    { id: "f010", scanId: "s002", tenantId: TENANT.id, title: "EC2 instance not using approved AMI", description: "Instance i-0def5678 running end-of-life Amazon Linux 1", severity: "medium", status: "open", category: "config", resourceType: "EC2 Instance", resourceId: "arn:aws:ec2:us-east-1:123456789012:instance/i-0def56789012", resourceRegion: "us-east-1", remediationTier: "manual", autoFixAvailable: false, dedupHash: "abc10" },
  ];

  const scans: any[] = (bundle?.scans ?? []).map((s: any) => ({
    triggeredBy: s.triggeredBy ?? "u001",
    frameworks: s.frameworks ?? ["soc2", "iso27001"],
    targets: s.targets ?? s.clouds ?? [],
    progress: s.progress ?? (s.status === "completed" ? 100 : s.status === "in_progress" ? 50 : 0),
    errorDetails: s.errorDetails ?? null,
    agentSwarmId: s.agentSwarmId ?? `swarm_${s.id}`,
    ...s,
  })).concat(bundle?.scans ? [] : [
    { id: "s001", tenantId: TENANT.id, triggeredBy: USER.id, frameworks: ["soc2", "hipaa"], targets: ["aws", "okta", "jamf"], status: "completed", progress: 100, startedAt: "2026-05-06T10:00:00Z", completedAt: "2026-05-06T10:15:00Z", errorDetails: null, agentSwarmId: "swarm_s001" },
    { id: "s002", tenantId: TENANT.id, triggeredBy: USER.id, frameworks: ["soc2", "iso27001", "gdpr"], targets: ["aws", "azure", "okta"], status: "completed", progress: 100, startedAt: "2026-05-04T08:00:00Z", completedAt: "2026-05-04T08:22:00Z", errorDetails: null, agentSwarmId: "swarm_s002" },
    { id: "s003", tenantId: TENANT.id, triggeredBy: USER.id, frameworks: ["pcidss"], targets: ["gcp"], status: "completed", progress: 100, startedAt: "2026-05-02T14:00:00Z", completedAt: "2026-05-02T14:18:00Z", errorDetails: null, agentSwarmId: "swarm_s003" },
    { id: "s029", tenantId: TENANT.id, triggeredBy: USER.id, frameworks: ["soc2"], targets: ["aws"], status: "in_progress", progress: 62, startedAt: "2026-05-07T09:00:00Z", completedAt: null, errorDetails: null, agentSwarmId: "swarm_s029" },
    { id: "s030", tenantId: TENANT.id, triggeredBy: USER.id, frameworks: ["pcidss", "hipaa", "soc2"], targets: ["aws", "azure", "gcp", "okta", "jamf"], status: "queued", progress: 0, startedAt: null, completedAt: null, errorDetails: null, agentSwarmId: null },
  ]);

  const remediations: any[] = bundle?.remediations ?? [
    { id: "r001", findingId: "f002", tier: "auto", status: "completed", approvedBy: USER.id, beforeSnapshot: { acl: "public-read" }, afterSnapshot: { acl: "private" }, playbookContent: "aws s3api put-public-access-block --bucket acme-uploads --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true", executedAt: "2026-05-06T11:00:00Z", completedAt: "2026-05-06T11:01:00Z" },
    { id: "r002", findingId: "f003", tier: "auto", status: "executing", approvedBy: USER.id, beforeSnapshot: null, afterSnapshot: null, playbookContent: "aws cloudtrail create-trail --name acme-trail --s3-bucket-name acme-cloudtrail-logs --is-multi-region-trail", executedAt: "2026-05-07T09:00:00Z", completedAt: null },
    { id: "r003", findingId: "f001", tier: "approval", status: "pending", approvedBy: null, beforeSnapshot: null, afterSnapshot: null, playbookContent: null, executedAt: null, completedAt: null },
  ];

  const alertRules: any[] = bundle?.alerts ?? [
    { id: "a001", tenantId: TENANT.id, triggerType: "severity", triggerConfig: { minSeverity: "critical" }, channels: ["email", "slack"], quietHoursStart: null, quietHoursEnd: null, quietHoursTz: null, enabled: true },
    { id: "a002", tenantId: TENANT.id, triggerType: "scan_complete", triggerConfig: {}, channels: ["email"], quietHoursStart: null, quietHoursEnd: null, quietHoursTz: null, enabled: true },
    { id: "a003", tenantId: TENANT.id, triggerType: "drift", triggerConfig: { changeTypes: ["deleted", "modified"] }, channels: ["slack", "webhook"], quietHoursStart: "22:00", quietHoursEnd: "07:00", quietHoursTz: "America/New_York", enabled: false },
  ];

  const driftEvents: any[] = bundle?.drift ?? [
    { id: "d001", tenantId: TENANT.id, integrationId: "int-aws", changeType: "modified", resourceType: "Security Group", resourceId: "sg-12345", beforeState: { ingressRules: [] }, afterState: { ingressRules: [{ port: 22, cidr: "0.0.0.0/0" }] }, severity: "high", acknowledged: false, detectedAt: "2026-05-07T08:30:00Z" },
    { id: "d002", tenantId: TENANT.id, integrationId: "int-aws", changeType: "deleted", resourceType: "IAM Policy", resourceId: "policy-readonly", beforeState: { policyDocument: "{}" }, afterState: null, severity: "critical", acknowledged: false, detectedAt: "2026-05-07T07:15:00Z" },
    { id: "d003", tenantId: TENANT.id, integrationId: "int-okta", changeType: "created", resourceType: "Okta User", resourceId: "user-new-admin", beforeState: null, afterState: { roles: ["super-admin"] }, severity: "medium", acknowledged: true, detectedAt: "2026-05-06T22:00:00Z" },
  ];

  const reports: any[] = bundle?.reports ?? [
    { id: "rpt001", tenantId: TENANT.id, type: "readiness", framework: "soc2", status: "ready", storagePath: "/reports/soc2-readiness-2026-05.pdf", shareToken: "tok_rpt001share", generatedAt: "2026-05-06T12:00:00Z", expiresAt: "2026-08-06T12:00:00Z" },
    { id: "rpt002", tenantId: TENANT.id, type: "gap_analysis", framework: "hipaa", status: "ready", storagePath: "/reports/hipaa-gap-2026-04.pdf", shareToken: "tok_rpt002share", generatedAt: "2026-04-30T09:00:00Z", expiresAt: "2026-07-30T09:00:00Z" },
  ];

  const teamMembers: any[] = bundle?.team ?? [
    { id: "tm001", tenantId: TENANT.id, name: "Arjun Mehta", email: "arjun@acme.com", role: "owner", status: "active", lastLoginAt: "2026-05-07T08:12:00Z" },
    { id: "tm002", tenantId: TENANT.id, name: "Priya Sharma", email: "priya@acme.com", role: "admin", status: "active", lastLoginAt: "2026-05-06T17:45:00Z" },
    { id: "tm003", tenantId: TENANT.id, name: "Daniel Park", email: "daniel@acme.com", role: "admin", status: "active", lastLoginAt: "2026-05-07T07:30:00Z" },
    { id: "tm004", tenantId: TENANT.id, name: "Sofia Reyes", email: "sofia@acme.com", role: "engineer", status: "active", lastLoginAt: "2026-05-05T14:20:00Z" },
    { id: "tm005", tenantId: TENANT.id, name: "Marcus Johnson", email: "marcus@acme.com", role: "engineer", status: "active", lastLoginAt: "2026-05-06T09:10:00Z" },
    { id: "tm006", tenantId: TENANT.id, name: "Aisha Williams", email: "aisha@acme.com", role: "viewer", status: "active", lastLoginAt: "2026-05-04T16:00:00Z" },
    { id: "tm007", tenantId: TENANT.id, name: "Rohan Gupta", email: "rohan@acme.com", role: "viewer", status: "invited", lastLoginAt: null },
    { id: "tm008", tenantId: TENANT.id, name: "Elena Volkov", email: "elena@acme.com", role: "engineer", status: "invited", lastLoginAt: null },
  ];

  const HARDCODED_INTEGRATIONS = [
    { id: "int-aws", tenantId: TENANT.id, type: "aws", name: "AWS (Production)", status: "connected", lastSyncAt: "2026-05-07T08:00:00Z", config: { accountId: "123456789012", region: "us-east-1", roleArn: "arn:aws:iam::123456789012:role/BlackfyreAuditRole" } },
    { id: "int-azure", tenantId: TENANT.id, type: "azure", name: "Azure (Production)", status: "connected", lastSyncAt: "2026-05-07T07:45:00Z", config: { subscriptionId: "aaaabbbb-1234-5678-9012-aabbccddeeff", tenantId: "ccccdddd-1234-5678-9012-aabbccddeeff" } },
    { id: "int-gcp", tenantId: TENANT.id, type: "gcp", name: "GCP (acme-prod)", status: "disconnected", lastSyncAt: null, config: { projectId: "acme-prod", serviceAccount: "blackfyre-audit@acme-prod.iam.gserviceaccount.com" } },
    { id: "int-okta", tenantId: TENANT.id, type: "okta", name: "Okta", status: "connected", lastSyncAt: "2026-05-07T06:30:00Z", config: { domain: "acme.okta.com", apiToken: "00••••••••••••••••" } },
    { id: "int-jamf", tenantId: TENANT.id, type: "jamf", name: "Jamf Pro", status: "connected", lastSyncAt: "2026-05-06T23:00:00Z", config: { serverUrl: "https://acme.jamfcloud.com", clientId: "jamf-client-abc123" } },
    { id: "int-slack", tenantId: TENANT.id, type: "slack", name: "Slack (#security-alerts)", status: "connected", lastSyncAt: "2026-05-07T09:00:00Z", config: { webhookUrl: "https://hooks.slack.com/services/T00/B00/abc123", channel: "#security-alerts" } },
    { id: "int-jira", tenantId: TENANT.id, type: "jira", name: "Jira (acme.atlassian.net)", status: "disconnected", lastSyncAt: null, config: { baseUrl: "https://acme.atlassian.net", projectKey: "SEC" } },
  ];
  const integrations: any[] = bundle?.integrations
    ? bundle.integrations.map((i: any) => ({
        id: i.id,
        tenantId: TENANT.id,
        type: i.provider ?? i.type,
        name: i.name,
        status: i.status === "healthy" ? "connected" : i.status === "degraded" ? "error" : (i.status ?? "disconnected"),
        lastSyncAt: i.lastSyncAt ?? null,
        config: { accountId: i.accountId, region: i.region, ...(i.config ?? {}) },
      }))
    : HARDCODED_INTEGRATIONS;

  const policies: any[] = bundle?.policies ?? [
    { id: "pol001", tenantId: TENANT.id, title: "Access Control Policy", category: "access", status: "active", framework: "soc2", version: "2.1", lastReviewedAt: "2026-04-01T00:00:00Z", nextReviewAt: "2026-10-01T00:00:00Z", ownerId: "tm002", controlIds: ["CC6.1", "CC6.2", "CC6.3"] },
    { id: "pol002", tenantId: TENANT.id, title: "Data Classification & Protection Policy", category: "data", status: "active", framework: "hipaa", version: "1.4", lastReviewedAt: "2026-03-15T00:00:00Z", nextReviewAt: "2026-09-15T00:00:00Z", ownerId: "tm002", controlIds: ["164.312(a)(1)", "164.312(e)(1)"] },
    { id: "pol003", tenantId: TENANT.id, title: "Incident Response Plan", category: "incident", status: "active", framework: "soc2", version: "3.0", lastReviewedAt: "2026-02-01T00:00:00Z", nextReviewAt: "2026-08-01T00:00:00Z", ownerId: "tm001", controlIds: ["CC7.2", "CC7.3"] },
  ];

  const evidence: any[] = (bundle?.evidence ?? []).length > 0
    ? bundle!.evidence!.map((e: any) => ({
        ...e,
        tenantId: e.tenantId ?? TENANT.id,
        name: e.name ?? `${e.type ?? "snapshot"}: ${(e.storagePath ?? "").split("/").pop()}`,
        sha256Hash: e.sha256Hash ?? e.hash ?? "",
        uploadedAt: e.uploadedAt ?? e.collectedAt ?? new Date().toISOString(),
        uploadedBy: e.uploadedBy ?? e.collectedBy ?? "auditor",
        framework: e.framework ?? "soc2",
        controlId: e.controlId ?? "CC6.1",
      }))
    : [
        { id: "ev001", tenantId: TENANT.id, name: "IAM Config Snapshot", type: "config", framework: "soc2", controlId: "CC6.1", sha256Hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", storagePath: "/evidence/iam-config-2026-05-06.json", uploadedAt: "2026-05-06T10:05:00Z", uploadedBy: "cloud-auditor-aws" },
        { id: "ev002", tenantId: TENANT.id, name: "S3 ACL Response", type: "config", framework: "soc2", controlId: "CC6.6", sha256Hash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", storagePath: "/evidence/s3-acl-2026-05-06.json", uploadedAt: "2026-05-06T10:06:00Z", uploadedBy: "cloud-auditor-aws" },
        { id: "ev003", tenantId: TENANT.id, name: "Penetration Test Report Q1 2026", type: "document", framework: "pcidss", controlId: "11.3", sha256Hash: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6", storagePath: "/evidence/pentest-q1-2026.pdf", uploadedAt: "2026-04-01T09:00:00Z", uploadedBy: "tm003" },
      ];

  const threatIntelCVEs: any[] = bundle?.threatIntel?.cves ?? [
    { id: "CVE-2024-21762", title: "Fortinet FortiOS SSL VPN RCE", severity: "critical", cvssScore: 9.6, publishedAt: "2024-02-08", affects: [], patched: false },
    { id: "CVE-2024-3400", title: "PAN-OS GlobalProtect OS Command Injection", severity: "critical", cvssScore: 10.0, publishedAt: "2024-04-12", affects: ["f017"], patched: false },
    { id: "CVE-2025-21298", title: "Windows OLE Remote Code Execution", severity: "critical", cvssScore: 9.8, publishedAt: "2025-01-14", affects: ["f034"], patched: true },
    { id: "CVE-2025-0282", title: "Ivanti Connect Secure Stack Buffer Overflow", severity: "critical", cvssScore: 9.0, publishedAt: "2025-01-08", affects: [], patched: false },
    { id: "CVE-2024-47575", title: "Fortinet FortiManager FGFM Unauthorized Code Execution", severity: "critical", cvssScore: 9.8, publishedAt: "2024-10-23", affects: [], patched: false },
    { id: "CVE-2024-6387", title: "OpenSSH regreSSHion RCE (glibc Linux)", severity: "critical", cvssScore: 8.1, publishedAt: "2024-07-01", affects: ["f006"], patched: true },
  ];

  const subscription: any = bundle?.subscription ?? {
    plan: "retainer", status: "active", seats: 10, usedSeats: 6, mrr: 2499, currency: "USD", billingCycle: "monthly",
    currentPeriodStart: "2026-05-01T00:00:00Z", nextBillingDate: "2026-06-01T00:00:00Z",
    trialEndsAt: null, cancelledAt: null,
    features: ["unlimited_scans", "ai_remediation", "threat_intel", "policy_designer", "trust_center"],
    paymentHistory: [
      { id: "pay001", amount: 2499, currency: "USD", status: "paid", date: "2026-05-01T00:00:00Z", invoiceUrl: "/invoices/pay001.pdf" },
      { id: "pay002", amount: 2499, currency: "USD", status: "paid", date: "2026-04-01T00:00:00Z", invoiceUrl: "/invoices/pay002.pdf" },
      { id: "pay003", amount: 2499, currency: "USD", status: "paid", date: "2026-03-01T00:00:00Z", invoiceUrl: "/invoices/pay003.pdf" },
    ],
  };

  const policyTemplates: any[] = [
    { id: "tpl001", title: "SOC 2 Access Control Policy", framework: "soc2", category: "access", description: "Pre-built Access Control Policy aligned to CC6 criteria" },
    { id: "tpl002", title: "HIPAA Security Rule Policy", framework: "hipaa", category: "data", description: "Covers 164.308 Administrative Safeguards" },
    { id: "tpl003", title: "GDPR Article 30 Records of Processing", framework: "gdpr", category: "privacy", description: "Records of processing activities template" },
    { id: "tpl004", title: "ISO 27001 Cryptography Policy", framework: "iso27001", category: "encryption", description: "Aligned to Annex A.8.24 Use of cryptography" },
    { id: "tpl005", title: "PCI DSS Vulnerability Management", framework: "pcidss", category: "vuln", description: "Covers Requirements 6 and 11" },
    { id: "tpl006", title: "NIST CSF Incident Response", framework: "nist-csf", category: "incident", description: "Covers RS.RP and RC.RP subcategories" },
  ];

  const userSettings: any = {
    user: { name: USER.name, email: USER.email, role: USER.role },
    displayName: USER.name, email: USER.email, timezone: "America/New_York", twoFactorEnabled: true,
    notifications: { email: true, slack: true, webhook: false, sms: false, inApp: true },
  };

  const scanConfig: any = {
    frameworks: ["soc2", "hipaa", "iso27001", "gdpr"],
    frequency: "weekly",
    targets: ["aws", "azure", "gcp", "okta", "jamf"],
    schedule: { enabled: true, cron: "0 8 * * 1", timezone: "America/New_York" },
    notifications: { onComplete: true, onFailure: true },
    exclusions: [],
    agentConcurrency: 5,
  };

  const apiKeys: any[] = [
    { id: "key001", name: "CI/CD Pipeline", prefix: "bfk_live_abc", createdAt: "2026-02-15T00:00:00Z", lastUsedAt: "2026-05-07T08:50:00Z", expiresAt: "2027-02-15T00:00:00Z" },
    { id: "key002", name: "Monitoring Integration", prefix: "bfk_live_def", createdAt: "2026-03-01T00:00:00Z", lastUsedAt: "2026-05-06T22:00:00Z", expiresAt: null },
  ];

  function getDemoScores() {
    return getAllFrameworkRegistries().map((reg) => {
      if (bundle?.compliance?.scores) {
        const bs = bundle.compliance.scores.find((s: any) => s.framework === reg.framework);
        if (bs?.controlStatuses) {
          return calculateFrameworkScore(reg.framework, reg.controls, new Map(Object.entries(bs.controlStatuses)) as any);
        }
      }
      const statusMap = getDefaultMockStatuses()[reg.framework] ?? new Map();
      return calculateFrameworkScore(reg.framework, reg.controls, statusMap as any);
    });
  }

  // ── Build Fastify app ────────────────────────────────────────────────

  const app = Fastify({ logger: false });
  // Skip Fastify cors when running inside Lambda — the Lambda Function URL
  // CORS config handles headers there. Registering cors here too would produce
  // duplicate access-control-allow-origin headers that browsers reject.
  // Local `npm run demo` (no Lambda env) still gets cors so localhost cross-port works.
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    await app.register(cors, { origin: true, credentials: true });
  }

  const demoToken = "demo-token-for-local-development";

  // ── Auth ──
  app.post("/api/auth/login", async () => ({ accessToken: demoToken, refreshToken: "demo-refresh", user: USER }));
  app.post("/api/auth/register", async () => ({ accessToken: demoToken, refreshToken: "demo-refresh", user: USER }));
  app.post("/api/auth/refresh", async () => ({ accessToken: demoToken, refreshToken: "demo-refresh" }));
  app.post("/api/auth/mfa/verify", async () => ({ accessToken: demoToken, refreshToken: "demo-refresh", user: USER }));
  app.post("/api/auth/forgot-password", async () => ({ success: true, message: "If that email is registered you will receive a reset link shortly." }));
  app.post("/api/auth/reset-password", async () => ({ success: true, message: "Password has been reset. You can now log in with your new password." }));

  // ── Health ──
  app.get("/api/health", async () => ({
    status: "healthy", version: "0.1.0-demo", uptime: process.uptime(),
    checks: { database: "in-memory", redis: "not-needed" },
    timestamp: new Date().toISOString(),
  }));
  app.get("/api/health/live", async () => ({ status: "ok" }));
  app.get("/api/health/ready", async () => ({ status: "ok" }));

  // ── Tenants / Clients ──
  app.get("/api/clients", async () => ({ clients: [TENANT] }));
  app.get("/api/clients/:id", async () => ({ client: TENANT }));

  // ── Scans ──
  app.get("/api/scans", async () => ({ scans, pagination: { limit: 50, offset: 0, total: scans.length } }));
  app.post("/api/scans", async () => ({ scan: { ...scans[scans.length - 1], id: "s-new-" + Date.now(), status: "queued" } }));
  app.get("/api/scans/:id", async (req: any) => ({ scan: scans.find((s) => s.id === req.params.id) ?? scans[0] }));
  app.get("/api/scans/config", async () => scanConfig);
  app.patch("/api/scans/config", async (req: any) => { Object.assign(scanConfig, req.body ?? {}); return scanConfig; });

  // ── Findings ──
  app.get("/api/findings", async (req: any) => {
    let result = [...findings];
    const q = req.query as any;
    if (q.severity) result = result.filter((f) => f.severity === q.severity);
    if (q.status) result = result.filter((f) => f.status === q.status);
    if (q.category) result = result.filter((f) => f.category === q.category);
    return { findings: result, pagination: { limit: 50, offset: 0, total: result.length } };
  });
  app.get("/api/findings/:id", async (req: any) => ({ finding: findings.find((f) => f.id === req.params.id) ?? findings[0] }));
  app.patch("/api/findings/:id", async (req: any) => {
    const idx = findings.findIndex((f) => f.id === req.params.id);
    if (idx !== -1) Object.assign(findings[idx], req.body ?? {});
    return { finding: findings[idx !== -1 ? idx : 0] };
  });
  app.post("/api/findings/:id", async (req: any) => {
    const idx = findings.findIndex((f) => f.id === req.params.id);
    if (idx !== -1) Object.assign(findings[idx], req.body ?? {});
    return { finding: findings[idx !== -1 ? idx : 0] };
  });

  // ── Compliance ──
  app.get("/api/compliance/scores", async () => ({ scores: getDemoScores() }));
  app.get("/api/compliance/matrix/:framework", async (req: any) => {
    const fw = req.params.framework;
    const reg = getAllFrameworkRegistries().find((r) => r.framework === fw);
    if (!reg) return { error: "Unknown framework" };
    const scores = getDemoScores().find((s) => s.framework === fw);
    return {
      matrix: {
        framework: reg.framework, version: reg.version, score: scores?.score ?? 0,
        entries: reg.controls.map((c) => ({
          controlId: c.controlId, controlName: c.controlName, weight: c.weight,
          category: c.category, status: ["pass", "partial", "fail"][Math.floor(Math.random() * 3)],
          findingIds: [], evidenceCount: Math.floor(Math.random() * 3),
        })),
      },
    };
  });
  app.get("/api/compliance/trend", async (req: any) => {
    const fw = (req.query as any).framework ?? "soc2";
    if (bundle?.compliance?.trend) return { trend: { framework: fw, points: bundle.compliance.trend } };
    return {
      trend: {
        framework: fw,
        points: [
          { scanId: "s028", score: 62, snapshotAt: "2026-03-12T00:00:00Z" },
          { scanId: "s022", score: 68, snapshotAt: "2026-03-24T00:00:00Z" },
          { scanId: "s019", score: 71, snapshotAt: "2026-03-30T00:00:00Z" },
          { scanId: "s013", score: 74, snapshotAt: "2026-04-11T00:00:00Z" },
          { scanId: "s008", score: 78, snapshotAt: "2026-04-20T00:00:00Z" },
          { scanId: "s002", score: 81, snapshotAt: "2026-05-04T00:00:00Z" },
          { scanId: "s001", score: 84, snapshotAt: "2026-05-06T00:00:00Z" },
        ],
      },
    };
  });
  app.get("/api/compliance/frameworks", async () => {
    if (bundle?.compliance?.frameworks) {
      return {
        frameworks: getAllFrameworkRegistries()
          .filter((r) => bundle!.compliance!.frameworks!.includes(r.framework))
          .map((r) => ({ framework: r.framework, version: r.version, totalControls: r.totalControls })),
      };
    }
    return { frameworks: getAllFrameworkRegistries().map((r) => ({ framework: r.framework, version: r.version, totalControls: r.totalControls })) };
  });
  app.get("/api/compliance/industry-profiles", async () => ({ profiles: getAllIndustryProfiles() }));

  // ── Evidence ──
  app.get("/api/evidence", async (req: any) => {
    const q = req.query as any;
    let result = [...evidence];
    if (q.framework) result = result.filter((e) => e.framework === q.framework);
    if (q.controlId) result = result.filter((e) => e.controlId === q.controlId);
    return { evidence: result };
  });
  app.post("/api/evidence", async (req: any) => {
    const newEv = {
      id: "ev" + Date.now(), tenantId: TENANT.id,
      name: (req.body as any)?.name ?? "Uploaded Evidence",
      type: (req.body as any)?.type ?? "document",
      framework: (req.body as any)?.framework ?? null,
      controlId: (req.body as any)?.controlId ?? null,
      sha256Hash: "f" + "0".repeat(63),
      storagePath: `/evidence/upload-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: USER.id,
    };
    evidence.push(newEv);
    return { evidence: newEv };
  });
  app.get("/api/evidence/:id/download", async (req: any) => {
    const ev = evidence.find((e) => e.id === req.params.id) ?? evidence[0];
    return { downloadUrl: `https://demo-storage.blackfyre.io${ev.storagePath}?token=demo-signed-token`, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() };
  });
  app.post("/api/evidence/:id/verify", async (req: any) => {
    const ev = evidence.find((e) => e.id === req.params.id) ?? evidence[0];
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): evidence-verify always returned verified:true —
    // a security vendor must never fake integrity results. The demo has no real object store, so we
    // recompute a SHA-256 over a stable representation of the evidence record and compare it to the
    // stored hash. `verified` now reflects an ACTUAL computation, and responses are unmistakably
    // labelled `demo: true` / simulated so the production-looking UI cannot misrepresent this.
    const canonical = JSON.stringify({
      id: ev.id,
      tenantId: ev.tenantId,
      storagePath: ev.storagePath ?? null,
      controlId: ev.controlId ?? null,
      framework: ev.framework ?? null,
    });
    const computedHash = createHash("sha256").update(canonical).digest("hex");
    const storedHash = ev.sha256Hash ?? "";
    const verified = storedHash.length > 0 && computedHash === storedHash;
    if (!verified) {
      req.log.warn(
        { evidenceId: ev.id, tenantId: ev.tenantId, controlId: ev.controlId ?? null },
        "demo evidence verify: computed hash did not match stored hash (simulated integrity check)",
      );
    } else {
      req.log.info(
        { evidenceId: ev.id, tenantId: ev.tenantId },
        "demo evidence verify: simulated integrity check passed",
      );
    }
    return {
      demo: true,
      simulated: true,
      verified,
      computedHash,
      storedHash,
      // `hash` retained for back-compat with existing UI consumers; mirrors the recomputed value.
      hash: computedHash,
    };
  });
  app.get("/api/evidence/export", async () => ({
    exportUrl: "https://demo-storage.blackfyre.io/evidence/export-bundle.zip?token=demo-export-token",
    generatedAt: new Date().toISOString(), count: evidence.length,
  }));

  // ── Remediations ──
  app.get("/api/remediations", async (req: any) => {
    const q = req.query as any;
    let result = [...remediations];
    if (q.status) result = result.filter((r) => r.status === q.status);
    if (q.tier) result = result.filter((r) => r.tier === q.tier);
    return { remediations: result, pagination: { limit: 25, offset: 0, total: result.length } };
  });
  app.get("/api/remediations/:id", async (req: any) => ({ remediation: remediations.find((r) => r.id === req.params.id) ?? remediations[0] }));
  app.post("/api/remediations/:id/approve", async (req: any) => {
    const rem = remediations.find((r) => r.id === req.params.id) ?? remediations[0];
    rem.status = "approved"; rem.approvedBy = USER.id;
    return { remediation: rem };
  });
  app.post("/api/remediations/:id/execute", async (req: any) => {
    const rem = remediations.find((r) => r.id === req.params.id) ?? remediations[0];
    rem.status = "executing"; rem.executedAt = new Date().toISOString();
    return { remediation: rem };
  });
  app.post("/api/remediations/:id/rollback", async (req: any) => {
    const rem = remediations.find((r) => r.id === req.params.id) ?? remediations[0];
    rem.status = "rolled_back";
    return { remediation: rem };
  });

  // ── Alerts ──
  app.get("/api/alerts", async () => ({ alertRules, pagination: { limit: 25, offset: 0, total: alertRules.length } }));

  // ── Drift ──
  app.get("/api/drift", async () => ({ driftEvents, pagination: { limit: 25, offset: 0, total: driftEvents.length } }));
  app.get("/api/drift/stats", async () => {
    const bySeverity: Record<string, number> = {};
    const byChangeType: Record<string, number> = {};
    for (const d of driftEvents) {
      bySeverity[d.severity] = (bySeverity[d.severity] ?? 0) + 1;
      byChangeType[d.changeType] = (byChangeType[d.changeType] ?? 0) + 1;
    }
    return { stats: { total: driftEvents.length, unacknowledged: driftEvents.filter((d) => !d.acknowledged).length, bySeverity, byChangeType } };
  });

  // ── Reports ──
  app.get("/api/reports", async () => ({ reports }));
  app.post("/api/reports/generate", async (req: any) => {
    const body = req.body as any;
    const newReport: any = {
      id: "rpt" + Date.now(), tenantId: TENANT.id,
      type: body?.type ?? "readiness", framework: body?.framework ?? null,
      status: "generating", storagePath: null, shareToken: null,
      generatedAt: new Date().toISOString(), expiresAt: null,
    };
    reports.push(newReport);
    setTimeout(() => { newReport.status = "ready"; newReport.storagePath = `/reports/report-${newReport.id}.pdf`; }, 3000);
    return { report: newReport };
  });
  app.post("/api/reports/:id/generate", async () => ({ status: "generating", message: "Report generation started" }));
  app.get("/api/reports/:id/download", async (req: any) => {
    const rpt = reports.find((r) => r.id === req.params.id) ?? reports[0];
    return { downloadUrl: `https://demo-storage.blackfyre.io${rpt.storagePath ?? "/reports/demo.pdf"}?token=demo-signed`, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() };
  });

  // ── Team ──
  app.get("/api/team", async () => ({ members: teamMembers }));
  app.post("/api/team/invite", async (req: any) => {
    const body = req.body as any;
    const newMember = {
      id: "tm" + Date.now(), tenantId: TENANT.id,
      name: body?.name ?? body?.email?.split("@")[0] ?? "New Member",
      email: body?.email ?? "invited@acme.com",
      role: body?.role ?? "viewer", status: "invited", lastLoginAt: null,
    };
    teamMembers.push(newMember);
    return { member: newMember };
  });
  app.patch("/api/team/:id/role", async (req: any) => {
    const member = teamMembers.find((m) => m.id === req.params.id) ?? teamMembers[0];
    member.role = (req.body as any)?.role ?? member.role;
    return { member };
  });
  app.delete("/api/team/:id", async (req: any) => {
    const idx = teamMembers.findIndex((m) => m.id === req.params.id);
    if (idx !== -1) teamMembers.splice(idx, 1);
    return { success: true };
  });

  // ── Integrations ──
  app.get("/api/integrations", async () => ({ integrations }));
  app.post("/api/integrations", async (req: any) => {
    const body = req.body as any;
    const newInt = {
      id: "int-" + (body?.type ?? "new") + "-" + Date.now(), tenantId: TENANT.id,
      type: body?.type ?? "custom", name: body?.name ?? body?.type ?? "New Integration",
      status: "disconnected", lastSyncAt: null, config: body?.config ?? {},
    };
    integrations.push(newInt);
    return { integration: newInt };
  });
  app.post("/api/integrations/:id/test", async (req: any) => {
    const int = integrations.find((i) => i.id === req.params.id);
    if (!int) return { success: false, message: "Integration not found" };
    const connected = int.status === "connected";
    return { success: connected, message: connected ? "Connection successful. Credentials valid." : "Connection failed. Check credentials and try again." };
  });
  app.delete("/api/integrations/:id", async (req: any) => {
    const idx = integrations.findIndex((i) => i.id === req.params.id);
    if (idx !== -1) integrations.splice(idx, 1);
    return { success: true };
  });

  // ── AI Analysis ──
  app.get("/api/ai/capabilities", async () => ({
    mode: "full",
    capabilities: [
      { id: "gap-analysis", name: "Gap Analysis", description: "AI-powered compliance gap identification", available: true },
      { id: "remediation", name: "Remediation Advisor", description: "Context-aware remediation recommendations", available: true },
      { id: "risk-assessment", name: "Risk Assessment", description: "Predictive risk scoring across your environment", available: true },
      { id: "policy-gen", name: "Policy Generator", description: "Generate compliance policy documents from templates", available: true },
      { id: "threat-correlation", name: "Threat Correlation", description: "Correlate CVEs to your infrastructure findings", available: true },
    ],
  }));
  app.post("/api/ai/gap-analysis", async (req: any) => {
    const body = req.body as any;
    return {
      analysisId: "ga-" + Date.now(), scanId: body?.scanId ?? scans[0]?.id ?? "s001", framework: body?.framework ?? "soc2",
      gaps: [
        { controlId: "CC6.1", controlName: "Logical Access Controls", gapDescription: "MFA not enforced for all privileged users", risk: "critical", effort: "medium", remediationHint: "Enable MFA enforcement in Okta for all admin roles" },
        { controlId: "CC7.2", controlName: "System Monitoring", gapDescription: "GuardDuty not active in all regions", risk: "high", effort: "low", remediationHint: "Enable GuardDuty in ap-southeast-1 and eu-west-1" },
        { controlId: "A1.1", controlName: "Availability Commitments", gapDescription: "No documented RTO/RPO targets verified", risk: "medium", effort: "high", remediationHint: "Document and test DR procedures in BCP" },
      ],
      summary: "3 critical gaps identified across 15 evaluated controls. Focus on IAM and monitoring controls for fastest score improvement.",
      completedAt: new Date().toISOString(),
    };
  });
  app.get("/api/ai/remediation/:findingId", async (req: any) => {
    const finding = findings.find((f) => f.id === req.params.findingId) ?? findings[0];
    return {
      findingId: finding.id,
      recommendation: {
        summary: `Remediation plan for: ${finding.title}`, priority: "high", estimatedEffort: "2-4 hours",
        steps: [
          { step: 1, action: "Assess current state and document baseline", automated: false },
          { step: 2, action: "Apply recommended configuration change", automated: finding.autoFixAvailable },
          { step: 3, action: "Verify remediation and collect evidence", automated: false },
          { step: 4, action: "Update finding status to resolved", automated: true },
        ],
        risks: ["Brief service interruption possible during change window", "Verify in staging environment first"],
        references: ["https://docs.aws.amazon.com/security/latest/ug/security-best-practices.html"],
      },
      generatedAt: new Date().toISOString(),
    };
  });
  app.post("/api/ai/remediation/:findingId", async (req: any) => {
    const finding = findings.find((f) => f.id === req.params.findingId) ?? findings[0];
    return {
      findingId: finding.id,
      recommendation: {
        summary: `AI remediation recommendation for: ${finding.title}`,
        priority: finding.severity === "critical" ? "immediate" : "planned",
        estimatedEffort: "2-4 hours",
        steps: [
          { step: 1, action: "Assess current configuration state", automated: false },
          { step: 2, action: finding.autoFixAvailable ? "Execute automated fix via BLACKFYRE playbook" : "Apply manual configuration change per playbook", automated: finding.autoFixAvailable },
          { step: 3, action: "Verify remediation with re-scan", automated: true },
        ],
        risks: ["Verify in non-production first if applicable"],
        references: [],
      },
      generatedAt: new Date().toISOString(),
    };
  });
  app.post("/api/ai/risk-assessment", async (req: any) => {
    const body = req.body as any;
    return {
      assessmentId: "ra-" + Date.now(), industry: body?.industry ?? TENANT.industryProfile,
      overallRiskScore: 62, riskLevel: "medium",
      breakdown: {
        critical: findings.filter((f) => f.severity === "critical" && f.status !== "resolved").length,
        high: findings.filter((f) => f.severity === "high" && f.status !== "resolved").length,
        medium: findings.filter((f) => f.severity === "medium" && f.status !== "resolved").length,
        low: findings.filter((f) => f.severity === "low" && f.status !== "resolved").length,
      },
      topRisks: [
        { area: "Identity & Access Management", score: 78, trend: "improving" },
        { area: "Cloud Configuration", score: 65, trend: "stable" },
        { area: "Endpoint Security", score: 54, trend: "degrading" },
      ],
      recommendations: [
        "Prioritize MFA enforcement across all cloud providers",
        "Enable GuardDuty in all active AWS regions",
        "Upgrade macOS devices to latest supported version",
      ],
      generatedAt: new Date().toISOString(),
    };
  });

  // ── Threat Intelligence ──
  app.get("/api/threat-intel/dashboard", async () => {
    const cves = threatIntelCVEs;
    const summary = bundle?.threatIntel?.summary;
    return {
      dashboard: {
        activeCVEs: summary?.activeCves ?? cves.filter((c) => !c.patched).length,
        patchedCVEs: summary?.patched ?? cves.filter((c) => c.patched).length,
        correlatedToFindings: cves.filter((c) => (c.affects ?? []).length > 0).length,
        severityBreakdown: {
          critical: cves.filter((c) => c.severity === "critical").length,
          high: cves.filter((c) => c.severity === "high").length,
          medium: cves.filter((c) => c.severity === "medium").length,
          low: cves.filter((c) => c.severity === "low").length,
        },
        recentCVEs: cves.slice(0, 5),
        trendData: [
          { week: "2026-W14", newCVEs: 3, patchedCVEs: 1 },
          { week: "2026-W15", newCVEs: 2, patchedCVEs: 2 },
          { week: "2026-W16", newCVEs: 4, patchedCVEs: 1 },
          { week: "2026-W17", newCVEs: 1, patchedCVEs: 3 },
          { week: "2026-W18", newCVEs: 5, patchedCVEs: 2 },
        ],
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  });
  app.get("/api/threat-intel/correlations", async () => {
    const correlated = threatIntelCVEs.filter((c) => (c.affects ?? []).length > 0);
    return {
      correlations: correlated.map((c) => {
        const fids: string[] = c.affects ?? [];
        return {
          cveId: c.id, cveTitle: c.title, cvss: c.cvssScore ?? c.cvss, severity: c.severity,
          correlatedFindingIds: fids,
          correlatedFindings: fids.map((fid: string) => findings.find((f) => f.id === fid)).filter(Boolean),
          correlatedAt: "2026-05-07T06:00:00Z",
        };
      }),
      count: correlated.length,
    };
  });

  // ── Policies ──
  app.get("/api/policies", async () => ({ policies }));
  app.get("/api/policies/templates", async () => ({ templates: policyTemplates }));
  app.post("/api/policies/generate", async (req: any) => {
    const body = req.body as any;
    const template = policyTemplates.find((t) => t.id === body?.templateId) ?? policyTemplates[0];
    const generated: any = {
      id: "pol" + Date.now(), tenantId: TENANT.id,
      title: `${TENANT.name} — ${template.title}`, category: template.category,
      status: "draft", framework: template.framework, version: "0.1",
      lastReviewedAt: null, nextReviewAt: null, ownerId: USER.id, controlIds: [],
      content: `# ${TENANT.name} — ${template.title}\n\n**Version:** 0.1 (AI-Generated Draft)\n**Owner:** ${USER.name}\n**Date:** ${new Date().toISOString().split("T")[0]}\n\n## 1. Purpose\n\nThis policy establishes requirements for ${template.description}.\n\n## 2. Scope\n\nThis policy applies to all systems, personnel, and processes within ${TENANT.name}.\n\n## 3. Policy\n\n[Content generated from template — review and customize before approval]\n\n## 4. Enforcement\n\nViolations of this policy may result in disciplinary action.\n\n## 5. Review\n\nThis policy shall be reviewed annually or upon significant changes.`,
    };
    policies.push(generated);
    return { policy: generated };
  });
  app.get("/api/policies/gaps", async (req: any) => {
    const q = req.query as any;
    const targetFrameworks = q.frameworks ? q.frameworks.split(",") : ["soc2", "hipaa", "iso27001"];
    return {
      gaps: [
        { framework: "soc2", controlId: "CC9.2", controlName: "Vendor Management", hasPolicyDocument: false, recommendation: "Create a Vendor Management Policy aligned to CC9.2" },
        { framework: "iso27001", controlId: "A.8.32", controlName: "Change Management", hasPolicyDocument: true, policyStatus: "draft", recommendation: "Complete and approve the Change Management Policy draft" },
        { framework: "hipaa", controlId: "164.308(a)(6)(i)", controlName: "Security Incident Procedures", hasPolicyDocument: false, recommendation: "Create a formal Incident Response Procedure document" },
      ].filter((g) => targetFrameworks.includes(g.framework)),
      analyzedFrameworks: targetFrameworks, totalGaps: 3, policyCoveragePercent: 72,
    };
  });

  // ── Settings ──
  app.get("/api/settings/user", async () => userSettings);
  app.patch("/api/settings/user", async (req: any) => {
    Object.assign(userSettings, req.body ?? {});
    if ((req.body as any)?.displayName) userSettings.user.name = (req.body as any).displayName;
    if ((req.body as any)?.email) userSettings.user.email = (req.body as any).email;
    return userSettings;
  });
  app.get("/api/settings/api-keys", async () => ({ apiKey: apiKeys[0]?.prefix + "••••••••", apiKeys }));
  app.post("/api/settings/api-keys/:id/regenerate", async (req: any) => {
    const key = apiKeys.find((k) => k.id === req.params.id) ?? apiKeys[0];
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): API-key regen used Math.random() (non-cryptographic
    // PRNG) for the key prefix — predictable and unsuitable for any key material. Switched to
    // crypto.randomBytes (CSPRNG). NOTE: this is the in-memory DEMO server only — it generates a key
    // PREFIX for display, not a real, persisted, hashed credential. Production key issuance lives in
    // the real API and must mint + hash the full secret server-side; never reproduce this shape there.
    const suffix = randomBytes(6).toString("hex"); // 12 hex chars from a CSPRNG (demo-only prefix)
    key.prefix = "bfk_live_" + suffix;
    key.lastUsedAt = null;
    // Do NOT log the generated prefix/secret — record only the non-sensitive key id for audit.
    req.log.info({ keyId: key.id }, "demo API key regenerated (CSPRNG, demo-only prefix)");
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): the returned `key` object spread the unmasked
    // `key.prefix`, leaking the full freshly-minted CSPRNG secret to the client. Mask the prefix in
    // the returned object so callers only ever see the same masked form as the `apiKey` field.
    return { apiKey: key.prefix + "••••••••", key: { ...key, prefix: key.prefix.substring(0, 9) + "••••••••" } };
  });

  // ── Trust Center ──
  app.get("/api/trust-center", async () => ({
    trustScore: 87,
    certifications: [
      { name: "SOC 2 Type II", status: "in_progress", validFrom: null, validUntil: null, auditor: "Deloitte" },
      { name: "ISO 27001", status: "planned", validFrom: null, validUntil: null, auditor: null },
      { name: "HIPAA", status: "self_attested", validFrom: "2026-01-01", validUntil: "2026-12-31", auditor: "Internal" },
    ],
    sovereignty: { dataResidency: "us-east-1 (AWS), eastus (Azure)", encryptionAtRest: true, encryptionInTransit: true, keyManagement: "Customer-managed KMS (AWS KMS + Azure Key Vault)", auditLogging: true },
    uptime: { last30Days: 99.97, last90Days: 99.94, incidents: [{ date: "2026-04-15", duration: "14 minutes", impact: "Degraded scan throughput", resolved: true }] },
    publiclyAccessible: false, lastUpdatedAt: "2026-05-01T00:00:00Z",
  }));
  app.get("/api/trust-center/sovereignty", async () => ({
    sovereignty: { dataResidency: "us-east-1 (AWS), eastus (Azure)", encryptionAtRest: true, encryptionInTransit: true, keyManagement: "Customer-managed KMS (AWS KMS + Azure Key Vault)", auditLogging: true },
  }));
  app.patch("/api/trust-center/sovereignty", async (req: any) => ({
    sovereignty: {
      dataResidency: (req.body as any)?.dataResidency ?? "us-east-1 (AWS)",
      encryptionAtRest: true, encryptionInTransit: true,
      keyManagement: (req.body as any)?.keyManagement ?? "Customer-managed KMS",
      auditLogging: true,
    },
  }));

  // ── Privacy ──
  app.get("/api/privacy/dashboard", async () => ({
    dashboard: {
      dataSubjectRequests: { pending: 3, completed: 47, overdue: 1 },
      consentRecords: 18423, dataProcessingActivities: 24, lastDpiaDate: "2026-03-15T00:00:00Z",
      retentionPolicies: [
        { category: "Customer PII", retentionDays: 730 },
        { category: "Financial Records", retentionDays: 2555 },
        { category: "Audit Logs", retentionDays: 365 },
        { category: "Marketing Data", retentionDays: 365 },
        { category: "Employee Records", retentionDays: 1825 },
      ],
      gdprCompliance: { art17Score: 82, art30Score: 91, breachNotificationReadiness: "ready" },
      recentDSRs: [
        { id: "dsr001", type: "access", status: "pending", submittedAt: "2026-05-05T10:00:00Z", dueAt: "2026-06-05T10:00:00Z" },
        { id: "dsr002", type: "erasure", status: "overdue", submittedAt: "2026-04-01T09:00:00Z", dueAt: "2026-05-01T09:00:00Z" },
        { id: "dsr003", type: "portability", status: "completed", submittedAt: "2026-04-20T11:00:00Z", dueAt: "2026-05-20T11:00:00Z" },
      ],
    },
  }));

  // ── AI Ethics ──
  app.get("/api/ai-ethics/dashboard", async () => ({
    dashboard: {
      modelInventory: [
        { id: "mdl001", name: "Claude Sonnet (Remediation Advisor)", purpose: "Security remediation recommendations", riskLevel: "low", lastReviewDate: "2026-04-01T00:00:00Z" },
        { id: "mdl002", name: "Internal Anomaly Detector", purpose: "Drift and anomaly detection in cloud config", riskLevel: "medium", lastReviewDate: "2026-03-15T00:00:00Z" },
        { id: "mdl003", name: "Risk Scoring Model", purpose: "Predictive risk scoring across compliance frameworks", riskLevel: "medium", lastReviewDate: "2026-02-01T00:00:00Z" },
      ],
      biasAssessments: [
        { modelId: "mdl001", score: 94, reviewedAt: "2026-04-01T00:00:00Z" },
        { modelId: "mdl002", score: 88, reviewedAt: "2026-03-15T00:00:00Z" },
        { modelId: "mdl003", score: 79, reviewedAt: "2026-02-01T00:00:00Z" },
      ],
      explainabilityScore: 86,
      complianceStatus: { euAiAct: "partial", nistAiRmf: "compliant" },
    },
  }));

  // ── Payments ──
  app.post("/api/payments/create-order", async (req: any) => {
    const body = req.body as any;
    return {
      orderId: "order_" + Date.now(),
      amount: body?.plan === "retainer" ? 249900 : body?.plan === "starter" ? 49900 : 99900,
      currency: "USD", key: "bfk_rzp_demo_key_123",
    };
  });
  app.post("/api/payments/verify", async (req: any) => ({
    success: true, plan: (req.body as any)?.plan ?? "retainer",
    message: "Payment verified. Your subscription has been activated.",
  }));
  app.get("/api/payments/subscription", async () => subscription);

  // ── Onboarding ──
  app.post("/api/onboarding", async (req: any) => {
    const body = req.body as any;
    TENANT.name = body?.companyName ?? TENANT.name;
    TENANT.industryProfile = body?.industry ?? TENANT.industryProfile;
    return { success: true, nextStep: "connect-integrations", tenant: TENANT };
  });

  // ── Learning / Insights ──
  app.get("/api/learning/stats", async () => {
    if (bundle?.learning) {
      const industries = Object.keys(bundle.learning.byIndustry ?? {});
      return {
        stats: {
          totalPatterns: (bundle.learning.patterns ?? []).length || 47,
          patternsByType: { common_finding: 18, remediation_rate: 12, false_positive: 8, predicted_gap: 9 },
          industriesCovered: industries.length > 0 ? industries : ["fintech", "healthtech", "saas", "ecommerce"],
          avgConfidence: 72,
        },
      };
    }
    return { stats: { totalPatterns: 47, patternsByType: { common_finding: 18, remediation_rate: 12, false_positive: 8, predicted_gap: 9 }, industriesCovered: ["fintech", "healthtech", "saas", "ecommerce"], avgConfidence: 72 } };
  });
  app.get("/api/learning/insights/:industry", async (req: any) => {
    const industry = req.params.industry;
    const bundleInsight = bundle?.learning?.byIndustry?.[industry];
    if (bundleInsight) return { insight: { industry, ...bundleInsight } };
    return {
      insight: {
        industry,
        commonFindings: [
          { category: "iam", occurrenceRate: 85, sampleSize: 23 },
          { category: "encryption", occurrenceRate: 72, sampleSize: 18 },
          { category: "logging", occurrenceRate: 68, sampleSize: 15 },
          { category: "network", occurrenceRate: 55, sampleSize: 12 },
          { category: "config", occurrenceRate: 45, sampleSize: 10 },
        ],
        avgRemediationDays: [{ category: "iam", avgDays: 3 }, { category: "encryption", avgDays: 7 }, { category: "logging", avgDays: 1 }],
        falsePositiveRates: [{ category: "config", rate: 12 }],
        predictedGaps: [{ framework: "soc2", controlCategory: "Access Control", likelihood: 82 }, { framework: "pcidss", controlCategory: "Encryption", likelihood: 71 }],
      },
    };
  });
  app.get("/api/learning/patterns", async () => ({
    patterns: bundle?.learning?.patterns ?? [],
    pagination: { limit: 25, offset: 0, total: (bundle?.learning?.patterns ?? []).length },
  }));

  return app;
}
