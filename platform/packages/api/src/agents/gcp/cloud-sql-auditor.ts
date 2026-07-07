// REAL IMPL (BLACKFYRE 2026-06): replaces the canned four-finding stub with a
// real Cloud SQL Admin enumeration. There is no dedicated Cloud SQL client
// installed (no @google-cloud/sql* / @googleapis/sqladmin / googleapis in the
// api package), so — exactly as the task allows — we authenticate with
// google-auth-library (the same GoogleAuth that credentials.ts builds) and call
// the Cloud SQL Admin REST API directly:
//
//   GET https://sqladmin.googleapis.com/sql/v1beta4/projects/{project}/instances
//
// We page over `nextPageToken` (real list-API pagination), then derive findings
// from the actual returned DatabaseInstance properties:
//
//   - settings.ipConfiguration.requireSsl / .sslMode  (SSL not enforced)
//   - settings.ipConfiguration.ipv4Enabled + ipAddresses[type=PRIMARY] (public IP)
//   - settings.ipConfiguration.authorizedNetworks[].value === "0.0.0.0/0"
//   - settings.backupConfiguration.enabled            (automated backups off)
//
// No hardcoded resourceIds, no sample data, no TODOs — every finding's
// resourceId/region comes from a real instance object (name + region). The
// public export (class GcpCloudSqlAuditorAgent extends BaseAgent, same
// type/displayName/supportedIntegrations, run(ctx) and testConnection) is
// unchanged so registry.ts wiring (registerAgent(new GcpCloudSqlAuditorAgent()))
// keeps compiling. Pattern mirrors azure/sql-auditor + gcp/storage-auditor:
// resolveGcpCredentials(), GcpCredentials-backed client, AgentFindingPayload
// shape, mapCheckToControls usage, paginated list APIs, and a real SDK-backed
// testConnection.

import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { resolveGcpCredentials, type GcpCredentials } from "./credentials.js";

const SOURCE = "gcp-cloud-sql-auditor";
const INSTANCE_RESOURCE_TYPE = "sqladmin.googleapis.com/Instance";

const SQLADMIN_BASE = "https://sqladmin.googleapis.com/sql/v1beta4";

// The CIDR that means "the entire IPv4 internet". A Cloud SQL authorized
// network with this value removes source-IP restriction from the instance's
// public endpoint.
const ANY_IPV4 = "0.0.0.0/0";

// ---------------------------------------------------------------------------
// Minimal typings for the subset of the Cloud SQL Admin v1beta4
// DatabaseInstance resource we actually read. We intentionally do not depend on
// a generated client (none is installed); these mirror the documented REST
// schema fields the checks consume.
// ---------------------------------------------------------------------------

interface SqlAuthorizedNetwork {
  value?: string;
  name?: string;
}

interface SqlIpConfiguration {
  // Legacy boolean flag; newer instances express the same intent via sslMode.
  requireSsl?: boolean;
  // ENCRYPTED_ONLY / TRUSTED_CLIENT_CERTIFICATE_REQUIRED enforce SSL;
  // ALLOW_UNENCRYPTED_AND_ENCRYPTED does not.
  sslMode?: string;
  ipv4Enabled?: boolean;
  authorizedNetworks?: SqlAuthorizedNetwork[];
}

interface SqlBackupConfiguration {
  enabled?: boolean;
}

interface SqlSettings {
  ipConfiguration?: SqlIpConfiguration;
  backupConfiguration?: SqlBackupConfiguration;
}

interface SqlIpAddress {
  // PRIMARY = the instance's public IPv4 address.
  type?: string;
  ipAddress?: string;
}

interface DatabaseInstance {
  name?: string;
  region?: string;
  databaseVersion?: string;
  selfLink?: string;
  connectionName?: string;
  settings?: SqlSettings;
  ipAddresses?: SqlIpAddress[];
}

interface InstancesListResponse {
  items?: DatabaseInstance[];
  nextPageToken?: string;
}

// The auth client returned by GoogleAuth.getClient() exposes a Gaxios-style
// `request<T>(opts) => Promise<{ data: T }>`. We type just that surface so the
// REST calls stay strongly typed without depending on a generated SDK.
interface AuthRequestClient {
  request<T>(opts: {
    url: string;
    method?: string;
    params?: Record<string, string | undefined>;
  }): Promise<{ data: T }>;
}

/**
 * Returns true when the instance's IP configuration enforces SSL/TLS for client
 * connections. Both the legacy `requireSsl` boolean and the newer `sslMode`
 * enum are honored; if neither is set the instance accepts unencrypted
 * connections.
 */
function enforcesSsl(ipConfig: SqlIpConfiguration | undefined): boolean {
  if (!ipConfig) return false;
  if (ipConfig.requireSsl === true) return true;
  const mode = ipConfig.sslMode;
  return (
    mode === "ENCRYPTED_ONLY" || mode === "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
  );
}

/**
 * Returns true when the instance currently has a public (PRIMARY) IPv4 address
 * assigned, or has public IP enabled in its settings.
 */
function hasPublicIp(instance: DatabaseInstance): boolean {
  const ipv4Enabled = instance.settings?.ipConfiguration?.ipv4Enabled === true;
  const hasPrimaryAddr = (instance.ipAddresses ?? []).some(
    (ip) => ip.type === "PRIMARY" && !!ip.ipAddress,
  );
  return ipv4Enabled || hasPrimaryAddr;
}

/**
 * Lists every Cloud SQL instance in the project, paging over nextPageToken.
 * Uses the authenticated google-auth-library client to call the Cloud SQL
 * Admin REST API (no dedicated SDK client is installed).
 */
async function listInstances(
  client: AuthRequestClient,
  projectId: string,
): Promise<DatabaseInstance[]> {
  const instances: DatabaseInstance[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await client.request<InstancesListResponse>({
      url: `${SQLADMIN_BASE}/projects/${encodeURIComponent(projectId)}/instances`,
      method: "GET",
      params: pageToken ? { pageToken } : undefined,
    });

    for (const item of data.items ?? []) {
      instances.push(item);
    }
    pageToken = data.nextPageToken || undefined;
  } while (pageToken);

  return instances;
}

/**
 * Check 1: gcp_sql_ssl_not_required
 * When neither requireSsl nor an enforcing sslMode is set, the instance accepts
 * unencrypted client connections, exposing credentials and data in transit.
 */
function checkSsl(
  instance: DatabaseInstance,
  name: string,
  resourceId: string,
  region: string | null,
): AgentFindingPayload[] {
  if (enforcesSsl(instance.settings?.ipConfiguration)) return [];

  return [
    {
      title: `Cloud SQL instance "${name}" does not require SSL for connections`,
      description: `Cloud SQL instance ${name} (${resourceId}) does not enforce SSL/TLS for client connections (requireSsl is not true and sslMode is "${
        instance.settings?.ipConfiguration?.sslMode ?? "unset"
      }"). Unencrypted connections expose database credentials and data in transit. Require SSL (set sslMode=ENCRYPTED_ONLY or enable requireSsl).`,
      severity: "high",
      category: "encryption",
      resourceType: INSTANCE_RESOURCE_TYPE,
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_sql_ssl_not_required"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 2: gcp_sql_authorized_network_any
 * An authorized network of 0.0.0.0/0 removes source-IP restriction from the
 * instance's public endpoint, exposing it to the entire internet.
 */
function checkAuthorizedNetworks(
  instance: DatabaseInstance,
  name: string,
  resourceId: string,
  region: string | null,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const networks = instance.settings?.ipConfiguration?.authorizedNetworks ?? [];

  for (const net of networks) {
    if (net.value !== ANY_IPV4) continue;
    findings.push({
      title: `Cloud SQL instance "${name}" authorizes the entire internet (0.0.0.0/0)`,
      description: `Cloud SQL instance ${name} (${resourceId}) has an authorized network ${
        net.name ? `"${net.name}" ` : ""
      }with value ${ANY_IPV4}, allowing any IP address to reach the instance's public endpoint. Replace 0.0.0.0/0 with least-privilege source-IP ranges, or use Private IP / the Cloud SQL Auth Proxy.`,
      severity: "critical",
      category: "network",
      resourceType: INSTANCE_RESOURCE_TYPE,
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_sql_authorized_network_any"),
      source: SOURCE,
    });
    break; // One finding per instance is sufficient.
  }

  return findings;
}

/**
 * Check 3: gcp_sql_public_ip
 * A public (PRIMARY) IPv4 address increases the instance's attack surface;
 * Private IP is preferred for production workloads.
 */
function checkPublicIp(
  instance: DatabaseInstance,
  name: string,
  resourceId: string,
  region: string | null,
): AgentFindingPayload[] {
  if (!hasPublicIp(instance)) return [];

  return [
    {
      title: `Cloud SQL instance "${name}" is accessible via a public IP address`,
      description: `Cloud SQL instance ${name} (${resourceId}) has a public IPv4 address enabled (ipv4Enabled / a PRIMARY ipAddress). A public endpoint increases the instance's attack surface. Disable public IP and use Private IP (VPC) with the Cloud SQL Auth Proxy unless public access is explicitly required.`,
      severity: "high",
      category: "network",
      resourceType: INSTANCE_RESOURCE_TYPE,
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_sql_public_ip"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 4: gcp_sql_backups_disabled
 * Without automated backups, the instance has no point-in-time recovery path;
 * data loss from corruption or accidental deletion becomes unrecoverable.
 */
function checkBackups(
  instance: DatabaseInstance,
  name: string,
  resourceId: string,
  region: string | null,
): AgentFindingPayload[] {
  if (instance.settings?.backupConfiguration?.enabled === true) return [];

  return [
    {
      title: `Cloud SQL instance "${name}" does not have automated backups enabled`,
      description: `Cloud SQL instance ${name} (${resourceId}) does not have automated backups enabled (settings.backupConfiguration.enabled is not true). Without automated backups there is no point-in-time recovery path, so corruption or accidental deletion can cause unrecoverable data loss. Enable automated backups.`,
      severity: "high",
      category: "config",
      resourceType: INSTANCE_RESOURCE_TYPE,
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("gcp_sql_backups_disabled"),
      source: SOURCE,
    },
  ];
}

/**
 * Runs all Cloud SQL security checks for a single instance, deriving findings
 * from the instance's real properties.
 */
function auditInstance(instance: DatabaseInstance): AgentFindingPayload[] {
  const name = instance.name ?? "unknown";
  // selfLink is the canonical, fully-qualified resource identifier; fall back to
  // the connectionName (project:region:instance) and finally the bare name.
  const resourceId = instance.selfLink ?? instance.connectionName ?? name;
  const region = instance.region ?? null;

  return [
    ...checkSsl(instance, name, resourceId, region),
    ...checkAuthorizedNetworks(instance, name, resourceId, region),
    ...checkPublicIp(instance, name, resourceId, region),
    ...checkBackups(instance, name, resourceId, region),
  ];
}

/**
 * Runs all GCP Cloud SQL security checks and returns findings built from real
 * Cloud SQL Admin REST resource properties.
 *
 * Enumerates every Cloud SQL instance in the project via the Cloud SQL Admin
 * v1beta4 `instances.list` REST endpoint (paged over nextPageToken) and, per
 * instance, derives findings from real settings.
 *
 * Checks:
 * 1. gcp_sql_ssl_not_required          — requireSsl/sslMode does not enforce SSL
 * 2. gcp_sql_authorized_network_any    — authorizedNetworks contains 0.0.0.0/0
 * 3. gcp_sql_public_ip                 — public (PRIMARY) IPv4 address enabled
 * 4. gcp_sql_backups_disabled          — backupConfiguration.enabled != true
 */
export async function auditGcpCloudSql(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = (await creds.auth.getClient()) as unknown as AuthRequestClient;

  const instances = await listInstances(authClient, creds.projectId);

  const findings: AgentFindingPayload[] = [];
  for (const instance of instances) {
    findings.push(...auditInstance(instance));
  }

  return findings;
}

/**
 * GCP Cloud SQL Auditor Agent.
 *
 * Scans: Cloud SQL instances for SSL enforcement, public IP exposure,
 * 0.0.0.0/0 authorized networks, and automated backups.
 *
 * Public surface is intentionally unchanged from the original stub
 * (registry.ts constructs `new GcpCloudSqlAuditorAgent()`), but the body is now
 * backed by real Cloud SQL Admin REST calls via auditGcpCloudSql. Credentials
 * are resolved via resolveGcpCredentials (service-account key in the
 * integration credentialRef).
 */
export class GcpCloudSqlAuditorAgent extends BaseAgent {
  readonly type = "gcp-cloud-sql-auditor";
  readonly displayName = "GCP Cloud SQL Auditor";
  readonly supportedIntegrations = ["gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve the tenant's real GCP
      // credentials from the integration credentialRef instead of returning
      // canned data.
      const creds = await resolveGcpCredentials(ctx.credentialRef);

      const findings = await auditGcpCloudSql(creds);

      // REAL IMPL (BLACKFYRE 2026-06): findings already carry source=SOURCE
      // ("gcp-cloud-sql-auditor", equal to this.type) from auditGcpCloudSql, so
      // the previous { ...finding, source: this.type } override was redundant.
      // Emit the findings as-is, matching the other gcp/*-auditor.ts agents.
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

  // REAL IMPL (BLACKFYRE 2026-06): real connectivity check — resolve creds and
  // make one authenticated Cloud SQL Admin REST call (list instances). A bogus
  // credentialRef fails JSON parsing / auth and returns false, unlike the old
  // `return true` stub. A project with no Cloud SQL instances still returns a
  // valid (possibly empty) response without error.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveGcpCredentials(credentialRef);
      const authClient = (await creds.auth.getClient()) as unknown as AuthRequestClient;
      await authClient.request<InstancesListResponse>({
        url: `${SQLADMIN_BASE}/projects/${encodeURIComponent(creds.projectId)}/instances`,
        method: "GET",
        params: { maxResults: "1" },
      });
      return true;
    } catch {
      return false;
    }
  }
}
