// REAL IMPL (BLACKFYRE 2026-06): GCP GKE auditor no longer emits canned/sample
// findings. It enumerates ACTUAL GKE clusters via the real Google Cloud SDK
// (@google-cloud/container ClusterManagerClient.listClusters) using the tenant's
// resolved service-account credentials, and derives every finding from real
// cluster properties (legacyAbac.enabled, masterAuthorizedNetworksConfig.enabled,
// networkPolicy.enabled, privateClusterConfig.enablePrivateNodes,
// shieldedNodes.enabled). resourceId/region come from the live cluster
// (selfLink / location). The public export (class GcpGkeAuditorAgent extends
// BaseAgent) is preserved so registry.ts wiring keeps compiling. Pattern mirrors
// the real AKS auditor (azure/aks-auditor.ts) and compute-auditor.ts: shared
// credential resolution, the same authClient/projectId client construction the
// other GCP auditors use, AgentFindingPayload shape, mapCheckToControls usage,
// iteration over the list API, and a real SDK-backed testConnection (no string
// check).
import { ClusterManagerClient } from "@google-cloud/container";
import type { protos } from "@google-cloud/container";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveGcpCredentials, type GcpCredentials } from "./credentials.js";

const SOURCE = "gcp-gke-auditor";
const RESOURCE_TYPE = "container.googleapis.com/Cluster";

type ICluster = protos.google.container.v1.ICluster;

/**
 * Builds the ClusterManagerClient bound to the tenant's service-account auth and
 * project. Mirrors how the other GCP auditors construct their SDK clients
 * (compute-auditor.ts `new FirewallsClient({ authClient })`) — the google-gax
 * ClientOptions accepts an explicit authClient + projectId.
 */
async function makeClient(
  creds: GcpCredentials,
): Promise<ClusterManagerClient> {
  const authClient = await creds.auth.getClient();
  return new ClusterManagerClient({
    authClient: authClient as never,
    projectId: creds.projectId,
  });
}

/**
 * A stable identifier for the cluster, preferring the API selfLink (which is a
 * fully-qualified resource URL). Falls back to projects/<p>/locations/<loc>/
 * clusters/<name> and finally the bare name.
 */
function clusterId(cluster: ICluster, projectId: string): string {
  if (cluster.selfLink) return cluster.selfLink;
  const location = cluster.location ?? cluster.zone;
  if (cluster.name && location) {
    return `projects/${projectId}/locations/${location}/clusters/${cluster.name}`;
  }
  return cluster.name ?? "unknown";
}

/** The cluster's real region/zone (GKE reports either `location` or `zone`). */
function clusterRegion(cluster: ICluster): string | null {
  return cluster.location ?? cluster.zone ?? null;
}

/**
 * Check 1: gcp_gke_legacy_abac_enabled
 * Legacy ABAC (Attribute-Based Access Control) predates and bypasses Kubernetes
 * RBAC, granting overly broad, statically-defined permissions to the kubelet and
 * other components. It must be disabled so RBAC is the sole authorization path.
 */
function checkLegacyAbac(
  cluster: ICluster,
  projectId: string,
): AgentFindingPayload[] {
  // legacyAbac is only present/enabled when ABAC is on. Treat enabled===true as a
  // finding; absent or {enabled:false} means it is disabled (good).
  if (cluster.legacyAbac?.enabled !== true) return [];

  const name = cluster.name ?? "unknown";
  const id = clusterId(cluster, projectId);
  return [
    {
      title: `GKE cluster "${name}" has Legacy Authorization (ABAC) enabled`,
      description: `GKE cluster ${name} (${id}) has legacyAbac.enabled=true. Legacy ABAC predates Kubernetes RBAC and grants broad, statically-defined permissions that bypass RBAC, weakening per-identity authorization. Disable Legacy Authorization so RBAC is the sole in-cluster access-control mechanism.`,
      severity: "high",
      category: "iam",
      resourceType: RESOURCE_TYPE,
      resourceId: id,
      resourceRegion: clusterRegion(cluster),
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_gke_legacy_abac_enabled"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 2: gcp_gke_no_master_authorized_networks
 * Without Master Authorized Networks the cluster's Kubernetes control plane
 * (API server) endpoint accepts connections from any source IP, dramatically
 * widening the attack surface of the most sensitive component in the cluster.
 */
function checkMasterAuthorizedNetworks(
  cluster: ICluster,
  projectId: string,
): AgentFindingPayload[] {
  if (cluster.masterAuthorizedNetworksConfig?.enabled === true) return [];

  const name = cluster.name ?? "unknown";
  const id = clusterId(cluster, projectId);
  return [
    {
      title: `GKE cluster "${name}" does not enforce Master Authorized Networks`,
      description: `GKE cluster ${name} (${id}) has masterAuthorizedNetworksConfig disabled (or unset), so the Kubernetes control plane (API server) endpoint is reachable from any source IP. Enable Master Authorized Networks and restrict access to a known set of CIDR ranges to reduce the control plane's exposure.`,
      severity: "high",
      category: "network",
      resourceType: RESOURCE_TYPE,
      resourceId: id,
      resourceRegion: clusterRegion(cluster),
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "gcp_gke_no_master_authorized_networks",
      ),
      source: SOURCE,
    },
  ];
}

/**
 * Check 3: gcp_gke_no_network_policy
 * Without a network policy engine enabled, all pods can communicate with every
 * other pod by default, so a single compromised workload has unrestricted
 * lateral network reach across the cluster.
 */
function checkNetworkPolicy(
  cluster: ICluster,
  projectId: string,
): AgentFindingPayload[] {
  if (cluster.networkPolicy?.enabled === true) return [];

  const name = cluster.name ?? "unknown";
  const id = clusterId(cluster, projectId);
  return [
    {
      title: `GKE cluster "${name}" does not have Network Policy enabled`,
      description: `GKE cluster ${name} (${id}) has networkPolicy disabled (or unset), so no network policy engine is enforcing pod-to-pod traffic rules. By default all pods can reach all other pods, giving a compromised workload unrestricted lateral movement. Enable Network Policy enforcement (Calico) and apply least-privilege NetworkPolicy resources.`,
      severity: "high",
      category: "network",
      resourceType: RESOURCE_TYPE,
      resourceId: id,
      resourceRegion: clusterRegion(cluster),
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_gke_no_network_policy"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 4: gcp_gke_not_private_cluster
 * In a non-private cluster the worker nodes are assigned public IP addresses and
 * are directly reachable from the internet, increasing the node attack surface.
 * A private cluster keeps nodes on internal RFC1918 addressing only.
 */
function checkPrivateCluster(
  cluster: ICluster,
  projectId: string,
): AgentFindingPayload[] {
  if (cluster.privateClusterConfig?.enablePrivateNodes === true) return [];

  const name = cluster.name ?? "unknown";
  const id = clusterId(cluster, projectId);
  return [
    {
      title: `GKE cluster "${name}" is not a private cluster`,
      description: `GKE cluster ${name} (${id}) has privateClusterConfig.enablePrivateNodes disabled (or unset), so its worker nodes are assigned public IP addresses and are reachable from the internet. Recreate the cluster as a private cluster (enablePrivateNodes=true) so nodes use internal addressing only and egress through Cloud NAT.`,
      severity: "high",
      category: "network",
      resourceType: RESOURCE_TYPE,
      resourceId: id,
      resourceRegion: clusterRegion(cluster),
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_gke_not_private_cluster"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 5: gcp_gke_shielded_nodes_disabled
 * Shielded GKE Nodes provide verifiable node identity and integrity via secure
 * boot and integrity monitoring, defending against boot- and kernel-level
 * rootkits. Without them, a tampered node image can go undetected.
 */
function checkShieldedNodes(
  cluster: ICluster,
  projectId: string,
): AgentFindingPayload[] {
  if (cluster.shieldedNodes?.enabled === true) return [];

  const name = cluster.name ?? "unknown";
  const id = clusterId(cluster, projectId);
  return [
    {
      title: `GKE cluster "${name}" does not use Shielded GKE Nodes`,
      description: `GKE cluster ${name} (${id}) has shieldedNodes disabled (or unset). Shielded GKE Nodes provide verifiable node identity and integrity through secure boot and integrity monitoring, defending against boot- and kernel-level rootkits. Enable Shielded GKE Nodes for the cluster.`,
      severity: "medium",
      category: "config",
      resourceType: RESOURCE_TYPE,
      resourceId: id,
      resourceRegion: clusterRegion(cluster),
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_gke_shielded_nodes_disabled"),
      source: SOURCE,
    },
  ];
}

/**
 * Runs all GCP GKE security checks and returns findings.
 *
 * Enumerates every GKE cluster in the project across all locations via
 * ClusterManagerClient.listClusters (parent `projects/<id>/locations/-`, the `-`
 * wildcard returns zonal and regional clusters in one call) and derives findings
 * from real cluster properties.
 *
 * Checks:
 * 1. gcp_gke_legacy_abac_enabled           — legacyAbac.enabled === true
 * 2. gcp_gke_no_master_authorized_networks — masterAuthorizedNetworksConfig.enabled !== true
 * 3. gcp_gke_no_network_policy             — networkPolicy.enabled !== true
 * 4. gcp_gke_not_private_cluster           — privateClusterConfig.enablePrivateNodes !== true
 * 5. gcp_gke_shielded_nodes_disabled       — shieldedNodes.enabled !== true
 */
export async function auditGcpGke(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const client = await makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  // The `-` location wildcard enumerates clusters in every zone/region in one
  // call; listClusters returns the full set (no page token for this RPC).
  const [response] = await client.listClusters({
    parent: `projects/${creds.projectId}/locations/-`,
  });

  for (const cluster of response.clusters ?? []) {
    findings.push(...checkLegacyAbac(cluster, creds.projectId));
    findings.push(...checkMasterAuthorizedNetworks(cluster, creds.projectId));
    findings.push(...checkNetworkPolicy(cluster, creds.projectId));
    findings.push(...checkPrivateCluster(cluster, creds.projectId));
    findings.push(...checkShieldedNodes(cluster, creds.projectId));
  }

  return findings;
}

/**
 * GCP GKE Auditor Agent
 *
 * Scans: Google Kubernetes Engine clusters for Legacy ABAC, Master Authorized
 * Networks, Network Policy enforcement, private cluster nodes, and Shielded GKE
 * Nodes.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry.ts
 * still does `new GcpGkeAuditorAgent()` then run/testConnection). Internally it
 * now resolves real GCP service-account credentials, enumerates real GKE
 * clusters via @google-cloud/container, and streams real findings through the
 * agent context.
 */
export class GcpGkeAuditorAgent extends BaseAgent {
  readonly type = "gcp-gke-auditor";
  readonly displayName = "GCP GKE Auditor";
  readonly supportedIntegrations = ["gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveGcpCredentials(ctx.credentialRef);
      const findings = await auditGcpGke(creds);

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

  // REAL IMPL (BLACKFYRE 2026-06): testConnection now validates real GKE API
  // access (resolve creds -> listClusters) instead of returning a hardcoded
  // true. A project with no clusters is still a successful connection; only a
  // credential-resolution/authorization/API failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveGcpCredentials(credentialRef);
      const client = await makeClient(creds);
      await client.listClusters({
        parent: `projects/${creds.projectId}/locations/-`,
      });
      return true;
    } catch {
      return false;
    }
  }
}
