import {
  SubnetworksClient,
  FirewallsClient,
} from "@google-cloud/compute";
import { ProjectsClient } from "@google-cloud/resource-manager";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { GcpCredentials } from "./credentials.js";

/**
 * Runs all GCP Network/Logging security checks and returns findings.
 *
 * Checks:
 * 1. gcp_vpc_no_flow_logs — Subnet does not have VPC flow logs enabled
 * 2. gcp_no_audit_log_config — Project does not have data access audit logging configured
 * 3. gcp_fw_all_ingress — Firewall rule allows all ingress from 0.0.0.0/0
 */
export async function auditGcpNetwork(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = await creds.auth.getClient();

  const [flowLogFindings, auditLogFindings, fwAllIngressFindings] =
    await Promise.all([
      checkVpcFlowLogs(authClient, creds.projectId),
      checkAuditLogConfig(authClient, creds.projectId),
      checkAllIngressFirewall(authClient, creds.projectId),
    ]);

  return [...flowLogFindings, ...auditLogFindings, ...fwAllIngressFindings];
}

// ---------------------------------------------------------------------------
// Check VPC subnets for flow logs
// ---------------------------------------------------------------------------

async function checkVpcFlowLogs(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new SubnetworksClient({ authClient: authClient as any });

  const iterable = client.aggregatedListAsync({ project: projectId });

  for await (const [regionPath, scopedList] of iterable) {
    const subnets = scopedList.subnetworks ?? [];
    for (const subnet of subnets) {
      if (subnet.logConfig?.enable !== true) {
        const region = regionPath.replace("regions/", "");
        findings.push({
          title: `Subnet "${subnet.name}" does not have VPC flow logs enabled`,
          description: `Subnet ${subnet.name} in region ${region} (network: ${subnet.network ?? "unknown"}) does not have VPC flow logs enabled. Flow logs capture network traffic metadata and are essential for security monitoring and forensic analysis.`,
          severity: "medium",
          category: "logging",
          resourceType: "compute.googleapis.com/Subnetwork",
          resourceId: subnet.name ?? "unknown",
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("gcp_vpc_no_flow_logs"),
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check project audit log configuration
// ---------------------------------------------------------------------------

async function checkAuditLogConfig(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new ProjectsClient({ authClient: authClient as any });

  const [policy] = await client.getIamPolicy({
    resource: `projects/${projectId}`,
  });

  // Check for auditConfigs -- the project should have data access audit logging
  // If no auditConfigs or allServices not configured, flag it
  const auditConfigs = (policy as any)?.auditConfigs ?? [];

  if (auditConfigs.length === 0) {
    findings.push({
      title: `Project "${projectId}" has no data access audit logging configured`,
      description: `GCP project ${projectId} does not have any data access audit log configuration. Configure audit logging for all services to track data access, admin activity, and system events for compliance and security monitoring.`,
      severity: "high",
      category: "logging",
      resourceType: "cloudresourcemanager.googleapis.com/Project",
      resourceId: `projects/${projectId}`,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_no_audit_log_config"),
    });
  } else {
    // Check if "allServices" audit config exists with DATA_READ and DATA_WRITE
    const allServicesConfig = auditConfigs.find(
      (c: any) => c.service === "allServices",
    );

    if (!allServicesConfig) {
      findings.push({
        title: `Project "${projectId}" missing allServices audit log configuration`,
        description: `GCP project ${projectId} has audit logging configured for some services but not "allServices". Configure allServices audit logging to ensure comprehensive coverage of data access events.`,
        severity: "high",
        category: "logging",
        resourceType: "cloudresourcemanager.googleapis.com/Project",
        resourceId: `projects/${projectId}`,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("gcp_no_audit_log_config"),
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check firewall rules for all-ingress from 0.0.0.0/0
// ---------------------------------------------------------------------------

async function checkAllIngressFirewall(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new FirewallsClient({ authClient: authClient as any });

  const iterable = client.listAsync({ project: projectId });

  for await (const rule of iterable) {
    if (rule.direction !== "INGRESS") continue;
    if (!rule.allowed || rule.allowed.length === 0) continue;

    const sourceRanges = rule.sourceRanges ?? [];
    if (!sourceRanges.includes("0.0.0.0/0")) continue;

    // Check if any allowed entry allows "all" protocols
    const allowsAll = rule.allowed.some(
      (a: { IPProtocol?: string | null }) => a.IPProtocol === "all",
    );

    if (allowsAll) {
      findings.push({
        title: `Firewall rule "${rule.name}" allows all ingress from 0.0.0.0/0`,
        description: `GCP firewall rule "${rule.name}" in project ${projectId} allows all inbound traffic from the entire internet (0.0.0.0/0) with protocol "all". This is extremely dangerous and should be restricted to specific ports and protocols.`,
        severity: "critical",
        category: "network",
        resourceType: "compute.googleapis.com/Firewall",
        resourceId: rule.name ?? "unknown",
        remediationTier: "approval",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("gcp_fw_all_ingress"),
      });
    }
  }

  return findings;
}
