import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DescribeVolumesCommand,
  type SecurityGroup,
  type IpPermission,
} from "@aws-sdk/client-ec2";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

function makeClient(creds: AwsTemporaryCredentials): EC2Client {
  return new EC2Client({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Runs all EC2/VPC security checks and returns findings.
 */
export async function auditEC2VPC(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);

  const [sgFindings, ebsFindings] = await Promise.all([
    checkSecurityGroups(client),
    checkUnencryptedVolumes(client),
  ]);

  return [...sgFindings, ...ebsFindings];
}

/**
 * Check: Security groups with dangerous inbound rules (0.0.0.0/0 on 22/3389) -> critical
 * Check: Unrestricted outbound (0.0.0.0/0 on all ports) -> medium
 */
async function checkSecurityGroups(
  client: EC2Client,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let nextToken: string | undefined;

  do {
    const resp = await client.send(
      new DescribeSecurityGroupsCommand({ NextToken: nextToken }),
    );

    for (const sg of resp.SecurityGroups ?? []) {
      findings.push(...checkInboundRules(sg));
      findings.push(...checkOutboundRules(sg));
    }

    nextToken = resp.NextToken;
  } while (nextToken);

  return findings;
}

function sgId(sg: SecurityGroup): string {
  return sg.GroupId ?? sg.GroupName ?? "unknown";
}

function hasCidrAnywhere(rule: IpPermission): boolean {
  return (
    (rule.IpRanges?.some((r) => r.CidrIp === "0.0.0.0/0") ?? false) ||
    (rule.Ipv6Ranges?.some((r) => r.CidrIpv6 === "::/0") ?? false)
  );
}

function portInRange(
  targetPort: number,
  fromPort: number | undefined,
  toPort: number | undefined,
): boolean {
  if (fromPort === undefined || toPort === undefined) return false;
  return targetPort >= fromPort && targetPort <= toPort;
}

/**
 * Checks inbound rules for 0.0.0.0/0 on SSH (22) or RDP (3389).
 */
function checkInboundRules(sg: SecurityGroup): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const rule of sg.IpPermissions ?? []) {
    if (!hasCidrAnywhere(rule)) continue;

    const sshOpen = portInRange(22, rule.FromPort, rule.ToPort);
    const rdpOpen = portInRange(3389, rule.FromPort, rule.ToPort);
    // Also catch "all traffic" rules (FromPort === -1 means all)
    const allPorts = rule.FromPort === -1 && rule.ToPort === -1;
    // IpProtocol === "-1" means all protocols
    const allProtocols = rule.IpProtocol === "-1";

    if (sshOpen || allPorts || allProtocols) {
      findings.push({
        title: `Security group "${sg.GroupName}" allows SSH (port 22) from 0.0.0.0/0`,
        description: `Security group ${sgId(sg)} in VPC ${sg.VpcId ?? "classic"} allows inbound SSH access from the entire internet. Restrict SSH access to known IP ranges or use a bastion host.`,
        severity: "critical",
        category: "network",
        resourceType: "AWS::EC2::SecurityGroup",
        resourceId: sgId(sg),
        remediationTier: "approval",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("ec2_sg_open_ssh"),
      });
    }

    if (rdpOpen || allPorts || allProtocols) {
      findings.push({
        title: `Security group "${sg.GroupName}" allows RDP (port 3389) from 0.0.0.0/0`,
        description: `Security group ${sgId(sg)} in VPC ${sg.VpcId ?? "classic"} allows inbound RDP access from the entire internet. Restrict RDP access to known IP ranges or use a bastion host.`,
        severity: "critical",
        category: "network",
        resourceType: "AWS::EC2::SecurityGroup",
        resourceId: sgId(sg),
        remediationTier: "approval",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("ec2_sg_open_ssh"),
      });
    }
  }

  return findings;
}

/**
 * Checks outbound rules for unrestricted access (0.0.0.0/0 on all ports).
 */
function checkOutboundRules(sg: SecurityGroup): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const rule of sg.IpPermissionsEgress ?? []) {
    if (!hasCidrAnywhere(rule)) continue;

    const allProtocols = rule.IpProtocol === "-1";

    if (allProtocols) {
      findings.push({
        title: `Security group "${sg.GroupName}" has unrestricted outbound traffic`,
        description: `Security group ${sgId(sg)} in VPC ${sg.VpcId ?? "classic"} allows all outbound traffic to 0.0.0.0/0. Consider restricting egress rules to limit data exfiltration risk.`,
        severity: "medium",
        category: "network",
        resourceType: "AWS::EC2::SecurityGroup",
        resourceId: sgId(sg),
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("ec2_sg_unrestricted_egress"),
      });
    }
  }

  return findings;
}

/**
 * Check: Unencrypted EBS volumes -> high
 */
async function checkUnencryptedVolumes(
  client: EC2Client,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let nextToken: string | undefined;

  do {
    const resp = await client.send(
      new DescribeVolumesCommand({ NextToken: nextToken }),
    );

    for (const volume of resp.Volumes ?? []) {
      if (!volume.Encrypted) {
        findings.push({
          title: `EBS volume "${volume.VolumeId}" is not encrypted`,
          description: `EBS volume ${volume.VolumeId} (${volume.Size ?? "?"}GB, ${volume.VolumeType ?? "?"}) in ${volume.AvailabilityZone ?? "unknown AZ"} is not encrypted. Enable encryption to protect data at rest.`,
          severity: "high",
          category: "encryption",
          resourceType: "AWS::EC2::Volume",
          resourceId: volume.VolumeId ?? "unknown",
          resourceRegion: volume.AvailabilityZone ?? null,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("ec2_unencrypted_ebs"),
        });
      }
    }

    nextToken = resp.NextToken;
  } while (nextToken);

  return findings;
}
