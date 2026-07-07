// REAL IMPL (BLACKFYRE 2026-06): replaces the canned four-finding stub with a
// real @azure/arm-appservice enumeration. We list every Web App in the
// subscription (WebSiteManagementClient.webApps.list, a real
// PagedAsyncIterableIterator<Site>), read its per-app SiteConfigResource via
// webApps.getConfiguration(resourceGroup, name), and emit findings from the
// actual returned properties: httpsOnly, minTlsVersion (>= 1.2),
// identity.type (managed identity present), and config.remoteDebuggingEnabled.
// No hardcoded resourceIds, no sample data — resourceId/region come from each
// real Site. The public export (class AzureAppServiceAuditorAgent extends
// BaseAgent, same type/displayName/supportedIntegrations, run(ctx) and
// testConnection) is unchanged so registry.ts wiring keeps compiling.

import {
  WebSiteManagementClient,
  type Site,
  type SiteConfigResource,
} from "@azure/arm-appservice";
import { AuthorizationManagementClient } from "@azure/arm-authorization";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { resolveAzureCredentials, type AzureCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): single source-of-truth for the finding `source`
// tag, mirroring aks-auditor.ts. Set once here and applied to every finding;
// run() no longer re-overrides it on onFinding (it matched this.type anyway).
const SOURCE = "azure-app-service-auditor";
const RESOURCE_TYPE = "Microsoft.Web/sites";

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
 * Returns true when a managed identity is actually configured on the app.
 * ManagedServiceIdentity.type is one of "None" | "SystemAssigned" |
 * "UserAssigned" | "SystemAssigned, UserAssigned"; anything that is missing or
 * "None" means the app authenticates to Azure resources without a managed
 * identity (typically via embedded secrets/connection strings).
 */
function hasManagedIdentity(identityType: string | undefined): boolean {
  if (!identityType) return false;
  return identityType.trim().toLowerCase() !== "none";
}

/**
 * Parses an Azure minTlsVersion string (e.g. "1.0", "1.1", "1.2", "1.3") into a
 * comparable number. Returns null when the value is absent/unparseable so the
 * caller can decide how to treat it (we treat unknown as "below 1.2" because we
 * cannot prove the app enforces a modern TLS floor).
 */
function parseTlsVersion(minTlsVersion: string | undefined): number | null {
  if (!minTlsVersion) return null;
  const parsed = Number.parseFloat(minTlsVersion);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Runs all Azure App Service security checks and returns findings built from
 * real Web App + site configuration properties.
 *
 * Checks (per Web App):
 * 1. azure_app_service_no_https — httpsOnly not enforced
 * 2. azure_app_service_weak_tls — minTlsVersion below 1.2
 * 3. azure_app_service_no_managed_identity — identity.type is None/absent
 * 4. azure_app_service_remote_debugging — remoteDebuggingEnabled is true
 */
export async function auditAzureAppService(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new WebSiteManagementClient(
    creds.credential,
    creds.subscriptionId,
  );
  const findings: AgentFindingPayload[] = [];

  // Real enumeration over the subscription's Web Apps (paginated iterator).
  for await (const app of client.webApps.list()) {
    findings.push(...(await auditWebApp(client, app)));
  }

  return findings;
}

/**
 * Audits a single Web App: site-level properties come from the Site object
 * returned by list(); TLS/remote-debugging come from a real getConfiguration
 * call for that app's resource group + name.
 */
async function auditWebApp(
  client: WebSiteManagementClient,
  app: Site,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const appName = app.name ?? "unknown";
  const appId = app.id ?? appName;
  const region = app.location ?? null;
  const resourceGroup = extractResourceGroup(app.id);

  // Check 1: HTTPS-only enforcement (site-level property).
  if (app.httpsOnly !== true) {
    findings.push({
      title: `App Service "${appName}" does not enforce HTTPS-only`,
      description: `Azure App Service ${appName} (${appId}) does not have the HTTPS Only setting enabled, so it accepts plain-text HTTP requests. Unencrypted traffic can be intercepted. Enable "HTTPS Only" to redirect all HTTP traffic to HTTPS.`,
      severity: "high",
      category: "network",
      resourceType: RESOURCE_TYPE,
      resourceId: appId,
      resourceRegion: region,
      remediationTier: "auto",
      autoFixAvailable: true,
      controlMappings: mapCheckToControls("azure_app_service_no_https"),
      source: SOURCE,
    });
  }

  // Check 2: Managed identity configured (site-level property).
  if (!hasManagedIdentity(app.identity?.type)) {
    findings.push({
      title: `App Service "${appName}" does not use a managed identity`,
      description: `Azure App Service ${appName} (${appId}) has no managed identity configured (identity.type = ${app.identity?.type ?? "None"}). Without a managed identity the app must authenticate to other Azure resources using embedded secrets or connection strings. Enable a system-assigned or user-assigned managed identity.`,
      severity: "medium",
      category: "iam",
      resourceType: RESOURCE_TYPE,
      resourceId: appId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_app_service_no_managed_identity"),
      source: SOURCE,
    });
  }

  // Checks 3 & 4 need the per-app site configuration (minTlsVersion +
  // remoteDebuggingEnabled), which is only on the SiteConfigResource.
  if (resourceGroup) {
    let config: SiteConfigResource | null = null;
    try {
      config = await client.webApps.getConfiguration(resourceGroup, appName);
    } catch {
      // If configuration is unreadable (e.g. transient/permission), skip the
      // config-derived checks for this app rather than fabricating findings.
      config = null;
    }

    if (config) {
      // Check 3: minimum TLS version >= 1.2.
      const tlsVersion = parseTlsVersion(config.minTlsVersion);
      if (tlsVersion === null || tlsVersion < 1.2) {
        findings.push({
          title: `App Service "${appName}" allows TLS below 1.2`,
          description: `Azure App Service ${appName} (${appId}) is configured with minimum TLS version "${config.minTlsVersion ?? "unset"}", which permits deprecated TLS 1.0/1.1 connections. Set the minimum TLS version to 1.2 or higher.`,
          severity: "high",
          category: "encryption",
          resourceType: RESOURCE_TYPE,
          resourceId: appId,
          resourceRegion: region,
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("azure_app_service_weak_tls"),
          source: SOURCE,
        });
      }

      // Check 4: remote debugging must be disabled.
      if (config.remoteDebuggingEnabled === true) {
        findings.push({
          title: `App Service "${appName}" has remote debugging enabled`,
          description: `Azure App Service ${appName} (${appId}) has remote debugging enabled. Remote debugging opens an additional management surface that can be abused to inspect or alter the running app. Disable remote debugging on production App Services.`,
          severity: "high",
          category: "config",
          resourceType: RESOURCE_TYPE,
          resourceId: appId,
          resourceRegion: region,
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("azure_app_service_remote_debugging"),
          source: SOURCE,
        });
      }
    }
  }

  return findings;
}

/**
 * Azure App Service Auditor Agent.
 *
 * Public surface is intentionally unchanged from the original stub
 * (registry.ts constructs `new AzureAppServiceAuditorAgent()`), but the body is
 * now backed by real @azure/arm-appservice SDK calls via auditAzureAppService.
 */
export class AzureAppServiceAuditorAgent extends BaseAgent {
  readonly type = "azure-app-service-auditor";
  readonly displayName = "Azure App Service Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve the tenant's real Azure
      // credentials from the integration credentialRef (Service Principal or
      // managed identity) instead of returning canned data.
      const creds = await resolveAzureCredentials(ctx.credentialRef);

      const findings = await auditAzureAppService(creds);

      for (const finding of findings) {
        // REAL IMPL (BLACKFYRE 2026-06): findings already carry source=SOURCE
        // (which equals this.type), so emit them as-is like aks-auditor.ts
        // instead of re-overriding source here.
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
  // make one authenticated ARM call (list a single role assignment). A bogus
  // credentialRef (e.g. "azure") fails JSON parsing / auth and returns false,
  // unlike the old `return true` stub.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = new AuthorizationManagementClient(
        creds.credential,
        creds.subscriptionId,
      );
      for await (const _assignment of client.roleAssignments.listForSubscription()) {
        break; // One successful response proves API access.
      }
      return true;
    } catch {
      return false;
    }
  }
}
