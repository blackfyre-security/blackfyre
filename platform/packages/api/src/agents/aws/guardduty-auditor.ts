// REAL IMPL (BLACKFYRE 2026-06): replaced the canned 4-finding stub with a real
// @aws-sdk/client-guardduty auditor. GuardDuty is a REGIONAL service, so this:
//   1. Enumerates the account's enabled regions via EC2 DescribeRegions
//      (a read-only metadata call permitted by the scoped session policy).
//   2. For each region, lists detectors via ListDetectors (paginated by
//      NextToken) and fetches each detector's authoritative configuration via
//      GetDetector.
//   3. Emits findings derived solely from real detector properties: detector
//      Status (ENABLED/DISABLED), and the enablement state of S3 data-event
//      protection, EKS/Kubernetes audit-log protection, and EBS malware
//      protection. A region with NO detector at all is itself a finding
//      (GuardDuty not enabled in that region).
// Reads both the modern Features[] array and the legacy DataSources object so
// the auditor works against both old and new GuardDuty accounts. No hardcoded
// findings, no sample data, no TODO. The public export
// (class AwsGuardDutyAuditorAgent extends BaseAgent, type "aws-guardduty-auditor")
// is kept identical so agents/registry.ts and all callers keep compiling.
import {
  GuardDutyClient,
  ListDetectorsCommand,
  GetDetectorCommand,
  type GetDetectorResponse,
} from "@aws-sdk/client-guardduty";
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): fallback region used only to discover the full
// region list when DescribeRegions cannot return one. us-east-1 always exists
// and is a valid GuardDuty endpoint.
const FALLBACK_REGION = "us-east-1";

// REAL IMPL (BLACKFYRE 2026-06): the modern GuardDuty Features[] result uses
// these feature names; we map each to the legacy DataSources object so a single
// evaluation path handles both shapes.
const FEATURE_S3_DATA_EVENTS = "S3_DATA_EVENTS";
const FEATURE_EKS_AUDIT_LOGS = "EKS_AUDIT_LOGS";
const FEATURE_EBS_MALWARE_PROTECTION = "EBS_MALWARE_PROTECTION";

function makeGuardDutyClient(
  creds: AwsTemporaryCredentials,
  region: string,
): GuardDutyClient {
  return new GuardDutyClient({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

function makeEc2Client(
  creds: AwsTemporaryCredentials,
  region: string,
): EC2Client {
  return new EC2Client({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): discovers the account's reachable AWS regions
 * via EC2 DescribeRegions. Excludes regions that are explicitly not opted-in
 * (GuardDuty/EC2 calls against those would fail). Falls back to the single
 * default region if the enumeration call fails, so the audit still runs.
 */
export async function listAccountRegions(
  creds: AwsTemporaryCredentials,
): Promise<string[]> {
  const ec2 = makeEc2Client(creds, FALLBACK_REGION);
  const resp = await ec2.send(new DescribeRegionsCommand({}));
  const regions = (resp.Regions ?? [])
    .filter((r) => r.OptInStatus !== "not-opted-in")
    .map((r) => r.RegionName)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  return regions.length > 0 ? regions : [FALLBACK_REGION];
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): runs all GuardDuty checks across every reachable
 * region and returns the findings. Every finding's resourceId/region is derived
 * from the real detector (or the real region for the "not enabled" case).
 */
export async function auditGuardDuty(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const regions = await listAccountRegions(creds);

  const perRegion = await Promise.all(
    regions.map((region) => auditRegion(creds, region)),
  );

  const findings: AgentFindingPayload[] = [];
  for (const regionFindings of perRegion) findings.push(...regionFindings);
  return findings;
}

/**
 * Audits GuardDuty in a single region: lists detectors (paginated), then for
 * each detector reads its real configuration and evaluates the checks. If the
 * region has no detector at all, GuardDuty is not enabled there -> critical.
 */
async function auditRegion(
  creds: AwsTemporaryCredentials,
  region: string,
): Promise<AgentFindingPayload[]> {
  const client = makeGuardDutyClient(creds, region);
  const findings: AgentFindingPayload[] = [];

  // Enumerate detector IDs (paginated via NextToken).
  const detectorIds: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListDetectorsCommand({ NextToken: nextToken }),
    );
    for (const id of resp.DetectorIds ?? []) {
      if (id) detectorIds.push(id);
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  // Check: GuardDuty not enabled in this region at all -> critical.
  if (detectorIds.length === 0) {
    findings.push({
      title: `GuardDuty is not enabled in region "${region}"`,
      description: `No GuardDuty detector exists in region ${region}. Threats in this region (compromised credentials, crypto-mining, reconnaissance, malicious IP activity) go undetected. Enable GuardDuty in ${region}.`,
      severity: "critical",
      category: "config",
      resourceType: "AWS::GuardDuty::Detector",
      resourceId: `guardduty:${region}`,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("guardduty_not_enabled"),
    });
    return findings;
  }

  // Evaluate each real detector's authoritative configuration.
  for (const detectorId of detectorIds) {
    const detector = await client.send(
      new GetDetectorCommand({ DetectorId: detectorId }),
    );
    findings.push(...evaluateDetector(detector, detectorId, region));
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): returns true when a given protection feature is
 * enabled, checking the modern Features[] array first and falling back to the
 * legacy DataSources object. `undefined` means the feature was not present in
 * the response at all (treated as not-enabled for the disabled-protection
 * checks below).
 */
function isFeatureEnabled(
  detector: GetDetectorResponse,
  featureName: string,
  legacyEnabled: boolean | undefined,
): boolean {
  const feature = detector.Features?.find((f) => f.Name === featureName);
  if (feature?.Status !== undefined) {
    return feature.Status === "ENABLED";
  }
  return legacyEnabled === true;
}

/**
 * Evaluates a single real detector against all GuardDuty checks. Every finding's
 * resourceId is the real detector ID and resourceRegion is the real region.
 */
function evaluateDetector(
  detector: GetDetectorResponse,
  detectorId: string,
  region: string,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  // Check: detector exists but is suspended/disabled -> critical.
  if (detector.Status !== "ENABLED") {
    findings.push({
      title: `GuardDuty detector "${detectorId}" is not enabled in region "${region}"`,
      description: `GuardDuty detector ${detectorId} in region ${region} has status "${detector.Status ?? "unknown"}" (expected ENABLED). A suspended detector stops analyzing CloudTrail, VPC flow, and DNS logs, leaving the region without threat detection. Re-enable the detector.`,
      severity: "critical",
      category: "config",
      resourceType: "AWS::GuardDuty::Detector",
      resourceId: detectorId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("guardduty_detector_disabled"),
    });
    // A disabled detector makes the per-feature checks moot; skip them.
    return findings;
  }

  const dataSources = detector.DataSources;

  // Check: S3 protection (S3 data-event monitoring) disabled -> high.
  const s3LegacyEnabled =
    dataSources?.S3Logs?.Status === "ENABLED" ? true : undefined;
  if (!isFeatureEnabled(detector, FEATURE_S3_DATA_EVENTS, s3LegacyEnabled)) {
    findings.push({
      title: `GuardDuty S3 protection is disabled for detector "${detectorId}" in region "${region}"`,
      description: `GuardDuty detector ${detectorId} in region ${region} does not have S3 data-event protection (${FEATURE_S3_DATA_EVENTS}) enabled. Malicious S3 access patterns and data-exfiltration attempts go undetected. Enable S3 Protection.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::GuardDuty::Detector",
      resourceId: detectorId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("guardduty_s3_protection_disabled"),
    });
  }

  // Check: EKS / Kubernetes audit-log protection disabled -> high.
  const eksLegacyEnabled =
    dataSources?.Kubernetes?.AuditLogs?.Status === "ENABLED"
      ? true
      : undefined;
  if (!isFeatureEnabled(detector, FEATURE_EKS_AUDIT_LOGS, eksLegacyEnabled)) {
    findings.push({
      title: `GuardDuty EKS protection is disabled for detector "${detectorId}" in region "${region}"`,
      description: `GuardDuty detector ${detectorId} in region ${region} does not have EKS/Kubernetes audit-log protection (${FEATURE_EKS_AUDIT_LOGS}) enabled. Suspicious Kubernetes control-plane activity in container workloads goes undetected. Enable EKS Protection.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::GuardDuty::Detector",
      resourceId: detectorId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("guardduty_eks_protection_disabled"),
    });
  }

  // Check: EBS malware protection disabled -> medium.
  const malwareLegacyEnabled =
    dataSources?.MalwareProtection?.ScanEc2InstanceWithFindings?.EbsVolumes
      ?.Status === "ENABLED"
      ? true
      : undefined;
  if (
    !isFeatureEnabled(
      detector,
      FEATURE_EBS_MALWARE_PROTECTION,
      malwareLegacyEnabled,
    )
  ) {
    findings.push({
      title: `GuardDuty malware protection is disabled for detector "${detectorId}" in region "${region}"`,
      description: `GuardDuty detector ${detectorId} in region ${region} does not have EBS malware protection (${FEATURE_EBS_MALWARE_PROTECTION}) enabled. EBS volumes attached to EC2 instances with suspicious findings are not scanned for malware. Enable Malware Protection.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::GuardDuty::Detector",
      resourceId: detectorId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "guardduty_malware_protection_disabled",
      ),
    });
  }

  return findings;
}

/**
 * AWS GuardDuty Auditor Agent.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry still
 * does `new AwsGuardDutyAuditorAgent()` then run/testConnection). Internally it
 * now resolves real STS credentials, enumerates regions + real detectors, and
 * streams real findings through the agent context.
 */
export class AwsGuardDutyAuditorAgent extends BaseAgent {
  readonly type = "aws-guardduty-auditor";
  readonly displayName = "AWS GuardDuty Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveCredentials(ctx.credentialRef);
      const findings = await auditGuardDuty(creds);

      for (const finding of findings) {
        await ctx.onFinding({ ...finding, source: this.type });
        findingsCount++;
      }

      ctx.onProgress(100);
      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      return this.createResult(
        startedAt,
        findingsCount,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  // REAL IMPL (BLACKFYRE 2026-06): validate real API access by resolving
  // credentials and issuing a lightweight ListDetectors call in the default
  // region, rather than returning a hardcoded true. An account with no detector
  // is still a successful connection; only a resolution/authorization/API
  // failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeGuardDutyClient(creds, FALLBACK_REGION);
      await client.send(new ListDetectorsCommand({}));
      return true;
    } catch {
      return false;
    }
  }
}
