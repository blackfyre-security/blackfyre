import {
  CloudTrailClient,
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from "@aws-sdk/client-cloudtrail";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

function makeClient(creds: AwsTemporaryCredentials): CloudTrailClient {
  return new CloudTrailClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Runs all CloudTrail security checks and returns findings.
 */
export async function auditCloudTrail(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  const resp = await client.send(new DescribeTrailsCommand({}));
  const trails = resp.trailList ?? [];

  // Check: No trails at all -> critical
  if (trails.length === 0) {
    findings.push({
      title: "No CloudTrail trails configured",
      description:
        "No CloudTrail trails are configured in this account. CloudTrail provides audit logging of all AWS API calls and is critical for security monitoring and compliance.",
      severity: "critical",
      category: "logging",
      resourceType: "AWS::CloudTrail::Trail",
      resourceId: "none",
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("cloudtrail_no_trails"),
    });
    return findings;
  }

  // Check each trail
  for (const trail of trails) {
    const trailName = trail.Name ?? trail.TrailARN ?? "unknown";
    const trailId = trail.TrailARN ?? trailName;

    // Check: Trail not multi-region -> high
    if (!trail.IsMultiRegionTrail) {
      findings.push({
        title: `CloudTrail trail "${trailName}" is not multi-region`,
        description: `CloudTrail trail ${trailName} is configured for a single region only. Enable multi-region to capture API calls across all AWS regions.`,
        severity: "high",
        category: "logging",
        resourceType: "AWS::CloudTrail::Trail",
        resourceId: trailId,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("cloudtrail_not_multiregion"),
      });
    }

    // Check: Log file validation disabled -> high
    if (!trail.LogFileValidationEnabled) {
      findings.push({
        title: `CloudTrail trail "${trailName}" has log file validation disabled`,
        description: `CloudTrail trail ${trailName} does not have log file validation enabled. Without validation, tampered log files cannot be detected. Enable log file integrity validation.`,
        severity: "high",
        category: "logging",
        resourceType: "AWS::CloudTrail::Trail",
        resourceId: trailId,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("cloudtrail_no_log_validation"),
      });
    }

    // Additional: Check if trail is actually logging
    try {
      const statusResp = await client.send(
        new GetTrailStatusCommand({ Name: trail.TrailARN ?? trail.Name }),
      );

      if (!statusResp.IsLogging) {
        findings.push({
          title: `CloudTrail trail "${trailName}" is not actively logging`,
          description: `CloudTrail trail ${trailName} exists but is not actively logging. Start the trail to resume audit log collection.`,
          severity: "critical",
          category: "logging",
          resourceType: "AWS::CloudTrail::Trail",
          resourceId: trailId,
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("cloudtrail_not_logging"),
        });
      }
    } catch {
      // If we cannot get trail status, skip this sub-check
    }
  }

  return findings;
}
