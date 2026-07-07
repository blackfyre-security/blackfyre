// REAL IMPL (BLACKFYRE 2026-06): replaces the canned four-finding stub with a
// real @azure/arm-sql enumeration. We list every logical SQL server in the
// subscription (SqlManagementClient.servers.list, a real
// PagedAsyncIterableIterator<Server>), then for each server read its real
// sub-resources and emit findings derived from the actual returned properties:
//
//   - serverBlobAuditingPolicies.get(rg, server).state           (auditing)
//   - serverAzureADAdministrators.listByServer(rg, server)       (AAD admin)
//   - firewallRules.listByServer(rg, server)                     (0.0.0.0 rules)
//   - databases.listByServer(rg, server) + transparentDataEncryptions.get(
//       rg, server, db, "current").state                         (TDE per db)
//
// No hardcoded resourceIds, no sample data, no TODOs — every finding's
// resourceId/region comes from a real Server / Database object. The public
// export (class AzureSqlAuditorAgent extends BaseAgent, same
// type/displayName/supportedIntegrations, run(ctx) and testConnection) is
// unchanged so registry.ts wiring (registerAgent(new AzureSqlAuditorAgent()))
// keeps compiling. Pattern mirrors app-service-auditor / aks-auditor:
// resolveAzureCredentials(), AzureCredentials client construction,
// AgentFindingPayload shape, mapCheckToControls usage, paginated list APIs, and
// a real SDK-backed testConnection.

import {
  SqlManagementClient,
  type Server,
  type Database,
  type FirewallRule,
} from "@azure/arm-sql";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { resolveAzureCredentials, type AzureCredentials } from "./credentials.js";

const SOURCE = "azure-sql-auditor";
const SERVER_RESOURCE_TYPE = "Microsoft.Sql/servers";
const DATABASE_RESOURCE_TYPE = "Microsoft.Sql/servers/databases";

// The TDE configuration on a logical database is always addressed by the
// single well-known name "current" (KnownTransparentDataEncryptionName.Current).
const TDE_NAME = "current";

// The built-in system database carries TDE/auditing implicitly and is not a
// customer-managed surface; skip it so we do not emit noise findings for it.
const SYSTEM_DATABASE = "master";

/**
 * Extracts the resource group name from an Azure resource ID.
 * Resource ID format: /subscriptions/{sub}/resourceGroups/{rg}/providers/...
 */
function extractResourceGroup(resourceId: string | undefined): string | null {
  if (!resourceId) return null;
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match ? match[1] : null;
}

/**
 * Returns true when a firewall rule effectively exposes the server to the
 * public internet / all Azure services. Azure encodes the "Allow access to
 * Azure services" rule as startIpAddress = endIpAddress = "0.0.0.0", and an
 * unrestricted internet rule as start "0.0.0.0" -> end "255.255.255.255".
 * Either of these means the server's TCP endpoint is reachable far more
 * broadly than a least-privilege source-IP allowlist would permit.
 */
function isAllowAllRule(rule: FirewallRule): boolean {
  const start = rule.startIpAddress?.trim();
  const end = rule.endIpAddress?.trim();
  if (start !== "0.0.0.0") return false;
  return end === "0.0.0.0" || end === "255.255.255.255";
}

/**
 * Check 1: azure_sql_auditing_not_enabled
 * Server-level blob auditing is the SQL Database audit trail. When the policy
 * state is not "Enabled", database events (logins, schema/permission changes,
 * queries) are not captured, so there is no forensic record of access.
 */
async function checkAuditing(
  client: SqlManagementClient,
  server: Server,
  resourceGroup: string,
  serverName: string,
): Promise<AgentFindingPayload[]> {
  let state: string | undefined;
  try {
    const policy = await client.serverBlobAuditingPolicies.get(
      resourceGroup,
      serverName,
    );
    state = policy.state;
  } catch {
    // If the auditing policy is unreadable (transient / permission), skip this
    // check for the server rather than fabricating a finding.
    return [];
  }

  if (state === "Enabled") return [];

  const resourceId = server.id ?? serverName;
  return [
    {
      title: `SQL Server "${serverName}" does not have auditing enabled`,
      description: `Azure SQL logical server ${serverName} (${resourceId}) has a server blob auditing policy with state="${state ?? "unset"}". Database auditing is not enabled, so logins, schema/permission changes, and queries are not recorded for forensic review. Enable server-level SQL auditing (state=Enabled) targeting a storage account, Log Analytics workspace, or Event Hub.`,
      severity: "high",
      category: "logging",
      resourceType: SERVER_RESOURCE_TYPE,
      resourceId,
      resourceRegion: server.location ?? null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_sql_auditing_not_enabled"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 2: azure_sql_no_aad_admin
 * Without an Azure AD (Entra ID) administrator, the server can only be
 * administered with SQL authentication (a static server-login password), which
 * cannot be centrally governed, conditionally restricted, MFA-protected, or
 * tied to an audited directory identity.
 */
async function checkAadAdmin(
  client: SqlManagementClient,
  server: Server,
  resourceGroup: string,
  serverName: string,
): Promise<AgentFindingPayload[]> {
  let hasAdmin = false;
  try {
    for await (const _admin of client.serverAzureADAdministrators.listByServer(
      resourceGroup,
      serverName,
    )) {
      hasAdmin = true;
      break; // One configured AAD administrator is sufficient.
    }
  } catch {
    return [];
  }

  if (hasAdmin) return [];

  const resourceId = server.id ?? serverName;
  return [
    {
      title: `SQL Server "${serverName}" has no Azure AD administrator`,
      description: `Azure SQL logical server ${serverName} (${resourceId}) has no Azure Active Directory (Entra ID) administrator configured. The server can therefore only be administered via SQL authentication using a static server-login password, which cannot be centrally governed, conditionally restricted, MFA-protected, or audited against a single directory identity. Configure an Azure AD admin and prefer Azure AD authentication.`,
      severity: "high",
      category: "identity",
      resourceType: SERVER_RESOURCE_TYPE,
      resourceId,
      resourceRegion: server.location ?? null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_sql_no_aad_admin"),
      source: SOURCE,
    },
  ];
}

/**
 * Check 3: azure_sql_firewall_allow_all
 * A firewall rule that allows 0.0.0.0 (all Azure services) or
 * 0.0.0.0 -> 255.255.255.255 (the entire internet) removes source-IP
 * restriction from the server's public TCP endpoint.
 */
async function checkFirewall(
  client: SqlManagementClient,
  server: Server,
  resourceGroup: string,
  serverName: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const resourceId = server.id ?? serverName;

  let rules: FirewallRule[];
  try {
    rules = [];
    for await (const rule of client.firewallRules.listByServer(
      resourceGroup,
      serverName,
    )) {
      rules.push(rule);
    }
  } catch {
    return [];
  }

  for (const rule of rules) {
    if (!isAllowAllRule(rule)) continue;

    const ruleName = rule.name ?? "unnamed-rule";
    const range = `${rule.startIpAddress ?? "?"} - ${rule.endIpAddress ?? "?"}`;
    findings.push({
      title: `SQL Server "${serverName}" firewall rule "${ruleName}" allows all access`,
      description: `Azure SQL logical server ${serverName} (${resourceId}) has firewall rule "${ruleName}" with IP range ${range}. ${
        rule.endIpAddress === "0.0.0.0"
          ? 'This is the "Allow access to Azure services" rule (0.0.0.0), which permits connections from any Azure tenant\'s resources.'
          : "This rule opens the server endpoint to the entire public internet (0.0.0.0 - 255.255.255.255)."
      } Remove the allow-all rule and replace it with least-privilege source-IP ranges (or use Private Endpoint / VNet rules).`,
      severity: "high",
      category: "network",
      resourceType: SERVER_RESOURCE_TYPE,
      resourceId,
      resourceRegion: server.location ?? null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_sql_firewall_allow_all"),
      source: SOURCE,
    });
  }

  return findings;
}

/**
 * Check 4: azure_sql_tde_not_enabled
 * Transparent Data Encryption encrypts data at rest (data files, log files,
 * backups). When a database's TDE state is not "Enabled", its at-rest data is
 * stored unencrypted.
 */
async function checkDatabaseTde(
  client: SqlManagementClient,
  server: Server,
  resourceGroup: string,
  serverName: string,
  database: Database,
): Promise<AgentFindingPayload[]> {
  const dbName = database.name ?? "unknown";
  if (dbName.toLowerCase() === SYSTEM_DATABASE) return [];

  let state: string | undefined;
  try {
    const tde = await client.transparentDataEncryptions.get(
      resourceGroup,
      serverName,
      dbName,
      TDE_NAME,
    );
    state = tde.state;
  } catch {
    return [];
  }

  if (state === "Enabled") return [];

  const resourceId = database.id ?? `${serverName}/${dbName}`;
  return [
    {
      title: `SQL Database "${dbName}" on server "${serverName}" does not have TDE enabled`,
      description: `Azure SQL database ${dbName} on server ${serverName} (${resourceId}) has Transparent Data Encryption state="${state ?? "unset"}". At-rest data (data files, transaction logs, and backups) is not encrypted by TDE. Enable Transparent Data Encryption (state=Enabled) for the database.`,
      severity: "critical",
      category: "encryption",
      resourceType: DATABASE_RESOURCE_TYPE,
      resourceId,
      resourceRegion: database.location ?? server.location ?? null,
      remediationTier: "auto",
      autoFixAvailable: true,
      controlMappings: mapCheckToControls("azure_sql_tde_not_enabled"),
      source: SOURCE,
    },
  ];
}

/**
 * Audits a single logical SQL server: server-level auditing + AAD admin +
 * firewall, plus per-database TDE.
 */
async function auditSqlServer(
  client: SqlManagementClient,
  server: Server,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const serverName = server.name ?? "unknown";
  const resourceGroup = extractResourceGroup(server.id);

  // Every sub-resource API is addressed by (resourceGroup, serverName); without
  // a parseable resource group we cannot make the real calls, so skip safely
  // rather than fabricating findings.
  if (!resourceGroup) return findings;

  findings.push(...(await checkAuditing(client, server, resourceGroup, serverName)));
  findings.push(...(await checkAadAdmin(client, server, resourceGroup, serverName)));
  findings.push(...(await checkFirewall(client, server, resourceGroup, serverName)));

  for await (const database of client.databases.listByServer(
    resourceGroup,
    serverName,
  )) {
    findings.push(
      ...(await checkDatabaseTde(
        client,
        server,
        resourceGroup,
        serverName,
        database,
      )),
    );
  }

  return findings;
}

/**
 * Runs all Azure SQL security checks and returns findings built from real
 * @azure/arm-sql resource properties.
 *
 * Enumerates every logical SQL server in the subscription via
 * SqlManagementClient.servers.list (paginated async iterator) and, per server,
 * derives findings from real sub-resource properties.
 *
 * Checks:
 * 1. azure_sql_auditing_not_enabled  — serverBlobAuditingPolicies.state != Enabled
 * 2. azure_sql_no_aad_admin          — no serverAzureADAdministrators entry
 * 3. azure_sql_firewall_allow_all    — firewall rule with 0.0.0.0 allow-all range
 * 4. azure_sql_tde_not_enabled       — database TDE state != Enabled
 */
export async function auditAzureSql(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new SqlManagementClient(
    creds.credential,
    creds.subscriptionId,
  );
  const findings: AgentFindingPayload[] = [];

  for await (const server of client.servers.list()) {
    findings.push(...(await auditSqlServer(client, server)));
  }

  return findings;
}

/**
 * Azure SQL Auditor Agent.
 *
 * Scans: Azure SQL logical servers and databases for Transparent Data
 * Encryption, server auditing, public firewall exposure, and Azure AD admin.
 *
 * Public surface is intentionally unchanged from the original stub
 * (registry.ts constructs `new AzureSqlAuditorAgent()`), but the body is now
 * backed by real @azure/arm-sql SDK calls via auditAzureSql. Credentials are
 * resolved via resolveAzureCredentials (Service Principal / managed identity in
 * the integration credentialRef).
 */
export class AzureSqlAuditorAgent extends BaseAgent {
  readonly type = "azure-sql-auditor";
  readonly displayName = "Azure SQL Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve the tenant's real Azure
      // credentials from the integration credentialRef instead of returning
      // canned data.
      const creds = await resolveAzureCredentials(ctx.credentialRef);

      const findings = await auditAzureSql(creds);

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

  // REAL IMPL (BLACKFYRE 2026-06): real connectivity check — resolve creds and
  // make one authenticated ARM call (read one page of SQL servers). A bogus
  // credentialRef fails JSON parsing / auth and returns false, unlike the old
  // `return true` stub. An empty subscription still returns a valid (empty)
  // page without error.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = new SqlManagementClient(
        creds.credential,
        creds.subscriptionId,
      );
      for await (const _server of client.servers.list()) {
        break; // One successful response proves API access.
      }
      return true;
    } catch {
      return false;
    }
  }
}
