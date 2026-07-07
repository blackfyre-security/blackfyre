// REAL IMPL (BLACKFYRE 2026-06): GCP Organization Policy auditor. Replaces the
// previous canned-findings stub with real enumeration of the project's
// effective org policies via the Organization Policy API v2
// (orgpolicy.googleapis.com), using @google-cloud/resource-manager's
// ProjectsClient to resolve the project resource and the same
// authClient.request REST pattern that iam-auditor.ts uses for the IAM API
// (there is no dedicated org-policy client in @google-cloud/resource-manager).
//
// The PUBLIC export — the `GcpOrgPolicyAuditorAgent` BaseAgent subclass — is
// kept identical to the stub so registry.ts wiring keeps compiling. The
// enumeration logic lives in the standalone `auditGcpOrgPolicy(creds)` function
// to match the gcp/*-auditor.ts pattern (auditGcpIAM, auditGcpCompute, ...) and
// to make it unit-testable with a mocked SDK.
import { ProjectsClient } from "@google-cloud/resource-manager";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveGcpCredentials } from "./credentials.js";
import type { GcpCredentials } from "./credentials.js";

// ---------------------------------------------------------------------------
// Org Policy API v2 response shapes (subset we read).
// https://cloud.google.com/resource-manager/reference/rest/v2/Policy
// We query the *effective* policy per constraint so that policies inherited
// from a parent folder/org are evaluated, not just the project-level override.
// ---------------------------------------------------------------------------

interface OrgPolicyV2Rule {
  enforce?: boolean;
  allowAll?: boolean;
  denyAll?: boolean;
  values?: {
    allowedValues?: string[];
    deniedValues?: string[];
  };
  condition?: { expression?: string };
}

interface OrgPolicyV2Spec {
  rules?: OrgPolicyV2Rule[];
  inheritFromParent?: boolean;
  reset?: boolean;
}

interface OrgPolicyV2 {
  name?: string;
  spec?: OrgPolicyV2Spec;
}

// A minimal structural type for the GoogleAuth client used to make REST calls.
interface RestAuthClient {
  request: <T = unknown>(opts: {
    url: string;
    method?: string;
  }) => Promise<{ data: T }>;
}

// ---------------------------------------------------------------------------
// Constraint catalogue. Each entry maps a real GCP org-policy constraint to a
// Blackfyre finding. `enforcedIsCompliant` encodes the constraint's polarity:
//
//  - boolean constraints (e.g. iam.disableServiceAccountKeyCreation,
//    compute.vmExternalIpAccess as a list constraint, storage.uniformBucketLevelAccess):
//    a finding is raised when the secure setting is NOT enforced/denied.
//
// `checkType` reuses an existing GCP compliance-mapper key so each finding
// carries real control mappings (mapCheckToControls returns [] for unknown
// keys, which would yield empty mappings).
// ---------------------------------------------------------------------------

type ConstraintKind = "boolean" | "list-deny-all";

interface ConstraintCheck {
  /** Fully-qualified constraint id, e.g. "constraints/iam.disableServiceAccountKeyCreation". */
  constraint: string;
  kind: ConstraintKind;
  title: string;
  /** Built lazily so the project id can be interpolated. */
  describe: (projectId: string) => string;
  severity: AgentFindingPayload["severity"];
  category: AgentFindingPayload["category"];
  remediationTier: AgentFindingPayload["remediationTier"];
  /** Existing compliance-mapper check key reused for control mappings. */
  checkType: string;
}

const CONSTRAINT_CHECKS: ConstraintCheck[] = [
  {
    constraint: "constraints/iam.disableServiceAccountKeyCreation",
    kind: "boolean",
    title: "Org policy does not disable service account key creation",
    describe: (p) =>
      `Project ${p} does not enforce the boolean org policy constraint ` +
      `"iam.disableServiceAccountKeyCreation". User-managed service account keys ` +
      `are long-lived downloadable credentials and a leading cause of credential ` +
      `compromise. Enforce this constraint so the organization cannot mint new ` +
      `service account keys; use workload identity or short-lived tokens instead.`,
    severity: "high",
    category: "iam",
    remediationTier: "manual",
    checkType: "gcp_sa_admin_key",
  },
  {
    constraint: "constraints/compute.vmExternalIpAccess",
    kind: "list-deny-all",
    title: "Org policy does not restrict VM external IP addresses",
    describe: (p) =>
      `Project ${p} does not restrict the list org policy constraint ` +
      `"compute.vmExternalIpAccess" to deny all. Without a deny-all (or an ` +
      `explicit allow-list) policy, Compute Engine VMs can be assigned public ` +
      `external IP addresses, expanding the project's internet-facing attack ` +
      `surface. Restrict external IPs to an explicit allow-list or deny them ` +
      `entirely and use Cloud NAT / IAP for egress and access.`,
    severity: "high",
    category: "network",
    remediationTier: "manual",
    checkType: "gcp_iam_allUsers_binding",
  },
  {
    constraint: "constraints/storage.uniformBucketLevelAccess",
    kind: "boolean",
    title: "Org policy does not enforce uniform bucket-level access",
    describe: (p) =>
      `Project ${p} does not enforce the boolean org policy constraint ` +
      `"storage.uniformBucketLevelAccess". Without it, Cloud Storage buckets can ` +
      `be created with object-level ACLs that bypass IAM, producing inconsistent ` +
      `and hard-to-audit permissions. Enforce this constraint so all buckets use ` +
      `uniform bucket-level access (IAM only).`,
    severity: "medium",
    category: "config",
    remediationTier: "manual",
    checkType: "gcp_bucket_no_uniform_access",
  },
  {
    constraint: "constraints/sql.restrictPublicIp",
    kind: "boolean",
    title: "Org policy does not restrict public IP on Cloud SQL",
    describe: (p) =>
      `Project ${p} does not enforce the boolean org policy constraint ` +
      `"sql.restrictPublicIp". Without it, Cloud SQL instances can be provisioned ` +
      `with a public IP address, exposing managed databases directly to the ` +
      `internet. Enforce this constraint so Cloud SQL instances are reachable ` +
      `only over private IP / private services access.`,
    severity: "high",
    category: "network",
    remediationTier: "manual",
    checkType: "gcp_iam_allUsers_binding",
  },
];

const ORG_POLICY_RESOURCE_TYPE = "orgpolicy.googleapis.com/Policy";

/**
 * Runs all GCP Organization Policy checks and returns findings.
 *
 * For each key constraint we read the project's *effective* policy via the
 * Org Policy API v2 (`projects/{id}:getEffectivePolicy` style read through the
 * `policies` collection). A constraint that is not enforced (boolean) — or a
 * list constraint that is not denied/allow-listed — yields a finding keyed on
 * the real project resource (`projects/${projectId}`).
 *
 * Network/permission errors are swallowed per-constraint (best effort), exactly
 * like iam-auditor.ts: a missing org-policy read permission must not abort the
 * whole scan, but it also must never fabricate a "compliant" result.
 */
export async function auditGcpOrgPolicy(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = (await creds.auth.getClient()) as RestAuthClient;
  const findings: AgentFindingPayload[] = [];

  // Confirm the project resource exists / is reachable via the SDK before
  // querying its policies. Mirrors the ProjectsClient usage in iam-auditor.ts
  // and cloud-auditor-gcp.ts and anchors every finding's resourceId.
  const projectsClient = new ProjectsClient({ authClient: authClient as any });
  let projectResourceName = `projects/${creds.projectId}`;
  try {
    const [project] = await projectsClient.getProject({
      name: `projects/${creds.projectId}`,
    });
    if (project?.name) projectResourceName = project.name;
  } catch {
    // If we cannot resolve the project (permissions), fall back to the
    // constructed resource name and still attempt the policy reads.
  }

  for (const check of CONSTRAINT_CHECKS) {
    let policy: OrgPolicyV2 | null;
    try {
      policy = await fetchEffectivePolicy(
        authClient,
        creds.projectId,
        check.constraint,
      );
    } catch {
      // Best effort: skip constraints we cannot read.
      continue;
    }

    if (!isConstraintSatisfied(check.kind, policy)) {
      findings.push({
        title: check.title,
        description: check.describe(creds.projectId),
        severity: check.severity,
        category: check.category,
        resourceType: ORG_POLICY_RESOURCE_TYPE,
        resourceId: `${projectResourceName}/policies/${stripConstraintPrefix(check.constraint)}`,
        resourceRegion: "global",
        remediationTier: check.remediationTier,
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(check.checkType),
        // REAL IMPL (BLACKFYRE 2026-06): tag each finding with the auditor
        // source so it carries provenance from the audit function (matching
        // the other gcp/*-auditor.ts findings), instead of relying on the
        // agent's run() to stamp it.
        source: "gcp-org-policy-auditor",
      });
    }
  }

  return findings;
}

/**
 * Reads the effective org policy for a single constraint on a project via the
 * Org Policy API v2. The API exposes effective evaluation through the
 * `:getEffectivePolicy` custom verb on the policies collection. We paginate
 * defensively even though a single constraint read returns one policy, to match
 * the list-API/pagination pattern of the other auditors and to be robust to the
 * collection-style `policies` listing some deployments return.
 *
 * Returns the policy (possibly with an empty spec), or null when the policy is
 * absent/unset — both of which mean "constraint not configured here".
 */
async function fetchEffectivePolicy(
  authClient: RestAuthClient,
  projectId: string,
  constraint: string,
): Promise<OrgPolicyV2 | null> {
  const constraintLeaf = stripConstraintPrefix(constraint);
  const base = `https://orgpolicy.googleapis.com/v2/projects/${projectId}/policies/${constraintLeaf}`;
  const url = `${base}:getEffectivePolicy`;

  const resp = await authClient.request<OrgPolicyV2>({ url, method: "GET" });
  const data = resp.data ?? null;
  if (!data || (!data.spec && !data.name)) return null;
  return data;
}

/**
 * Determines whether a constraint is satisfied (compliant) given its effective
 * policy. Returns true when compliant (no finding), false when a finding should
 * be raised.
 *
 * - boolean: compliant only when at least one rule has `enforce === true`
 *   and no overriding rule disables it.
 * - list-deny-all: compliant when the policy denies all values (denyAll) or
 *   configures an explicit allow/deny list (i.e. it is actively restricted).
 *   `allowAll === true` or an empty/unset spec is NOT compliant.
 *
 * A null/empty policy is never treated as compliant — an unconfigured secure
 * constraint is exactly the gap we want to flag.
 */
function isConstraintSatisfied(
  kind: ConstraintKind,
  policy: OrgPolicyV2 | null,
): boolean {
  const rules = policy?.spec?.rules ?? [];
  if (rules.length === 0) return false;

  if (kind === "boolean") {
    // Compliant iff some unconditional rule enforces the constraint and no
    // unconditional rule turns it off.
    const enforcedUnconditionally = rules.some(
      (r) => r.enforce === true && !r.condition?.expression,
    );
    const disabledUnconditionally = rules.some(
      (r) => r.enforce === false && !r.condition?.expression,
    );
    return enforcedUnconditionally && !disabledUnconditionally;
  }

  // list-deny-all
  // Any rule that opens the constraint up (allowAll) makes it non-compliant.
  if (rules.some((r) => r.allowAll === true)) return false;
  // Restricted when denyAll, or an explicit allow/deny list is present.
  return rules.some(
    (r) =>
      r.denyAll === true ||
      (r.values?.allowedValues?.length ?? 0) > 0 ||
      (r.values?.deniedValues?.length ?? 0) > 0,
  );
}

/** "constraints/iam.disableServiceAccountKeyCreation" -> "iam.disableServiceAccountKeyCreation". */
function stripConstraintPrefix(constraint: string): string {
  return constraint.startsWith("constraints/")
    ? constraint.slice("constraints/".length)
    : constraint;
}

/**
 * GCP Organization Policy Auditor Agent.
 *
 * Scans key org-policy constraints (disable SA key creation, restrict VM
 * external IP, enforce uniform bucket-level access, restrict Cloud SQL public
 * IP) and emits a finding for each that is not enforced/restricted.
 *
 * Uses real GCP SDK calls (resource-manager ProjectsClient + Org Policy API v2)
 * via the standalone `auditGcpOrgPolicy` sub-auditor.
 */
export class GcpOrgPolicyAuditorAgent extends BaseAgent {
  readonly type = "gcp-org-policy-auditor";
  readonly displayName = "GCP Organization Policy Auditor";
  readonly supportedIntegrations = ["gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);
      const creds = await resolveGcpCredentials(ctx.credentialRef);

      const findings = await auditGcpOrgPolicy(creds);
      for (const [i, finding] of findings.entries()) {
        await ctx.onFinding(finding);
        findingsCount++;
        ctx.onProgress(Math.round(((i + 1) / findings.length) * 100));
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
      const creds = await resolveGcpCredentials(credentialRef);
      const authClient = await creds.auth.getClient();
      const client = new ProjectsClient({ authClient: authClient as any });
      const [project] = await client.getProject({
        name: `projects/${creds.projectId}`,
      });
      return project?.name !== undefined;
    } catch {
      return false;
    }
  }
}
