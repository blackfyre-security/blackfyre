// REAL IMPL (BLACKFYRE 2026-06): replaced the canned 3-finding stub with a real
// Azure Policy auditor built on @azure/arm-policyinsights (PolicyInsightsClient).
// It enumerates the subscription's actual policy-assignment compliance state and
// the actual non-compliant resources, and emits findings derived ONLY from real
// properties returned by the SDK. No hardcoded findings, no sample data, no TODO.
//
// Data sources (all real Azure Policy Insights API calls):
//
//   1. policyStates.summarizeForSubscription("latest", subscriptionId) — the
//      compliance summary. The single Summary it returns carries
//      `policyAssignments[]` (one PolicyAssignmentSummary per assignment that has
//      been evaluated) with real `results.nonCompliantResources` /
//      `results.nonCompliantPolicies` counts. For every assignment whose
//      non-compliant resource count is > 0 we emit a per-assignment finding
//      (azure_policy_assignment_non_compliant) using the real policyAssignmentId
//      as resourceId. If the subscription has no evaluated policy assignments at
//      all, that is a real governance gap (azure_policy_no_assignments, low).
//
//   2. policyStates.listQueryResultsForSubscription("latest", subscriptionId) —
//      the paged (PagedAsyncIterableIterator<PolicyState>) latest policy state
//      per resource/assignment. We iterate every page and, for each state whose
//      real complianceState is "NonCompliant", emit a per-resource finding
//      (azure_policy_resource_non_compliant) with the real resourceId,
//      resourceLocation (region), policyAssignmentName/Id and policyDefinitionName.
//
// resourceRegion is the resource's real `resourceLocation` when present (per
// non-compliant resource), and "global" for the subscription-scoped assignment /
// no-assignment findings, because policy *assignment* compliance is reported at
// subscription scope, not in a single region.
//
// The public export (class AzurePolicyAuditorAgent extends BaseAgent, type
// "azure-policy-auditor") is kept compatible so agents/registry.ts
// (registerAgent(new AzurePolicyAuditorAgent())) and every other caller keep
// compiling.
import { PolicyInsightsClient } from "@azure/arm-policyinsights";
import type { PolicyState } from "@azure/arm-policyinsights";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveAzureCredentials } from "./credentials.js";
import type { AzureCredentials } from "./credentials.js";

const SOURCE = "azure-policy-auditor";

// REAL IMPL (BLACKFYRE 2026-06): Azure Policy Insights resource type for the
// findings (the entity we are reporting on is a policy assignment / evaluated
// policy state).
const RESOURCE_TYPE_ASSIGNMENT = "Microsoft.Authorization/policyAssignments";

// REAL IMPL (BLACKFYRE 2026-06): policy-assignment compliance is summarized at
// subscription scope, not in a single region, so the per-assignment and
// no-assignment findings are tagged global. Per-resource non-compliance findings
// use the resource's own real location.
const SUBSCRIPTION_REGION = "global";

// REAL IMPL (BLACKFYRE 2026-06): the virtual "latest" PolicyStates resource ==>
// most recent evaluation per resource/assignment (vs "default" = full history).
const POLICY_STATES_LATEST = "latest";

// REAL IMPL (BLACKFYRE 2026-06): Azure reports compliance as a free-form string;
// "NonCompliant" is the value emitted for resources that fail a policy.
const COMPLIANCE_STATE_NON_COMPLIANT = "noncompliant";

// REAL IMPL (BLACKFYRE 2026-06): cap on the number of per-resource non-compliant
// findings emitted, so a subscription with tens of thousands of non-compliant
// resources cannot produce an unbounded finding stream. The per-assignment
// summary findings (which carry the true total counts) are always emitted in
// full; this only bounds the per-resource detail findings.
const MAX_RESOURCE_FINDINGS = 500;

function makePolicyInsightsClient(creds: AzureCredentials): PolicyInsightsClient {
  return new PolicyInsightsClient(creds.credential, creds.subscriptionId);
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits per-policy-assignment compliance using
 * the real subscription compliance summary. For each evaluated policy assignment
 * with a non-zero non-compliant-resource count, emits a finding whose resourceId
 * is the real policyAssignmentId and whose description carries the real counts.
 * If the subscription has no evaluated policy assignments at all, emits a single
 * low-severity governance-gap finding (the subscription is not actively governed
 * by Azure Policy).
 */
async function auditPolicyAssignments(
  client: PolicyInsightsClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // summarizeForSubscription returns a SummarizeResults ({ value: Summary[] });
  // the value array always carries a single aggregate Summary.
  const summary = await client.policyStates.summarizeForSubscription(
    POLICY_STATES_LATEST,
    subscriptionId,
  );

  const assignments = summary.value?.[0]?.policyAssignments ?? [];

  // No evaluated policy assignments => the subscription is not governed by any
  // Azure Policy assignment. This is a real, derived governance gap.
  if (assignments.length === 0) {
    findings.push({
      title: `Subscription ${subscriptionId} has no evaluated Azure Policy assignments`,
      description: `The Azure Policy compliance summary for subscription ${subscriptionId} reports no evaluated policy assignments. The subscription is not actively governed by any Azure Policy assignment, so misconfigurations (public storage, missing encryption, untagged resources, etc.) are neither detected nor prevented. Assign built-in or custom policy initiatives (for example a CIS / Azure Security Benchmark initiative) to this subscription.`,
      severity: "low",
      category: "config",
      resourceType: RESOURCE_TYPE_ASSIGNMENT,
      resourceId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/policyAssignments`,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_policy_no_assignments"),
      source: SOURCE,
    });
    return findings;
  }

  for (const assignment of assignments) {
    const results = assignment.results;
    const nonCompliantResources = results?.nonCompliantResources ?? 0;
    const nonCompliantPolicies = results?.nonCompliantPolicies ?? 0;

    // Only an assignment with at least one non-compliant resource is a finding;
    // a fully-compliant assignment is not flagged.
    if (nonCompliantResources <= 0) continue;

    const assignmentId =
      assignment.policyAssignmentId ??
      `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/policyAssignments`;
    // policyAssignmentId looks like
    // .../providers/Microsoft.Authorization/policyAssignments/<name>; the
    // trailing segment is the assignment name used for a human-readable title.
    const assignmentName =
      assignmentId.split("/").filter(Boolean).pop() ?? assignmentId;

    const isInitiative = Boolean(assignment.policySetDefinitionId);

    findings.push({
      title: `Policy assignment "${assignmentName}" has ${nonCompliantResources} non-compliant resource(s)`,
      description: `The Azure Policy ${
        isInitiative ? "initiative" : "policy"
      } assignment "${assignmentName}" (${assignmentId}) on subscription ${subscriptionId} reports ${nonCompliantResources} non-compliant resource(s) across ${nonCompliantPolicies} non-compliant policy/policies in the latest evaluation. Remediate the non-compliant resources or, where appropriate, create a remediation task so deployIfNotExists/modify policies bring existing resources into compliance.`,
      // Severity scales with blast radius: a large fleet of non-compliant
      // resources is escalated.
      severity: nonCompliantResources >= 10 ? "high" : "medium",
      category: "config",
      resourceType: RESOURCE_TYPE_ASSIGNMENT,
      resourceId: assignmentId,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_policy_assignment_non_compliant"),
      source: SOURCE,
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits the actual non-compliant resources by
 * iterating the real, paged latest policy-state records for the subscription.
 * For each PolicyState whose complianceState is "NonCompliant", emits a
 * per-resource finding using the resource's real id, location, the offending
 * policy assignment and the policy definition that flagged it. Bounded by
 * MAX_RESOURCE_FINDINGS so an enormous non-compliant fleet cannot produce an
 * unbounded stream.
 */
async function auditNonCompliantResources(
  client: PolicyInsightsClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // listQueryResultsForSubscription returns a PagedAsyncIterableIterator that
  // transparently follows @odata.nextLink across pages.
  const states: AsyncIterable<PolicyState> =
    client.policyStates.listQueryResultsForSubscription(
      POLICY_STATES_LATEST,
      subscriptionId,
    );
  for await (const state of states) {
    if (findings.length >= MAX_RESOURCE_FINDINGS) break;

    const compliance = (state.complianceState ?? "").trim().toLowerCase();
    if (compliance !== COMPLIANCE_STATE_NON_COMPLIANT) continue;

    const resourceId = state.resourceId;
    // A policy-state record without a resourceId cannot be attributed to a real
    // resource, so it is not a reportable per-resource finding.
    if (!resourceId) continue;

    const assignmentName =
      state.policyAssignmentName ??
      (state.policyAssignmentId
        ? (state.policyAssignmentId.split("/").filter(Boolean).pop() ??
          state.policyAssignmentId)
        : "unknown");
    const definitionName =
      state.policyDefinitionName ??
      state.policyDefinitionAction ??
      "policy definition";
    const resourceType = state.resourceType ?? "resource";

    findings.push({
      title: `Resource is non-compliant with Azure Policy "${assignmentName}"`,
      description: `Resource ${resourceId} (type ${resourceType}) is in compliance state "${
        state.complianceState ?? "NonCompliant"
      }" for the policy assignment "${assignmentName}"${
        state.policyAssignmentId ? ` (${state.policyAssignmentId})` : ""
      } via policy definition "${definitionName}"${
        state.policyDefinitionAction
          ? ` (effect: ${state.policyDefinitionAction})`
          : ""
      }. Remediate the resource to satisfy the policy, or update the assignment if the policy no longer reflects the intended control.`,
      severity: "medium",
      category: "config",
      resourceType: RESOURCE_TYPE_ASSIGNMENT,
      resourceId,
      resourceRegion: state.resourceLocation ?? SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_policy_resource_non_compliant"),
      source: SOURCE,
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): runs all Azure Policy checks (per-assignment
 * compliance summary + per-resource non-compliance) and returns the findings.
 * Mirrors the other azure/* auditors' `auditAzure<Service>(creds)` shape so
 * callers/tests can drive it directly with mocked credentials.
 */
export async function auditAzurePolicy(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makePolicyInsightsClient(creds);
  const findings: AgentFindingPayload[] = [];

  findings.push(
    ...(await auditPolicyAssignments(client, creds.subscriptionId)),
  );
  findings.push(
    ...(await auditNonCompliantResources(client, creds.subscriptionId)),
  );

  return findings;
}

/**
 * Azure Policy Auditor Agent.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry
 * still does `new AzurePolicyAuditorAgent()` then run/testConnection).
 * Internally it now resolves real Azure credentials, enumerates real Azure
 * Policy assignment compliance state and non-compliant resources via
 * @azure/arm-policyinsights, and streams real findings through the agent context.
 */
export class AzurePolicyAuditorAgent extends BaseAgent {
  readonly type = "azure-policy-auditor";
  readonly displayName = "Azure Policy Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveAzureCredentials(ctx.credentialRef);
      const findings = await auditAzurePolicy(creds);

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
  // credentials and issuing a lightweight summarizeForSubscription call, rather
  // than returning a hardcoded true. A subscription with no policy assignments
  // is still a successful connection; only a credential-resolution /
  // authorization / API failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = makePolicyInsightsClient(creds);
      await client.policyStates.summarizeForSubscription(
        POLICY_STATES_LATEST,
        creds.subscriptionId,
      );
      return true;
    } catch {
      return false;
    }
  }
}
