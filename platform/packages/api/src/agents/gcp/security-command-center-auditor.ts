// REAL IMPL (BLACKFYRE 2026-06): GCP Security Command Center auditor no longer
// emits canned/sample findings. It enumerates ACTUAL SCC findings via the real
// Google Cloud SDK (@google-cloud/security-center SecurityCenterClient) using
// the tenant's resolved service-account credentials, and surfaces every ACTIVE,
// un-muted SCC finding as a Blackfyre compliance finding derived from real
// finding properties (state, severity, category, findingClass, resourceName,
// resource.location, externalUri, source/parentDisplayName). It also enumerates
// the project's real SCC sources (listSources) so each finding's originating
// detector can be named. resourceId/region come from the live finding
// (canonicalName/name + resource.location). The public export
// (class GcpSccAuditorAgent extends BaseAgent) is preserved so registry.ts
// wiring keeps compiling. Pattern mirrors the real GKE auditor (gke-auditor.ts)
// and the other GCP auditors: shared credential resolution, the same
// authClient/projectId client construction, AgentFindingPayload shape,
// mapCheckToControls usage, pagination over the list API
// (listFindingsAsync / listSourcesAsync), and a real SDK-backed testConnection
// (no string check).
import { SecurityCenterClient } from "@google-cloud/security-center";
import type { protos } from "@google-cloud/security-center";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveGcpCredentials, type GcpCredentials } from "./credentials.js";

const SOURCE = "gcp-scc-auditor";
const RESOURCE_TYPE = "securitycenter.googleapis.com/Finding";

type IFinding = protos.google.cloud.securitycenter.v1.IFinding;
type IListFindingsResult =
  protos.google.cloud.securitycenter.v1.ListFindingsResponse.IListFindingsResult;
type ISource = protos.google.cloud.securitycenter.v1.ISource;

/**
 * Builds the SecurityCenterClient bound to the tenant's service-account auth and
 * project. Mirrors how the other GCP auditors construct their SDK clients
 * (gke-auditor.ts `new ClusterManagerClient({ authClient, projectId })`) — the
 * google-gax ClientOptions accepts an explicit authClient + projectId.
 */
async function makeClient(
  creds: GcpCredentials,
): Promise<SecurityCenterClient> {
  const authClient = await creds.auth.getClient();
  return new SecurityCenterClient({
    authClient: authClient as never,
    projectId: creds.projectId,
  });
}

/**
 * SCC findings are enumerated under a parent of
 * `{organizations|folders|projects}/<id>/sources/-`. Blackfyre's tenant
 * credentials only resolve a projectId (credentials.ts), so we scope the scan to
 * the project's findings across all of its enabled SCC sources via the `-`
 * source wildcard. This is the project-level equivalent of the org-level SCC
 * console view and matches the surface a project-scoped service account can read.
 */
function findingsParent(projectId: string): string {
  return `projects/${projectId}/sources/-`;
}

/** The sources parent (project-scoped) used to name each finding's detector. */
function sourcesParent(projectId: string): string {
  return `projects/${projectId}/sources`;
}

/**
 * Normalises an SCC enum field (which the gax client may surface either as its
 * string name, e.g. "ACTIVE"/"CRITICAL", or as its numeric proto value) to its
 * canonical UPPERCASE string name.
 */
function enumName(
  value: unknown,
  numeric: Record<number, string>,
): string | null {
  if (typeof value === "string") return value.toUpperCase();
  if (typeof value === "number") return numeric[value] ?? null;
  return null;
}

// Numeric proto enum -> canonical name. Values mirror the SCC v1 protos
// (Finding.State / Finding.Severity / Finding.Mute) so a client surfacing enums
// as ints resolves identically to one surfacing them as strings.
const STATE_NAMES: Record<number, string> = {
  0: "STATE_UNSPECIFIED",
  1: "ACTIVE",
  2: "INACTIVE",
};

const SEVERITY_NAMES: Record<number, string> = {
  0: "SEVERITY_UNSPECIFIED",
  1: "CRITICAL",
  2: "HIGH",
  3: "MEDIUM",
  4: "LOW",
};

const MUTE_NAMES: Record<number, string> = {
  0: "MUTE_UNSPECIFIED",
  1: "MUTED",
  2: "UNMUTED",
  4: "UNDEFINED",
};

/**
 * Maps SCC's native severity scale onto Blackfyre's Severity. SCC findings whose
 * severity is unset/unspecified are treated as "medium" — they are still active,
 * actionable security findings, just without a graded severity from the detector.
 */
function mapSeverity(finding: IFinding): AgentFindingPayload["severity"] {
  const name = enumName(finding.severity, SEVERITY_NAMES);
  switch (name) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    default:
      return "medium";
  }
}

/**
 * A stable identifier for the finding, preferring SCC's canonicalName (a
 * fully-qualified, project-number-keyed resource path that is stable across
 * renames) and falling back to the finding's `name` resource path.
 */
function findingId(finding: IFinding): string {
  return finding.canonicalName ?? finding.name ?? "unknown";
}

/**
 * The finding's real region. SCC carries the affected resource's location on the
 * ListFindingsResult.resource envelope (resource.location); fall back to null
 * (many SCC findings are on global/org-scoped resources with no location).
 */
function findingRegion(result: IListFindingsResult): string | null {
  return result.resource?.location ?? null;
}

/**
 * Resolves a human-friendly detector name for the finding. SCC's
 * parentDisplayName (when present) already carries the source's display name;
 * otherwise look the source up in the enumerated sources map by its `name`
 * (findings live under `.../sources/<sourceId>/findings/<id>`, so the source
 * resource path is the finding `name` truncated at `/findings/`).
 */
function detectorName(
  finding: IFinding,
  sourcesByName: Map<string, ISource>,
): string {
  if (finding.parentDisplayName) return finding.parentDisplayName;
  const name = finding.name ?? "";
  const idx = name.indexOf("/findings/");
  if (idx > 0) {
    const sourcePath = name.slice(0, idx);
    const src = sourcesByName.get(sourcePath);
    if (src?.displayName) return src.displayName;
  }
  return "Security Command Center";
}

/**
 * Converts a single ACTIVE, un-muted SCC ListFindingsResult into a Blackfyre
 * AgentFindingPayload. Returns null when the finding is not active or is muted
 * (we only surface live, un-suppressed findings — the SCC console's default
 * "active" view), so the caller can skip it.
 *
 * Check: gcp_scc_active_finding — every active SCC detector finding is a
 * compliance-relevant security issue that SCC itself has surfaced.
 */
function toFinding(
  result: IListFindingsResult,
  sourcesByName: Map<string, ISource>,
): AgentFindingPayload | null {
  const finding = result.finding;
  if (!finding) return null;

  // Only surface ACTIVE findings (skip INACTIVE/resolved).
  const state = enumName(finding.state, STATE_NAMES);
  if (state !== "ACTIVE") return null;

  // Skip findings the customer has explicitly muted in SCC.
  const mute = enumName(finding.mute, MUTE_NAMES);
  if (mute === "MUTED") return null;

  const category = finding.category ?? "Uncategorized";
  const id = findingId(finding);
  const detector = detectorName(finding, sourcesByName);
  const affected = finding.resourceName ?? result.resource?.name ?? id;
  const findingClass = enumName(finding.findingClass, {}) ?? null;

  const descriptionParts: string[] = [
    `Security Command Center reported an active "${category}" finding from "${detector}".`,
    `Affected resource: ${affected}.`,
  ];
  if (finding.description) {
    descriptionParts.push(finding.description);
  }
  if (findingClass) {
    descriptionParts.push(`Finding class: ${findingClass}.`);
  }
  if (finding.nextSteps) {
    descriptionParts.push(`Recommended next steps: ${finding.nextSteps}`);
  }
  if (finding.externalUri) {
    descriptionParts.push(`Details: ${finding.externalUri}`);
  }

  return {
    title: `SCC active finding: ${category}`,
    description: descriptionParts.join(" "),
    severity: mapSeverity(finding),
    // Surface as a config-class finding (cloud posture/configuration issue);
    // matches the category SCC misconfiguration/observation findings represent
    // in Blackfyre's taxonomy.
    category: "config",
    resourceType: RESOURCE_TYPE,
    resourceId: id,
    resourceRegion: findingRegion(result),
    remediationTier: "manual",
    autoFixAvailable: false,
    controlMappings: mapCheckToControls("gcp_scc_active_finding"),
    source: SOURCE,
  };
}

/**
 * Enumerates the project's SCC sources (detectors) so findings can be attributed
 * to a human-readable detector name. Returns a map keyed by the source resource
 * path (`.../sources/<id>`). Paginated via listSourcesAsync.
 */
async function loadSources(
  client: SecurityCenterClient,
  projectId: string,
): Promise<Map<string, ISource>> {
  const byName = new Map<string, ISource>();
  const iterable = client.listSourcesAsync({
    parent: sourcesParent(projectId),
  });
  for await (const source of iterable) {
    if (source.name) byName.set(source.name, source);
  }
  return byName;
}

/**
 * Runs the GCP Security Command Center audit and returns findings.
 *
 * Enumerates every SCC finding for the project across all enabled sources via
 * SecurityCenterClient.listFindingsAsync (parent
 * `projects/<id>/sources/-`, the `-` source wildcard returns findings from every
 * detector in one paginated stream) and surfaces each ACTIVE, un-muted finding
 * as a Blackfyre finding derived from real finding properties.
 *
 * Check:
 *   gcp_scc_active_finding — finding.state === ACTIVE && finding.mute !== MUTED
 */
export async function auditGcpScc(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const client = await makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  // Enumerate sources first so each finding can name its detector.
  const sourcesByName = await loadSources(client, creds.projectId);

  // listFindingsAsync auto-paginates: the async iterable transparently fetches
  // subsequent pages via the underlying pageToken, so we iterate the full result
  // set without managing tokens by hand.
  const iterable = client.listFindingsAsync({
    parent: findingsParent(creds.projectId),
  });

  for await (const result of iterable) {
    const payload = toFinding(result, sourcesByName);
    if (payload) findings.push(payload);
  }

  return findings;
}

/**
 * GCP Security Command Center Auditor Agent
 *
 * Scans: Google Cloud Security Command Center for active, un-muted findings
 * surfaced by SCC's built-in and integrated detectors, mapping each to a
 * Blackfyre compliance finding.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry.ts
 * still does `new GcpSccAuditorAgent()` then run/testConnection). Internally it
 * now resolves real GCP service-account credentials, enumerates real SCC sources
 * and findings via @google-cloud/security-center, and streams real findings
 * through the agent context.
 */
export class GcpSccAuditorAgent extends BaseAgent {
  readonly type = "gcp-scc-auditor";
  readonly displayName = "GCP Security Command Center Auditor";
  readonly supportedIntegrations = ["gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveGcpCredentials(ctx.credentialRef);
      const findings = await auditGcpScc(creds);

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

  // REAL IMPL (BLACKFYRE 2026-06): testConnection now validates real SCC API
  // access (resolve creds -> listFindings) instead of returning a hardcoded
  // true. A project with no SCC findings is still a successful connection; only
  // a credential-resolution/authorization/API failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveGcpCredentials(credentialRef);
      const client = await makeClient(creds);
      // A single, page-bounded probe is enough to confirm read access without
      // streaming the whole result set.
      await client.listFindings({
        parent: findingsParent(creds.projectId),
        pageSize: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}
