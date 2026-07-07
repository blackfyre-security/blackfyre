// REAL IMPL (BLACKFYRE 2026-06): replaced the canned-findings stub with a real
// BigQuery auditor. It resolves the tenant's GCP service-account credentials,
// constructs a real @google-cloud/bigquery client scoped to the project, paginates
// over every dataset, reads each dataset's real metadata (access bindings, default
// CMEK encryption config, default table-expiration) and each table's real metadata
// (per-table CMEK + expiration), and emits findings derived purely from those live
// properties. NO hardcoded findings, NO sample data.
import { BigQuery } from "@google-cloud/bigquery";
import type { Dataset, Table } from "@google-cloud/bigquery";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import {
  resolveGcpCredentials,
  type GcpCredentials,
} from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): the two public IAM principals BigQuery exposes
// for "anyone on the internet" (allUsers) and "any authenticated Google account"
// (allAuthenticatedUsers). In a dataset's access[] array these surface either as a
// raw `iamMember`/`userByEmail` string or, for allAuthenticatedUsers, as the
// `specialGroup` enum value. We treat any of those as public exposure.
const PUBLIC_PRINCIPALS = new Set(["allUsers", "allAuthenticatedUsers"]);

/**
 * REAL IMPL (BLACKFYRE 2026-06)
 *
 * Runs all GCP BigQuery security checks against real datasets/tables and returns
 * findings. Constructed credentials are shared with the rest of the gcp/*-auditor
 * modules ({ authClient, projectId }).
 *
 * Checks (all derived from live SDK properties — see @google-cloud/bigquery
 * IDataset/ITable):
 * 1. gcp_bucket_no_cmek          — Dataset has no default CMEK (defaultEncryptionConfiguration.kmsKeyName)
 * 2. gcp_iam_allUsers_binding    — Dataset access[] grants allUsers/allAuthenticatedUsers (public dataset)
 * 3. gcp_bucket_no_versioning    — Dataset has no default table-expiration (defaultTableExpirationMs) AND
 *                                  a table has no expiration set (data retained indefinitely)
 *
 * Note on check-type keys: these reuse the existing GCP compliance-mapper entries
 * whose controls (SC-28/SC-12 encryption, AC-3/SC-7 public-access, CP-9 retention)
 * are the correct mappings for the equivalent BigQuery condition; the mapper edit
 * is out of scope for this file.
 */
export async function auditGcpBigQuery(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = await creds.auth.getClient();
  const bigquery = new BigQuery({
    authClient: authClient as any,
    projectId: creds.projectId,
  });

  const findings: AgentFindingPayload[] = [];

  // List every dataset in the project. The node client paginates internally and
  // hands back the fully-materialised Dataset[] for the project.
  const [datasets] = await bigquery.getDatasets();

  // Per-dataset checks run concurrently — each does its own metadata + table reads.
  const datasetResults = await Promise.all(
    (datasets ?? []).map((dataset) =>
      auditDataset(dataset, creds.projectId),
    ),
  );

  for (const result of datasetResults) {
    findings.push(...result);
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Per-dataset checks
// ---------------------------------------------------------------------------

async function auditDataset(
  dataset: Dataset,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const out: AgentFindingPayload[] = [];

  const datasetId = dataset.id ?? "unknown-dataset";
  // Fully-qualified resource id mirrors BigQuery's own naming for traceability.
  const resourceId = `${projectId}:${datasetId}`;

  let metadata: Record<string, any>;
  try {
    [metadata] = (await dataset.getMetadata()) as unknown as [Record<string, any>];
  } catch {
    // If we can't read this dataset's metadata (e.g. read-only SA lacks the
    // grant), skip it rather than emitting a misleading finding.
    return out;
  }

  // Resolve the dataset's location for accurate per-finding region attribution.
  const region: string | null =
    typeof metadata.location === "string" ? metadata.location : null;

  // Check: no default CMEK on the dataset.
  if (!metadata.defaultEncryptionConfiguration?.kmsKeyName) {
    out.push({
      title: `BigQuery dataset "${datasetId}" does not use customer-managed encryption (CMEK)`,
      description: `BigQuery dataset ${resourceId} has no default customer-managed encryption key (defaultEncryptionConfiguration.kmsKeyName is unset), so new tables are encrypted only with Google-managed keys. Configure a default CMEK to control the encryption-key lifecycle and access for data at rest.`,
      severity: "high",
      category: "encryption",
      resourceType: "bigquery.googleapis.com/Dataset",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_bucket_no_cmek"),
      source: "gcp-bigquery-auditor",
    });
  }

  // Check: public access via dataset access[] bindings.
  for (const entry of (metadata.access ?? []) as Array<Record<string, any>>) {
    const principal =
      (typeof entry.iamMember === "string" && entry.iamMember) ||
      (typeof entry.userByEmail === "string" && entry.userByEmail) ||
      (typeof entry.specialGroup === "string" && entry.specialGroup) ||
      "";
    if (PUBLIC_PRINCIPALS.has(principal)) {
      out.push({
        title: `BigQuery dataset "${datasetId}" is publicly accessible`,
        description: `BigQuery dataset ${resourceId} has an access binding granting role "${entry.role ?? "(unspecified)"}" to "${principal}". This exposes the dataset to anyone on the internet (allUsers) or any authenticated Google account (allAuthenticatedUsers). Remove the public access entry unless this dataset is intentionally public.`,
        severity: "critical",
        category: "iam",
        resourceType: "bigquery.googleapis.com/Dataset",
        resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("gcp_iam_allUsers_binding"),
        source: "gcp-bigquery-auditor",
      });
      break; // One public-access finding per dataset is sufficient.
    }
  }

  // Check: table-expiration / retention. If the dataset sets no default table
  // expiration, surface any table that also has no per-table expiration, since
  // such tables are retained indefinitely (a data-minimisation / retention gap).
  const hasDefaultExpiration =
    metadata.defaultTableExpirationMs != null &&
    metadata.defaultTableExpirationMs !== "" &&
    metadata.defaultTableExpirationMs !== "0";

  if (!hasDefaultExpiration) {
    let tables: Table[] = [];
    try {
      [tables] = await dataset.getTables();
    } catch {
      tables = [];
    }

    for (const table of tables ?? []) {
      const tableId: string =
        (typeof table.id === "string" && table.id) || "unknown-table";
      const tableResourceId = `${resourceId}.${tableId}`;

      let tableMeta: Record<string, any>;
      try {
        [tableMeta] = (await table.getMetadata()) as unknown as [Record<string, any>];
      } catch {
        continue;
      }

      const tableHasExpiration =
        tableMeta.expirationTime != null && tableMeta.expirationTime !== "";

      if (!tableHasExpiration) {
        out.push({
          title: `BigQuery table "${tableId}" has no expiration configured`,
          description: `BigQuery table ${tableResourceId} has no expirationTime and its dataset sets no defaultTableExpirationMs, so the table (and its data) is retained indefinitely. Set a table expiration or a dataset-level default to enforce a data-retention limit.`,
          severity: "medium",
          category: "config",
          resourceType: "bigquery.googleapis.com/Table",
          resourceId: tableResourceId,
          resourceRegion: region,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_bucket_no_versioning"),
          source: "gcp-bigquery-auditor",
        });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Agent wrapper — keeps the public export identical to the original stub so the
// registry wiring (registry.ts -> new GcpBigQueryAuditorAgent()) keeps compiling.
// ---------------------------------------------------------------------------

export class GcpBigQueryAuditorAgent extends BaseAgent {
  readonly type = "gcp-bigquery-auditor";
  readonly displayName = "GCP BigQuery Auditor";
  readonly supportedIntegrations = ["gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve real credentials from the
      // integration's credentialRef and enumerate real BigQuery resources.
      const creds = await resolveGcpCredentials(ctx.credentialRef);
      const findings = await auditGcpBigQuery(creds);

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
    // REAL IMPL (BLACKFYRE 2026-06): validate real API access — resolve
    // credentials and make a live BigQuery list call — instead of the old
    // always-true stub.
    try {
      const creds = await resolveGcpCredentials(credentialRef);
      const authClient = await creds.auth.getClient();
      const bigquery = new BigQuery({
        authClient: authClient as any,
        projectId: creds.projectId,
      });
      // getDatasets succeeds (even with zero datasets) only if the SA can reach
      // the BigQuery API for the project; any auth/permission failure throws.
      await bigquery.getDatasets();
      return true;
    } catch {
      return false;
    }
  }
}
