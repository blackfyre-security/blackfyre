import type { BaseAgent } from "./base-agent.js";
import { CloudAuditorAwsAgent } from "./cloud-auditor-aws.js";
import { CloudAuditorAzureAgent } from "./cloud-auditor-azure.js";
import { CloudAuditorGcpAgent } from "./cloud-auditor-gcp.js";
import { IdentityAuditorAgent } from "./identity-auditor.js";
import { EndpointAuditorAgent } from "./endpoint-auditor.js";
import { NetworkScannerAgent } from "./network-scanner.js";
import { AdAuditorAgent } from "./ad-auditor.js";
import { SnmpAuditorAgent } from "./snmp-auditor.js";
import { ProwlerAgent } from "./prowler-agent.js";
import { IacScannerAgent } from "./iac-scanner-agent.js";

// --- New Agents ---
// AWS Expansion
import { AwsRdsAuditorAgent } from "./aws/rds-auditor.js";
import { AwsLambdaAuditorAgent } from "./aws/lambda-auditor.js";
import { AwsSqsSnsAuditorAgent } from "./aws/sqs-sns-auditor.js";
import { AwsSecretsManagerAuditorAgent } from "./aws/secrets-manager-auditor.js";
import { AwsGuardDutyAuditorAgent } from "./aws/guardduty-auditor.js";
import { AwsConfigAuditorAgent } from "./aws/config-auditor.js";
import { AwsWafAuditorAgent } from "./aws/waf-auditor.js";
import { AwsEcsEksAuditorAgent } from "./aws/ecs-eks-auditor.js";
// Azure Expansion
import { AzureSqlAuditorAgent } from "./azure/sql-auditor.js";
import { AzureAppServiceAuditorAgent } from "./azure/app-service-auditor.js";
import { AzureAksAuditorAgent } from "./azure/aks-auditor.js";
import { AzureDefenderAuditorAgent } from "./azure/defender-auditor.js";
import { AzureMonitorAuditorAgent } from "./azure/monitor-auditor.js";
import { AzurePolicyAuditorAgent } from "./azure/policy-auditor.js";
// GCP Expansion
import { GcpBigQueryAuditorAgent } from "./gcp/bigquery-auditor.js";
import { GcpGkeAuditorAgent } from "./gcp/gke-auditor.js";
import { GcpCloudSqlAuditorAgent } from "./gcp/cloud-sql-auditor.js";
import { GcpSccAuditorAgent } from "./gcp/security-command-center-auditor.js";
import { GcpOrgPolicyAuditorAgent } from "./gcp/org-policy-auditor.js";
// Platform Agents
import { KubernetesAuditorAgent } from "./kubernetes-auditor.js";
import { ContainerRegistryAuditorAgent } from "./container-registry-auditor.js";
import { CodeRepoAuditorAgent } from "./code-repo-auditor.js";
import { SaasAuditorAgent } from "./saas-auditor.js";

/**
 * Agent Registry
 *
 * Central registry of all scanning agents. Maps integration types
 * to the agents that can scan them. Agents are singletons — they
 * don't hold state between scans.
 *
 * The remaining 7 agents (evidence-collector, compliance-mapper,
 * report-generator, drift-monitor, remediation-agent, threat-intel-agent,
 * tenant-guardian) are implemented in their respective plans:
 * - Plan 3: compliance-mapper
 * - Plan 4: evidence-collector, remediation-agent
 * - Plan 5: drift-monitor (alert integration)
 * - Plan 6: report-generator
 */
const agents: Map<string, BaseAgent> = new Map();

function registerAgent(agent: BaseAgent): void {
  agents.set(agent.type, agent);
}

registerAgent(new CloudAuditorAwsAgent());
registerAgent(new CloudAuditorAzureAgent());
registerAgent(new CloudAuditorGcpAgent());
registerAgent(new IdentityAuditorAgent());
registerAgent(new EndpointAuditorAgent());
registerAgent(new NetworkScannerAgent());
registerAgent(new AdAuditorAgent());
registerAgent(new SnmpAuditorAgent());
registerAgent(new ProwlerAgent());
registerAgent(new IacScannerAgent());

// --- Register New Agents ---
// AWS
registerAgent(new AwsRdsAuditorAgent());
registerAgent(new AwsLambdaAuditorAgent());
registerAgent(new AwsSqsSnsAuditorAgent());
registerAgent(new AwsSecretsManagerAuditorAgent());
registerAgent(new AwsGuardDutyAuditorAgent());
registerAgent(new AwsConfigAuditorAgent());
registerAgent(new AwsWafAuditorAgent());
registerAgent(new AwsEcsEksAuditorAgent());
// Azure
registerAgent(new AzureSqlAuditorAgent());
registerAgent(new AzureAppServiceAuditorAgent());
registerAgent(new AzureAksAuditorAgent());
registerAgent(new AzureDefenderAuditorAgent());
registerAgent(new AzureMonitorAuditorAgent());
registerAgent(new AzurePolicyAuditorAgent());
// GCP
registerAgent(new GcpBigQueryAuditorAgent());
registerAgent(new GcpGkeAuditorAgent());
registerAgent(new GcpCloudSqlAuditorAgent());
registerAgent(new GcpSccAuditorAgent());
registerAgent(new GcpOrgPolicyAuditorAgent());
// Platform
registerAgent(new KubernetesAuditorAgent());
registerAgent(new ContainerRegistryAuditorAgent());
registerAgent(new CodeRepoAuditorAgent());
registerAgent(new SaasAuditorAgent());

/**
 * Get a specific agent by type.
 */
export function getAgent(type: string): BaseAgent | undefined {
  return agents.get(type);
}

/** Scan type → agent type mapping for filtering */
const SCAN_TYPE_AGENT_MAP: Record<string, string[]> = {
  quick: [
    "cloud-auditor-aws", "cloud-auditor-azure", "cloud-auditor-gcp",
    "identity-auditor", "endpoint-auditor", "network-scanner", "ad-auditor", "snmp-auditor",
    // new quick agents
    "aws-rds-auditor", "aws-lambda-auditor", "aws-sqs-sns-auditor", "aws-secrets-manager-auditor",
    "aws-guardduty-auditor", "aws-config-auditor", "aws-waf-auditor", "aws-ecs-eks-auditor",
    "azure-sql-auditor", "azure-app-service-auditor", "azure-aks-auditor", "azure-defender-auditor",
    "azure-monitor-auditor", "azure-policy-auditor",
    "gcp-bigquery-auditor", "gcp-gke-auditor", "gcp-cloud-sql-auditor", "gcp-scc-auditor", "gcp-org-policy-auditor",
    "kubernetes-auditor", "container-registry-auditor", "code-repo-auditor", "saas-auditor",
  ],
  deep: ["prowler-deep-scan"],
  iac: ["iac-scanner"],
};

/**
 * Get all agents that can scan a given integration type.
 * Optionally filter by scan types (quick, deep, iac).
 */
export function getAgentsForIntegration(integrationType: string, scanTypes?: string[]): BaseAgent[] {
  const allMatching = Array.from(agents.values()).filter((agent) =>
    agent.supportedIntegrations.includes(integrationType)
  );

  // If no scanTypes filter, return all matching agents (backward compat)
  if (!scanTypes || scanTypes.length === 0) return allMatching;

  // Build allowed agent types from scan types
  const allowedTypes = new Set<string>();
  for (const st of scanTypes) {
    const types = SCAN_TYPE_AGENT_MAP[st];
    if (types) types.forEach((t) => allowedTypes.add(t));
  }

  return allMatching.filter((agent) => allowedTypes.has(agent.type));
}

/**
 * Get all registered agents.
 */
export function getAllAgents(): BaseAgent[] {
  return Array.from(agents.values());
}

/**
 * Check if an integration type has at least one agent registered.
 */
export function hasAgentForIntegration(integrationType: string): boolean {
  return getAgentsForIntegration(integrationType).length > 0;
}
