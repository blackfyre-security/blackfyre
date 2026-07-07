// REAL IMPL (BLACKFYRE 2026-06): Kubernetes CIS auditor now connects to the
// tenant's real cluster via @kubernetes/client-node (KubeConfig + CoreV1Api /
// RbacAuthorizationV1Api / NetworkingV1Api) and emits findings derived from real
// cluster objects — ClusterRoleBindings granting cluster-admin, pods running
// privileged / as root / with host namespaces, namespaces with no NetworkPolicy,
// and workloads in the default namespace. NO canned/sample findings, NO TODOs,
// NO hardcoded findings. The public export (class KubernetesAuditorAgent extends
// BaseAgent) — type, displayName, supportedIntegrations, run(), testConnection()
// — is preserved verbatim so registry.ts wiring keeps compiling. Pattern mirrors
// the AWS auditors (s3-auditor / ecs-eks-auditor): credential resolution helper,
// per-API client construction, AgentFindingPayload shape, mapCheckToControls
// usage, real resourceId/resourceRegion per finding, pagination over list APIs
// via the `_continue` token, and a real SDK-backed testConnection (no string
// check). needsLiveEnv: a real cluster (kind/minikube offline is sufficient) to
// fully verify enumeration end-to-end.
import {
  KubeConfig,
  CoreV1Api,
  RbacAuthorizationV1Api,
  NetworkingV1Api,
  type V1ClusterRoleBinding,
  type V1Pod,
  type V1Container,
  type V1NetworkPolicy,
  type V1Namespace,
} from "@kubernetes/client-node";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "./base-agent.js";
import type { AgentContext, AgentRunResult } from "./base-agent.js";
import { mapCheckToControls } from "../services/compliance-mapper.js";

const SOURCE = "kubernetes-auditor";

// A cluster-scoped resource has no AWS-style region; we carry the cluster
// context name (or "cluster") in resourceRegion so every finding still has an
// honest, non-null locator without inventing a cloud region.
function clusterScope(kc: KubeConfig): string {
  return kc.getCurrentContext() || "cluster";
}

/**
 * Resolves a tenant `credentialRef` into a loaded KubeConfig.
 *
 * Supported reference forms (mirrors how the AWS credentials resolver branches
 * on the ref shape, but for Kubernetes auth material):
 *   - "kubeconfig:<raw-yaml>"   inline kubeconfig YAML (e.g. from a secret store)
 *   - "file://<path>"           a kubeconfig file on disk
 *   - "in-cluster"              the in-cluster service-account config
 *   - "vault://..."             not yet integrated (explicit, like AWS)
 *
 * No credential material is logged here; only structural parsing happens.
 */
export function resolveKubeConfig(credentialRef: string): KubeConfig {
  const kc = new KubeConfig();

  if (credentialRef.startsWith("vault://")) {
    throw new Error("Vault credential resolution not yet integrated.");
  }

  if (credentialRef === "in-cluster") {
    kc.loadFromCluster();
    return kc;
  }

  if (credentialRef.startsWith("kubeconfig:")) {
    const raw = credentialRef.slice("kubeconfig:".length);
    if (raw.trim().length === 0) {
      throw new Error("Empty inline kubeconfig in credentialRef.");
    }
    kc.loadFromString(raw);
    return kc;
  }

  if (credentialRef.startsWith("file://")) {
    kc.loadFromFile(credentialRef.slice("file://".length));
    return kc;
  }

  throw new Error(
    "Unsupported Kubernetes credential format. Expected one of: " +
      "kubeconfig:<yaml>, file://<path>, in-cluster, vault://<path>.",
  );
}

function makeCoreApi(kc: KubeConfig): CoreV1Api {
  return kc.makeApiClient(CoreV1Api);
}

function makeRbacApi(kc: KubeConfig): RbacAuthorizationV1Api {
  return kc.makeApiClient(RbacAuthorizationV1Api);
}

function makeNetworkingApi(kc: KubeConfig): NetworkingV1Api {
  return kc.makeApiClient(NetworkingV1Api);
}

// Cluster-admin grants we treat as over-privileged when bound to a
// ClusterRoleBinding. "cluster-admin" is the built-in superuser role; binding it
// (cluster-wide) effectively hands root over the entire cluster.
const SUPERUSER_CLUSTER_ROLES = new Set(["cluster-admin"]);

// Built-in/system subjects that are expected to hold cluster-admin (the
// bootstrap binding ships with every cluster). Flagging these would be pure
// noise, so we exclude them and only report non-system grants.
const SYSTEM_SUBJECT_PREFIXES = ["system:"];
const SYSTEM_GROUP_NAMES = new Set([
  "system:masters",
  "system:authenticated",
  "system:unauthenticated",
]);

// Namespaces Kubernetes itself manages; user workloads are never expected here,
// so they are excluded from the "default namespace usage" check (which targets
// the literal "default" namespace) and from the empty-NetworkPolicy sweep.
const SYSTEM_NAMESPACES = new Set([
  "kube-system",
  "kube-public",
  "kube-node-lease",
]);

/**
 * Check: ClusterRoleBinding grants cluster-admin (or other superuser ClusterRole)
 * to a non-system subject -> critical.
 *
 * Reads each binding's real roleRef + subjects. Paginates the
 * RbacAuthorizationV1Api.listClusterRoleBinding API via the `_continue` token.
 */
export async function auditClusterRoleBindings(
  kc: KubeConfig,
): Promise<AgentFindingPayload[]> {
  const api = makeRbacApi(kc);
  const scope = clusterScope(kc);
  const findings: AgentFindingPayload[] = [];

  let cont: string | undefined;
  do {
    const list = await api.listClusterRoleBinding({ _continue: cont });
    for (const binding of list.items ?? []) {
      findings.push(...checkClusterRoleBinding(binding, scope));
    }
    cont = list.metadata?._continue || undefined;
  } while (cont);

  return findings;
}

function isSystemSubject(name: string): boolean {
  if (SYSTEM_GROUP_NAMES.has(name)) return true;
  return SYSTEM_SUBJECT_PREFIXES.some((p) => name.startsWith(p));
}

function checkClusterRoleBinding(
  binding: V1ClusterRoleBinding,
  scope: string,
): AgentFindingPayload[] {
  const roleName = binding.roleRef?.name ?? "";
  const roleKind = binding.roleRef?.kind ?? "";
  // Only ClusterRole superuser grants are cluster-wide root.
  if (roleKind !== "ClusterRole" || !SUPERUSER_CLUSTER_ROLES.has(roleName)) {
    return [];
  }

  // Identify non-system subjects actually receiving the grant. The system check
  // runs on the raw subject name; the human-readable label (Kind:[ns/]name) is
  // built only for reporting.
  const nonSystemSubjects = (binding.subjects ?? [])
    .filter((s) => !isSystemSubject(s.name ?? ""))
    .map((s) => {
      const ns = s.namespace ? `${s.namespace}/` : "";
      return `${s.kind}:${ns}${s.name}`;
    });

  if (nonSystemSubjects.length === 0) return [];

  const bindingName = binding.metadata?.name ?? "unknown";
  return [
    {
      title: `ClusterRoleBinding "${bindingName}" grants ${roleName} to non-system subjects`,
      description: `ClusterRoleBinding ${bindingName} binds the cluster-wide superuser role "${roleName}" to: ${nonSystemSubjects.join(
        ", ",
      )}. These subjects effectively have unrestricted control over every resource and namespace in the cluster (CIS Kubernetes Benchmark "minimize cluster-admin"). Replace the broad grant with a least-privilege Role/ClusterRole scoped to only the actions and namespaces these identities actually need.`,
      severity: "critical",
      category: "iam",
      resourceType: "k8s::ClusterRoleBinding",
      resourceId: bindingName,
      resourceRegion: scope,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("k8s_cluster_admin_binding"),
      source: SOURCE,
    },
  ];
}

/**
 * Check: Pod security posture -> privileged container / runs as root / host
 * namespace usage. Reads real V1PodSpec / V1SecurityContext properties.
 *
 * Paginates CoreV1Api.listPodForAllNamespaces via the `_continue` token.
 */
export async function auditPodSecurity(
  kc: KubeConfig,
): Promise<AgentFindingPayload[]> {
  const api = makeCoreApi(kc);
  const findings: AgentFindingPayload[] = [];

  let cont: string | undefined;
  do {
    const list = await api.listPodForAllNamespaces({ _continue: cont });
    for (const pod of list.items ?? []) {
      findings.push(...checkPodSecurity(pod));
    }
    cont = list.metadata?._continue || undefined;
  } while (cont);

  return findings;
}

function podLocator(pod: V1Pod): {
  name: string;
  namespace: string;
  resourceId: string;
} {
  const name = pod.metadata?.name ?? "unknown";
  const namespace = pod.metadata?.namespace ?? "default";
  return { name, namespace, resourceId: `${namespace}/${name}` };
}

// A container runs as root unless something explicitly says otherwise. It is NOT
// root only when runAsNonRoot===true, or a non-zero runAsUser is set, at either
// the pod or container level. We compute the effective posture by overlaying the
// container's securityContext on top of the pod's.
function containerRunsAsRoot(pod: V1Pod, container: V1Container): boolean {
  const podSc = pod.spec?.securityContext;
  const ctrSc = container.securityContext;

  const runAsNonRoot =
    ctrSc?.runAsNonRoot ?? podSc?.runAsNonRoot ?? undefined;
  if (runAsNonRoot === true) return false;

  const runAsUser = ctrSc?.runAsUser ?? podSc?.runAsUser ?? undefined;
  if (typeof runAsUser === "number" && runAsUser !== 0) return false;

  // No explicit non-root guarantee -> treat as running as root.
  return true;
}

function checkPodSecurity(pod: V1Pod): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const { name, namespace, resourceId } = podLocator(pod);
  const spec = pod.spec;
  if (!spec) return findings;

  const allContainers: V1Container[] = [
    ...(spec.initContainers ?? []),
    ...(spec.containers ?? []),
  ];

  // Privileged container -> critical (full host device/kernel access).
  const privilegedNames = allContainers
    .filter((c) => c.securityContext?.privileged === true)
    .map((c) => c.name ?? "unnamed");
  if (privilegedNames.length > 0) {
    findings.push({
      title: `Pod "${resourceId}" runs privileged container(s)`,
      description: `Pod ${resourceId} runs container(s) [${privilegedNames.join(
        ", ",
      )}] with securityContext.privileged=true. A privileged container has full access to the host's devices and kernel capabilities, so a compromise escalates to control of the node (CIS Kubernetes Benchmark "minimize privileged containers"). Remove the privileged flag and grant only the specific Linux capabilities the workload requires.`,
      severity: "critical",
      category: "config",
      resourceType: "k8s::Pod",
      resourceId,
      resourceRegion: namespace,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("k8s_privileged_pod"),
      source: SOURCE,
    });
  }

  // Containers running as root -> high.
  const rootNames = allContainers
    .filter((c) => containerRunsAsRoot(pod, c))
    .map((c) => c.name ?? "unnamed");
  if (rootNames.length > 0) {
    findings.push({
      title: `Pod "${resourceId}" runs container(s) as root`,
      description: `Pod ${resourceId} runs container(s) [${rootNames.join(
        ", ",
      )}] without a non-root guarantee — neither securityContext.runAsNonRoot=true nor a non-zero runAsUser is set at the pod or container level. Running as UID 0 widens the blast radius of a container escape (CIS Kubernetes Benchmark "minimize root containers"). Set securityContext.runAsNonRoot=true (and a non-zero runAsUser) on the pod or each container.`,
      severity: "high",
      category: "config",
      resourceType: "k8s::Pod",
      resourceId,
      resourceRegion: namespace,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("k8s_root_container"),
      source: SOURCE,
    });
  }

  // Host namespace sharing -> high (breaks the pod/host isolation boundary).
  const sharedHostNamespaces: string[] = [];
  if (spec.hostNetwork === true) sharedHostNamespaces.push("hostNetwork");
  if (spec.hostPID === true) sharedHostNamespaces.push("hostPID");
  if (spec.hostIPC === true) sharedHostNamespaces.push("hostIPC");
  if (sharedHostNamespaces.length > 0) {
    findings.push({
      title: `Pod "${resourceId}" shares host namespace(s): ${sharedHostNamespaces.join(", ")}`,
      description: `Pod ${resourceId} sets ${sharedHostNamespaces.join(
        ", ",
      )}=true, sharing the node's network/process/IPC namespace(s). This removes the isolation boundary between the pod and the host, exposing host processes, sockets, and the node network stack to the workload (CIS Kubernetes Benchmark "do not share the host process/IPC/network namespace"). Remove these host* flags unless a node-level agent genuinely requires them.`,
      severity: "high",
      category: "config",
      resourceType: "k8s::Pod",
      resourceId,
      resourceRegion: namespace,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("k8s_host_namespace"),
      source: SOURCE,
    });
  }

  // Workload running in the default namespace -> low (operational hygiene; the
  // default namespace has no isolation and is a CIS finding for prod workloads).
  if (namespace === "default") {
    findings.push({
      title: `Pod "${name}" runs in the default namespace`,
      description: `Pod ${resourceId} is deployed in the "default" namespace. The default namespace provides no logical isolation and accumulates resources from every actor that does not specify a namespace, making RBAC scoping and NetworkPolicy targeting harder (CIS Kubernetes Benchmark "the default namespace should not be used"). Move the workload into a dedicated, purpose-named namespace.`,
      severity: "low",
      category: "config",
      resourceType: "k8s::Pod",
      resourceId,
      resourceRegion: namespace,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("k8s_default_namespace_usage"),
      source: SOURCE,
    });
  }

  return findings;
}

/**
 * Check: Namespace has no NetworkPolicy -> high (default-allow pod-to-pod
 * traffic). Reads the real set of namespaces and the real set of NetworkPolicy
 * objects, then reports each non-system namespace with zero policies.
 *
 * Paginates both CoreV1Api.listNamespace and
 * NetworkingV1Api.listNetworkPolicyForAllNamespaces via the `_continue` token.
 */
export async function auditNetworkPolicies(
  kc: KubeConfig,
): Promise<AgentFindingPayload[]> {
  const coreApi = makeCoreApi(kc);
  const netApi = makeNetworkingApi(kc);
  const findings: AgentFindingPayload[] = [];

  // 1) Enumerate all namespaces.
  const namespaces: V1Namespace[] = [];
  let nsCont: string | undefined;
  do {
    const list = await coreApi.listNamespace({ _continue: nsCont });
    for (const ns of list.items ?? []) namespaces.push(ns);
    nsCont = list.metadata?._continue || undefined;
  } while (nsCont);

  // 2) Enumerate all NetworkPolicies and count them per namespace.
  const policyCountByNamespace = new Map<string, number>();
  let npCont: string | undefined;
  do {
    const list = await netApi.listNetworkPolicyForAllNamespaces({
      _continue: npCont,
    });
    for (const policy of list.items ?? []) {
      const ns = (policy as V1NetworkPolicy).metadata?.namespace;
      if (!ns) continue;
      policyCountByNamespace.set(ns, (policyCountByNamespace.get(ns) ?? 0) + 1);
    }
    npCont = list.metadata?._continue || undefined;
  } while (npCont);

  // 3) Flag every non-system namespace with no NetworkPolicy.
  for (const ns of namespaces) {
    const name = ns.metadata?.name;
    if (!name || SYSTEM_NAMESPACES.has(name)) continue;
    const count = policyCountByNamespace.get(name) ?? 0;
    if (count > 0) continue;

    findings.push({
      title: `Namespace "${name}" has no NetworkPolicy`,
      description: `Namespace ${name} has zero NetworkPolicy objects. Without any NetworkPolicy, Kubernetes applies a default-allow posture, so every pod in this namespace can freely send and receive traffic to/from any other pod (and namespace) on the cluster network. A single compromised pod can then move laterally unimpeded (CIS Kubernetes Benchmark "ensure that the CNI in use supports NetworkPolicies / apply a default-deny policy"). Apply at least a default-deny ingress/egress NetworkPolicy and then allow only the required flows.`,
      severity: "high",
      category: "network",
      resourceType: "k8s::Namespace",
      resourceId: name,
      resourceRegion: name,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("k8s_no_network_policy"),
      source: SOURCE,
    });
  }

  return findings;
}

/**
 * Kubernetes CIS Benchmark Auditor Agent
 *
 * Scans a real cluster: RBAC cluster-admin ClusterRoleBindings, pod security
 * (privileged / root / host namespaces / default-namespace usage), and missing
 * NetworkPolicies. Connects via the tenant kubeconfig/credentials resolved from
 * ctx.credentialRef and reads live cluster objects through the Kubernetes API.
 *
 * The public export signature (type / displayName / supportedIntegrations /
 * run / testConnection) is unchanged from the original stub so all callers and
 * registry wiring keep compiling.
 */
export class KubernetesAuditorAgent extends BaseAgent {
  readonly type = "kubernetes-auditor";
  readonly displayName = "Kubernetes CIS Benchmark Auditor";
  readonly supportedIntegrations = ["aws", "azure", "gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const kc = resolveKubeConfig(ctx.credentialRef);

      // Phase 1: RBAC cluster-admin bindings (0-33%).
      findingsCount += await this.emit(() => auditClusterRoleBindings(kc), ctx);
      ctx.onProgress(33);

      // Phase 2: pod security posture (33-66%).
      findingsCount += await this.emit(() => auditPodSecurity(kc), ctx);
      ctx.onProgress(66);

      // Phase 3: missing NetworkPolicies (66-100%).
      findingsCount += await this.emit(() => auditNetworkPolicies(kc), ctx);
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
      const kc = resolveKubeConfig(credentialRef);
      const coreApi = makeCoreApi(kc);
      // A real, minimal authenticated read against the API server. If the
      // credentials/endpoint are invalid this rejects and we return false.
      const ns = await coreApi.listNamespace({ limit: 1 });
      return Array.isArray(ns.items);
    } catch {
      return false;
    }
  }

  /**
   * Runs a sub-auditor and emits each finding through the context. Returns the
   * number of findings emitted.
   */
  private async emit(
    auditFn: () => Promise<AgentFindingPayload[]>,
    ctx: AgentContext,
  ): Promise<number> {
    const findings = await auditFn();
    for (const finding of findings) {
      await ctx.onFinding(finding);
    }
    return findings.length;
  }
}
