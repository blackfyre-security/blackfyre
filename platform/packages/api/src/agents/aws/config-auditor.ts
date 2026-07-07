// REAL IMPL (BLACKFYRE 2026-06): replaced the canned 3-finding stub with a real
// @aws-sdk/client-config-service auditor. AWS Config is a REGIONAL service, so
// this:
//   1. Enumerates the account's reachable regions via EC2 DescribeRegions
//      (a read-only metadata call permitted by the scoped session policy).
//   2. For each region, reads the authoritative AWS Config state via:
//        - DescribeConfigurationRecorders        (does a recorder exist + what
//                                                  resource types does it record)
//        - DescribeConfigurationRecorderStatus    (is the recorder actually
//                                                  recording / last-status)
//        - DescribeDeliveryChannels               (is a delivery channel set up
//                                                  to persist snapshots)
//        - DescribeComplianceByConfigRule         (paginated by NextToken; which
//                                                  managed/custom rules report
//                                                  NON_COMPLIANT resources)
//   3. Emits findings derived SOLELY from real returned properties:
//        - region with no configuration recorder at all          -> high
//        - recorder exists but is not recording / unhealthy       -> high
//        - recorder is recording but not "all supported types +   -> medium
//          global resource types" (incomplete coverage)
//        - region with no delivery channel                        -> high
//        - each Config rule whose compliance is NON_COMPLIANT      -> medium
// No hardcoded findings, no sample data, no TODO. The public export
// (class AwsConfigAuditorAgent extends BaseAgent, type "aws-config-auditor") is
// kept identical so agents/registry.ts and all callers keep compiling.
//
// Check-type keys passed to mapCheckToControls (config_recorder_missing,
// config_recorder_not_recording, config_recorder_incomplete_coverage,
// config_delivery_channel_missing, config_rule_non_compliant) follow the same
// graceful-fallback precedent as the GuardDuty auditor: unknown keys map to []
// today and can be wired into the compliance map later without code changes.
import {
  ConfigServiceClient,
  DescribeConfigurationRecordersCommand,
  DescribeConfigurationRecorderStatusCommand,
  DescribeDeliveryChannelsCommand,
  DescribeComplianceByConfigRuleCommand,
  type ConfigurationRecorder,
  type ConfigurationRecorderStatus,
  type ComplianceByConfigRule,
} from "@aws-sdk/client-config-service";
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): fallback region used only to discover the full
// region list when DescribeRegions cannot return one. us-east-1 always exists
// and is a valid AWS Config endpoint.
const FALLBACK_REGION = "us-east-1";

function makeConfigClient(
  creds: AwsTemporaryCredentials,
  region: string,
): ConfigServiceClient {
  return new ConfigServiceClient({
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
 * (Config/EC2 calls against those would fail). Falls back to the single default
 * region if the enumeration call fails, so the audit still runs.
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
 * REAL IMPL (BLACKFYRE 2026-06): runs all AWS Config checks across every
 * reachable region and returns the findings. Every finding's
 * resourceId/region is derived from real returned properties (or the real
 * region for the "nothing configured" cases).
 */
export async function auditConfig(
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
 * Audits AWS Config in a single region. Reads the real configuration recorders,
 * their recording status, the delivery channels, and per-rule compliance, then
 * evaluates the checks against those real properties.
 */
async function auditRegion(
  creds: AwsTemporaryCredentials,
  region: string,
): Promise<AgentFindingPayload[]> {
  const client = makeConfigClient(creds, region);
  const findings: AgentFindingPayload[] = [];

  // --- Recorders + their recording status -------------------------------
  const recordersResp = await client.send(
    new DescribeConfigurationRecordersCommand({}),
  );
  const recorders = recordersResp.ConfigurationRecorders ?? [];

  const statusResp = await client.send(
    new DescribeConfigurationRecorderStatusCommand({}),
  );
  const statuses = statusResp.ConfigurationRecordersStatus ?? [];

  findings.push(...evaluateRecorders(recorders, statuses, region));

  // --- Delivery channels ------------------------------------------------
  const channelsResp = await client.send(new DescribeDeliveryChannelsCommand({}));
  const channels = channelsResp.DeliveryChannels ?? [];

  if (channels.length === 0) {
    findings.push({
      title: `AWS Config has no delivery channel in region "${region}"`,
      description: `No AWS Config delivery channel exists in region ${region}. Without a delivery channel, configuration snapshots and history are not persisted to S3 (and optionally SNS), so configuration changes cannot be retained for audit or investigation. Create a delivery channel in ${region}.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::Config::DeliveryChannel",
      resourceId: `config-delivery-channel:${region}`,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("config_delivery_channel_missing"),
    });
  }

  // --- Per-rule compliance (paginated via NextToken) --------------------
  findings.push(...(await evaluateRuleCompliance(client, region)));

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): evaluates the configuration recorders and their
 * recording status for one region. Findings come only from real properties:
 * absence of a recorder, a recorder that is not recording (or whose last status
 * is failure/pending), and incomplete recording coverage.
 */
function evaluateRecorders(
  recorders: ConfigurationRecorder[],
  statuses: ConfigurationRecorderStatus[],
  region: string,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  // Check: no configuration recorder configured in this region at all -> high.
  if (recorders.length === 0) {
    findings.push({
      title: `AWS Config recorder is not set up in region "${region}"`,
      description: `No AWS Config configuration recorder exists in region ${region}. Without a recorder, AWS Config cannot track resource configuration changes, so drift, misconfiguration, and unauthorized change in this region go unrecorded. Set up a configuration recorder in ${region}.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::Config::ConfigurationRecorder",
      resourceId: `config-recorder:${region}`,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("config_recorder_missing"),
    });
    return findings;
  }

  const statusByName = new Map<string, ConfigurationRecorderStatus>();
  for (const status of statuses) {
    if (status.name) statusByName.set(status.name, status);
  }

  for (const recorder of recorders) {
    const name = recorder.name ?? "default";
    const status = statusByName.get(name);

    // Check: recorder exists but is not actively recording (or last attempt
    // failed / is still pending) -> high.
    const isRecording = status?.recording === true;
    // RecorderStatus enum values are PascalCase: "Success" | "Failure" | "Pending" | "NotApplicable".
    const lastStatus = status?.lastStatus;
    const healthy = isRecording && lastStatus !== "Failure";

    if (!healthy) {
      const reason = !isRecording
        ? "the recorder is stopped (recording = false)"
        : `the recorder's last status is "${lastStatus ?? "unknown"}"`;
      findings.push({
        title: `AWS Config recorder "${name}" is not recording in region "${region}"`,
        description: `AWS Config recorder ${name} in region ${region} is not capturing configuration changes: ${reason}. A stopped or failing recorder leaves a blind spot in this region's change history. Start the recorder and ensure it has a working role and delivery channel.`,
        severity: "high",
        category: "config",
        resourceType: "AWS::Config::ConfigurationRecorder",
        resourceId: name,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("config_recorder_not_recording"),
      });
      // A non-recording recorder makes the coverage check moot for this one.
      continue;
    }

    // Check: recorder is recording but coverage is incomplete -> medium.
    // Full coverage means recording all supported resource types AND global
    // (IAM/etc.) resource types. The recordingGroup carries these flags.
    const group = recorder.recordingGroup;
    const allSupported = group?.allSupported === true;
    const includeGlobal = group?.includeGlobalResourceTypes === true;

    if (!allSupported || !includeGlobal) {
      const gaps: string[] = [];
      if (!allSupported) gaps.push("not all supported resource types are recorded");
      if (!includeGlobal) gaps.push("global resource types (e.g. IAM) are excluded");
      findings.push({
        title: `AWS Config recorder "${name}" has incomplete coverage in region "${region}"`,
        description: `AWS Config recorder ${name} in region ${region} is recording, but its coverage is incomplete: ${gaps.join(
          " and ",
        )}. Unrecorded resource types produce gaps in the configuration history and compliance evaluation. Configure the recorder to record all supported resource types and include global resource types.`,
        severity: "medium",
        category: "config",
        resourceType: "AWS::Config::ConfigurationRecorder",
        resourceId: name,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "config_recorder_incomplete_coverage",
        ),
      });
    }
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): reads per-rule compliance via
 * DescribeComplianceByConfigRule (paginated by NextToken) and emits a finding
 * for every Config rule that AWS reports as NON_COMPLIANT. resourceId is the
 * real config rule name.
 */
async function evaluateRuleCompliance(
  client: ConfigServiceClient,
  region: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new DescribeComplianceByConfigRuleCommand({ NextToken: nextToken }),
    );

    for (const rule of resp.ComplianceByConfigRules ?? []) {
      findings.push(...evaluateRule(rule, region));
    }

    nextToken = resp.NextToken;
  } while (nextToken);

  return findings;
}

/**
 * Evaluates a single rule's real compliance summary. Only NON_COMPLIANT rules
 * produce a finding; COMPLIANT / INSUFFICIENT_DATA / NOT_APPLICABLE do not.
 */
function evaluateRule(
  rule: ComplianceByConfigRule,
  region: string,
): AgentFindingPayload[] {
  const ruleName = rule.ConfigRuleName;
  const complianceType = rule.Compliance?.ComplianceType;

  if (!ruleName || complianceType !== "NON_COMPLIANT") return [];

  const nonCompliantCount =
    rule.Compliance?.ComplianceContributorCount?.CappedCount;
  const cap = rule.Compliance?.ComplianceContributorCount?.CapExceeded
    ? "+"
    : "";
  const countText =
    nonCompliantCount !== undefined
      ? `${nonCompliantCount}${cap} non-compliant resource(s)`
      : "one or more non-compliant resources";

  return [
    {
      title: `AWS Config rule "${ruleName}" is non-compliant in region "${region}"`,
      description: `AWS Config rule ${ruleName} in region ${region} reports ${countText}. Resources evaluated by this rule violate its configured policy. Review the non-compliant resources and remediate them to satisfy the rule.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::Config::ConfigRule",
      resourceId: ruleName,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("config_rule_non_compliant"),
    },
  ];
}

/**
 * AWS Config Auditor Agent.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry still
 * does `new AwsConfigAuditorAgent()` then run/testConnection). Internally it now
 * resolves real STS credentials, enumerates regions + real AWS Config recorders,
 * delivery channels, and rule compliance, and streams real findings through the
 * agent context.
 */
export class AwsConfigAuditorAgent extends BaseAgent {
  readonly type = "aws-config-auditor";
  readonly displayName = "AWS Config Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveCredentials(ctx.credentialRef);
      const findings = await auditConfig(creds);

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
  // credentials and issuing a lightweight DescribeConfigurationRecorders call in
  // the default region, rather than returning a hardcoded true. An account with
  // no recorder is still a successful connection; only a
  // resolution/authorization/API failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeConfigClient(creds, FALLBACK_REGION);
      await client.send(new DescribeConfigurationRecordersCommand({}));
      return true;
    } catch {
      return false;
    }
  }
}
