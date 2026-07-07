// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real Kubernetes
// CIS auditor. Mocks @kubernetes/client-node so KubeConfig.makeApiClient() hands
// back crafted CoreV1Api / RbacAuthorizationV1Api / NetworkingV1Api stubs whose
// list*() methods return controlled cluster objects. We then assert the auditor
// derives findings (and non-findings) from the REAL object properties:
// ClusterRoleBinding.roleRef/subjects, Pod securityContext.privileged /
// runAsNonRoot, host namespaces, default-namespace usage, and namespaces lacking
// a NetworkPolicy. 1 pass-case + 1 fail-case per checked auditor.
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() runs BEFORE any vi.mock() factory or module imports. vitest hoists
// vi.mock above all top-level declarations, so any variable the factory references
// must live in the hoisted block — a plain top-level `const`/`class` would be in the
// temporal dead zone when the factory executes ("no top level variables inside").
const {
  listClusterRoleBinding,
  listPodForAllNamespaces,
  listNamespace,
  listNetworkPolicyForAllNamespaces,
  FakeCoreV1Api,
  FakeRbacApi,
  FakeNetworkingApi,
  loadFromString,
  getCurrentContext,
} = vi.hoisted(() => {
  // ---- Per-API mock list functions ----
  const listClusterRoleBinding = vi.fn();
  const listPodForAllNamespaces = vi.fn();
  const listNamespace = vi.fn();
  const listNetworkPolicyForAllNamespaces = vi.fn();

  // Sentinel marker classes so makeApiClient can route to the right stub.
  class FakeCoreV1Api {}
  class FakeRbacApi {}
  class FakeNetworkingApi {}

  const loadFromString = vi.fn();
  const getCurrentContext = vi.fn().mockReturnValue("kind-test");

  return {
    listClusterRoleBinding,
    listPodForAllNamespaces,
    listNamespace,
    listNetworkPolicyForAllNamespaces,
    FakeCoreV1Api,
    FakeRbacApi,
    FakeNetworkingApi,
    loadFromString,
    getCurrentContext,
  };
});

vi.mock("@kubernetes/client-node", () => {
  class KubeConfig {
    loadFromString = loadFromString;
    loadFromFile = vi.fn();
    loadFromCluster = vi.fn();
    getCurrentContext = getCurrentContext;
    makeApiClient(ctor: unknown) {
      if (ctor === FakeCoreV1Api) {
        return { listPodForAllNamespaces, listNamespace };
      }
      if (ctor === FakeRbacApi) {
        return { listClusterRoleBinding };
      }
      if (ctor === FakeNetworkingApi) {
        return { listNetworkPolicyForAllNamespaces };
      }
      throw new Error("unexpected api client");
    }
  }
  return {
    KubeConfig,
    CoreV1Api: FakeCoreV1Api,
    RbacAuthorizationV1Api: FakeRbacApi,
    NetworkingV1Api: FakeNetworkingApi,
  };
});

// ---- Mock: compliance-mapper (return a non-empty mapping for any check) ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation(() => [
    {
      framework: "iso27001",
      controlId: "A.8.2",
      controlName: "Test Control",
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Import after mocks ----
import { KubeConfig } from "@kubernetes/client-node";
import {
  resolveKubeConfig,
  auditClusterRoleBindings,
  auditPodSecurity,
  auditNetworkPolicies,
} from "../../src/agents/kubernetes-auditor.js";

function makeKc(): KubeConfig {
  return resolveKubeConfig("kubeconfig:apiVersion: v1");
}

describe("auditClusterRoleBindings (real RBAC auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentContext.mockReturnValue("kind-test");
  });

  it("PASS-case: cluster-admin bound only to system:masters produces no findings", async () => {
    listClusterRoleBinding.mockResolvedValueOnce({
      items: [
        {
          metadata: { name: "cluster-admin" },
          roleRef: { kind: "ClusterRole", name: "cluster-admin", apiGroup: "rbac.authorization.k8s.io" },
          subjects: [{ kind: "Group", name: "system:masters" }],
        },
      ],
      metadata: { _continue: undefined },
    });

    const findings = await auditClusterRoleBindings(makeKc());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: cluster-admin bound to a non-system ServiceAccount yields a critical iam finding", async () => {
    listClusterRoleBinding.mockResolvedValueOnce({
      items: [
        {
          metadata: { name: "ci-admin" },
          roleRef: { kind: "ClusterRole", name: "cluster-admin", apiGroup: "rbac.authorization.k8s.io" },
          subjects: [{ kind: "ServiceAccount", name: "ci-runner", namespace: "build" }],
        },
      ],
      metadata: { _continue: undefined },
    });

    const findings = await auditClusterRoleBindings(makeKc());
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.severity).toBe("critical");
    expect(f.category).toBe("iam");
    expect(f.resourceType).toBe("k8s::ClusterRoleBinding");
    expect(f.resourceId).toBe("ci-admin");
    expect(f.resourceRegion).toBe("kind-test");
    expect(f.title).toContain("cluster-admin");
    expect(f.description).toContain("ServiceAccount:build/ci-runner");
    expect(f.controlMappings!.length).toBeGreaterThan(0);
    expect(f.source).toBe("kubernetes-auditor");
  });

  it("paginates listClusterRoleBinding until _continue is exhausted", async () => {
    listClusterRoleBinding
      .mockResolvedValueOnce({
        items: [
          {
            metadata: { name: "page1" },
            roleRef: { kind: "ClusterRole", name: "view" },
            subjects: [{ kind: "User", name: "alice" }],
          },
        ],
        metadata: { _continue: "next" },
      })
      .mockResolvedValueOnce({
        items: [
          {
            metadata: { name: "page2-admin" },
            roleRef: { kind: "ClusterRole", name: "cluster-admin" },
            subjects: [{ kind: "User", name: "mallory" }],
          },
        ],
        metadata: { _continue: undefined },
      });

    const findings = await auditClusterRoleBindings(makeKc());
    expect(listClusterRoleBinding).toHaveBeenCalledTimes(2);
    // Only the cluster-admin grant on page 2 is a finding.
    expect(findings).toHaveLength(1);
    expect(findings[0].resourceId).toBe("page2-admin");
  });
});

describe("auditPodSecurity (real pod-security auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: non-privileged non-root pod in a dedicated namespace produces no findings", async () => {
    listPodForAllNamespaces.mockResolvedValueOnce({
      items: [
        {
          metadata: { name: "api-1", namespace: "payments" },
          spec: {
            securityContext: { runAsNonRoot: true },
            containers: [
              { name: "api", securityContext: { privileged: false, runAsNonRoot: true, runAsUser: 1000 } },
            ],
          },
        },
      ],
      metadata: { _continue: undefined },
    });

    const findings = await auditPodSecurity(makeKc());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: privileged + root + hostNetwork pod in default namespace yields four findings", async () => {
    listPodForAllNamespaces.mockResolvedValueOnce({
      items: [
        {
          metadata: { name: "bad-pod", namespace: "default" },
          spec: {
            hostNetwork: true, // host namespace finding
            containers: [
              // privileged + no non-root guarantee => privileged + root findings
              { name: "app", securityContext: { privileged: true } },
            ],
          },
        },
      ],
      metadata: { _continue: undefined },
    });

    const findings = await auditPodSecurity(makeKc());

    const privileged = findings.find((f) => f.title.includes("privileged container"));
    expect(privileged).toBeDefined();
    expect(privileged!.severity).toBe("critical");
    expect(privileged!.resourceId).toBe("default/bad-pod");
    expect(privileged!.resourceRegion).toBe("default");

    const root = findings.find((f) => f.title.includes("as root"));
    expect(root).toBeDefined();
    expect(root!.severity).toBe("high");

    const host = findings.find((f) => f.title.includes("host namespace"));
    expect(host).toBeDefined();
    expect(host!.severity).toBe("high");
    expect(host!.title).toContain("hostNetwork");

    const defaultNs = findings.find((f) => f.title.includes("default namespace"));
    expect(defaultNs).toBeDefined();
    expect(defaultNs!.severity).toBe("low");

    expect(findings).toHaveLength(4);
    for (const f of findings) {
      expect(f.source).toBe("kubernetes-auditor");
      expect(f.resourceType).toBe("k8s::Pod");
    }
  });
});

describe("auditNetworkPolicies (real NetworkPolicy auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: every non-system namespace has a NetworkPolicy -> no findings", async () => {
    listNamespace.mockResolvedValueOnce({
      items: [
        { metadata: { name: "payments" } },
        { metadata: { name: "kube-system" } }, // system ns is ignored
      ],
      metadata: { _continue: undefined },
    });
    listNetworkPolicyForAllNamespaces.mockResolvedValueOnce({
      items: [{ metadata: { name: "default-deny", namespace: "payments" } }],
      metadata: { _continue: undefined },
    });

    const findings = await auditNetworkPolicies(makeKc());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: a non-system namespace with no NetworkPolicy yields a high network finding", async () => {
    listNamespace.mockResolvedValueOnce({
      items: [
        { metadata: { name: "payments" } }, // has a policy -> ok
        { metadata: { name: "legacy" } }, // no policy -> finding
        { metadata: { name: "kube-public" } }, // system -> ignored
      ],
      metadata: { _continue: undefined },
    });
    listNetworkPolicyForAllNamespaces.mockResolvedValueOnce({
      items: [{ metadata: { name: "default-deny", namespace: "payments" } }],
      metadata: { _continue: undefined },
    });

    const findings = await auditNetworkPolicies(makeKc());
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.severity).toBe("high");
    expect(f.category).toBe("network");
    expect(f.resourceType).toBe("k8s::Namespace");
    expect(f.resourceId).toBe("legacy");
    expect(f.resourceRegion).toBe("legacy");
    expect(f.title).toContain("no NetworkPolicy");
    expect(f.controlMappings!.length).toBeGreaterThan(0);
  });
});
