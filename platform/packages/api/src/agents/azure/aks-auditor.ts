// REAL IMPL (BLACKFYRE 2026-06): Azure AKS auditor now enumerates real managed
// clusters via @azure/arm-containerservice (ContainerServiceClient.managedClusters.list)
// and emits findings derived from real cluster properties (enableRbac,
// networkProfile.networkPolicy, aadProfile). No canned/sample findings, no TODOs.
// The public export (class AzureAksAuditorAgent extends BaseAgent) is preserved so
// registry.ts wiring keeps compiling. Pattern mirrors CloudAuditorAzureAgent /
// keyvault-auditor / compute-auditor: resolveAzureCredentials(), AzureCredentials
// client construction, AgentFindingPayload shape, mapCheckToControls usage,
// PagedAsyncIterableIterator pagination over the list API, and a real
// SDK-backed testConnection (no string check).
import { ContainerServiceClient } from "@azure/arm-containerservice";
import type { ManagedCluster } from "@azure/arm-containerservice";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveAzureCredentials, type AzureCredentials } from "./credentials.js";

const SOURCE = "azure-aks-auditor";
const RESOURCE_TYPE = "Microsoft.ContainerService/managedClusters";

/**
 * Checks whether the cluster's network policy enforces pod-to-pod traffic
 * restrictions. Azure represents this as a free-form string (NetworkPolicy);
 * the empty/"none" value (or an unset profile) means no policy is enforced.
 */
function hasNetworkPolicy(cluster: ManagedCluster): boolean {
  const policy = cluster.networkProfile?.networkPolicy;
  if (!policy) return false;
  const normalized = policy.trim().toLowerCase();
  return normalized !== "" && normalized !== "none";
}

/**
 * Check 1: azure_aks_rbac_not_enabled
 * Kubernetes RBAC is the primary in-cluster authorization mechanism. When
 * enableRbac is not true, the API server falls back to a permissive
 * authorization mode and per-identity access control is lost.
 */
function checkRbac(cluster: ManagedCluster): AgentFindingPayload[] {
  if (cluster.enableRbac === true) return [];

  const name = cluster.name ?? "unknown";
  const resourceId = cluster.id ?? name;
  return [
    {
      title: `AKS cluster "${name}" does not have Kubernetes RBAC enabled`,
      description: `Managed cluster ${name} (${resourceId}) has enableRbac=${String(cluster.enableRbac)} — Kubernetes Role-Based Access Control is not enabled. Without RBAC, the API server cannot enforce per-identity authorization for in-cluster actions, so any authenticated principal effectively has broad access. RBAC cannot be toggled on an existing cluster, so recreate the cluster with enableRbac=true.`,
      severity: "critical",
      category: "iam",
      resourceType: RESOURCE_TYPE,
      resourceId,
      resourceRegion: cluster.location ?? null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_aks_rbac_not_enabled"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 2: azure_aks_no_network_policy
 * Without a network policy, all pods can communicate with every other pod by
 * default, so a single compromised workload has unrestricted lateral network
 * reach across the cluster.
 */
function checkNetworkPolicy(cluster: ManagedCluster): AgentFindingPayload[] {
  if (hasNetworkPolicy(cluster)) return [];

  const name = cluster.name ?? "unknown";
  const resourceId = cluster.id ?? name;
  const observed = cluster.networkProfile?.networkPolicy ?? "none";
  return [
    {
      title: `AKS cluster "${name}" has no network policy configured`,
      description: `Managed cluster ${name} (${resourceId}) has networkProfile.networkPolicy="${observed}" — no Kubernetes network policy engine is enforcing pod-to-pod traffic rules. By default all pods can reach all other pods, giving a compromised workload unrestricted lateral movement. Configure a network policy (for example "azure" or "calico") to enforce least-privilege network segmentation.`,
      severity: "high",
      category: "network",
      resourceType: RESOURCE_TYPE,
      resourceId,
      resourceRegion: cluster.location ?? null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_aks_no_network_policy"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 3: azure_aks_aad_not_integrated
 * Without an Azure AD (Entra ID) integration the cluster relies on static
 * local Kubernetes credentials, which cannot be centrally governed, rotated,
 * conditionally restricted, or tied to a single audited identity source.
 */
function checkAadProfile(cluster: ManagedCluster): AgentFindingPayload[] {
  if (cluster.aadProfile != null) return [];

  const name = cluster.name ?? "unknown";
  const resourceId = cluster.id ?? name;
  return [
    {
      title: `AKS cluster "${name}" is not integrated with Azure AD`,
      description: `Managed cluster ${name} (${resourceId}) has no aadProfile configured, so it is not integrated with Azure Active Directory (Entra ID) for authentication. The cluster relies on static local Kubernetes credentials that cannot be centrally governed, conditionally restricted, or audited against a single identity source. Enable AKS-managed Azure AD integration (managed aadProfile) and prefer Azure RBAC for Kubernetes authorization.`,
      severity: "high",
      category: "identity",
      resourceType: RESOURCE_TYPE,
      resourceId,
      resourceRegion: cluster.location ?? null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_aks_aad_not_integrated"),
      source: SOURCE,
    },
  ];
}

/**
 * Runs all Azure AKS security checks and returns findings.
 *
 * Enumerates every managed cluster in the subscription via
 * ContainerServiceClient.managedClusters.list (paginated async iterator) and
 * derives findings from real cluster properties.
 *
 * Checks:
 * 1. azure_aks_rbac_not_enabled    — cluster.enableRbac !== true
 * 2. azure_aks_no_network_policy   — networkProfile.networkPolicy unset/none
 * 3. azure_aks_aad_not_integrated  — aadProfile absent
 */
export async function auditAzureAks(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new ContainerServiceClient(
    creds.credential,
    creds.subscriptionId,
  );
  const findings: AgentFindingPayload[] = [];

  for await (const cluster of client.managedClusters.list()) {
    findings.push(...checkRbac(cluster));
    findings.push(...checkNetworkPolicy(cluster));
    findings.push(...checkAadProfile(cluster));
  }

  return findings;
}

/**
 * Azure AKS Auditor Agent
 *
 * Scans: Azure Kubernetes Service managed clusters for Kubernetes RBAC,
 * network policy enforcement, and Azure AD integration.
 *
 * Uses real @azure/arm-containerservice SDK calls. Credentials are resolved via
 * resolveAzureCredentials (Service Principal in credentialRef).
 */
export class AzureAksAuditorAgent extends BaseAgent {
  readonly type = "azure-aks-auditor";
  readonly displayName = "Azure AKS Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveAzureCredentials(ctx.credentialRef);
      const findings = await auditAzureAks(creds);

      for (const finding of findings) {
        await ctx.onFinding(finding);
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

  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = new ContainerServiceClient(
        creds.credential,
        creds.subscriptionId,
      );

      // Attempt to read one managed cluster page to verify real API access.
      // An empty subscription still returns a valid (empty) page without error.
      for await (const _cluster of client.managedClusters.list()) {
        break;
      }

      return true;
    } catch {
      return false;
    }
  }
}
