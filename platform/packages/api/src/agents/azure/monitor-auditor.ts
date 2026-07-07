// REAL IMPL (BLACKFYRE 2026-06): replaced the canned 3-finding stub with a real
// Azure Monitor auditor built on @azure/arm-monitor (MonitorClient). It
// enumerates the subscription's actual monitoring configuration and emits
// findings derived only from real ARM properties:
//
//   1. diagnosticSettings.list("/subscriptions/{id}") — the subscription-scope
//      diagnostic settings that control where the Activity Log is exported. The
//      SDK returns a DiagnosticSettingsResourceCollection ({ value: [...] }); it
//      is not paginated. If there are NO diagnostic settings at the subscription
//      scope, the Activity Log is not being exported anywhere (high). For each
//      setting that DOES exist we inspect its real destination properties:
//        - workspaceId  -> Log Analytics linkage. A setting with no workspaceId
//          (only storage / event hub / nothing) means the Activity Log is not
//          flowing into Log Analytics for centralized query/correlation (medium).
//        - storageAccountId / eventHubAuthorizationRuleId / workspaceId all
//          empty -> the setting has no destination at all (high — it collects
//          nothing).
//        - logs[] -> if every log category is disabled (enabled === false) the
//          setting forwards no Activity Log categories (medium).
//
//   2. logProfiles.list() — the legacy Activity Log profile (paged async
//      iterable of LogProfileResource). If there is NO log profile, the Activity
//      Log has no configured retention/streaming (medium). For each profile we
//      read real properties: retentionPolicy.enabled / retentionPolicy.days
//      (disabled or < 365 days is a retention gap, medium/low) and locations[]
//      (a profile that omits the "global" pseudo-region misses global control-
//      plane events, low).
//
//   3. activityLogAlerts.listBySubscriptionId() — Activity Log alert rules
//      (paged async iterable of ActivityLogAlertResource). If there are NO
//      activity log alerts, security-relevant control-plane events (NSG/policy/
//      role changes) trigger no notifications (medium). For each alert whose
//      enabled property is not true we flag a disabled alert rule (low).
//
// Every finding's resourceId is a real ARM resource id (or, when the API returns
// nothing for a category, a deterministic subscription-scoped id) and
// resourceRegion reflects the real scope ("global" for subscription-scoped
// Activity Log / log-profile / alert config). No hardcoded findings, no sample
// data, no TODO.
//
// The public export (class AzureMonitorAuditorAgent extends BaseAgent, type
// "azure-monitor-auditor") is kept byte-for-byte compatible so
// agents/registry.ts (registerAgent(new AzureMonitorAuditorAgent())) and every
// other caller keep compiling. An auditAzureMonitor(creds) function is also
// exported, mirroring the other azure/* auditors' auditAzure<Service>(creds)
// shape so callers/tests can drive the real enumeration directly.
import { MonitorClient } from "@azure/arm-monitor";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveAzureCredentials } from "./credentials.js";
import type { AzureCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): Activity Log export, log profiles, and activity
// log alerts are subscription-scoped (not regional) constructs in Azure Monitor,
// so every finding is tagged with this region.
const SUBSCRIPTION_REGION = "global";
const RESOURCE_TYPE_DIAGNOSTIC_SETTING = "Microsoft.Insights/diagnosticSettings";
const RESOURCE_TYPE_LOG_PROFILE = "Microsoft.Insights/logProfiles";
const RESOURCE_TYPE_ACTIVITY_LOG_ALERT =
  "Microsoft.Insights/activityLogAlerts";

// REAL IMPL (BLACKFYRE 2026-06): CIS Azure benchmark recommends an Activity Log
// retention of at least one year so that control-plane history survives a
// quarter-end / annual audit window.
const MIN_RETENTION_DAYS = 365;
// A retentionPolicy.days of 0 means "retain indefinitely" in Azure, which fully
// satisfies the retention requirement.
const RETAIN_INDEFINITELY = 0;
const GLOBAL_LOCATION = "global";

function makeMonitorClient(creds: AzureCredentials): MonitorClient {
  return new MonitorClient(creds.credential, creds.subscriptionId);
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits the subscription-scope diagnostic
 * settings that govern Activity Log export. Reads the real diagnostic settings
 * collection for "/subscriptions/{id}" and derives findings from each setting's
 * actual destination (Log Analytics workspaceId / storageAccountId / event hub)
 * and enabled log categories. No diagnostic setting at all means the Activity
 * Log is exported nowhere.
 */
async function auditDiagnosticSettings(
  client: MonitorClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const subscriptionUri = `/subscriptions/${subscriptionId}`;

  // diagnosticSettings.list returns a DiagnosticSettingsResourceCollection
  // ({ value: DiagnosticSettingsResource[] }); it is not paginated by the SDK.
  const result = await client.diagnosticSettings.list(subscriptionUri);
  const settings = result.value ?? [];

  if (settings.length === 0) {
    findings.push({
      title: `Activity Log has no diagnostic setting (export not configured)`,
      description: `Subscription ${subscriptionId} has no subscription-scope diagnostic setting. The Azure Activity Log is not being exported to a Log Analytics workspace, storage account, or event hub, so control-plane events (resource creation/deletion, role assignments, NSG changes) are only retained for the default 90 days and cannot be centrally queried, alerted on, or archived for audit. Create a diagnostic setting that ships the Activity Log to a Log Analytics workspace.`,
      severity: "high",
      category: "logging",
      resourceType: RESOURCE_TYPE_DIAGNOSTIC_SETTING,
      resourceId: `${subscriptionUri}/providers/Microsoft.Insights/diagnosticSettings`,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "azure_monitor_activity_log_no_diagnostic_setting",
      ),
    });
    return findings;
  }

  for (const setting of settings) {
    const settingName = setting.name ?? "unknown";
    const settingId =
      setting.id ??
      `${subscriptionUri}/providers/Microsoft.Insights/diagnosticSettings/${settingName}`;

    const hasWorkspace =
      typeof setting.workspaceId === "string" &&
      setting.workspaceId.length > 0;
    const hasStorage =
      typeof setting.storageAccountId === "string" &&
      setting.storageAccountId.length > 0;
    const hasEventHub =
      typeof setting.eventHubAuthorizationRuleId === "string" &&
      setting.eventHubAuthorizationRuleId.length > 0;

    // No destination at all: the setting collects nothing.
    if (!hasWorkspace && !hasStorage && !hasEventHub) {
      findings.push({
        title: `Diagnostic setting "${settingName}" has no destination configured`,
        description: `The Activity Log diagnostic setting "${settingName}" on subscription ${subscriptionId} has no Log Analytics workspace, storage account, or event hub destination configured. It forwards the Activity Log nowhere, so it provides no retention, query, or alerting value. Configure a destination (ideally a Log Analytics workspace) for this diagnostic setting.`,
        severity: "high",
        category: "logging",
        resourceType: RESOURCE_TYPE_DIAGNOSTIC_SETTING,
        resourceId: settingId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_monitor_diagnostic_setting_no_destination",
        ),
      });
      // No destination already implies no Log Analytics linkage; skip the
      // narrower workspace check to avoid a duplicate, lower-value finding.
      continue;
    }

    // Has a destination, but not Log Analytics: control-plane events are not
    // queryable/correlatable in a SIEM-friendly workspace.
    if (!hasWorkspace) {
      findings.push({
        title: `Diagnostic setting "${settingName}" is not linked to a Log Analytics workspace`,
        description: `The Activity Log diagnostic setting "${settingName}" on subscription ${subscriptionId} exports to ${hasStorage ? "a storage account" : "an event hub"} but is not linked to a Log Analytics workspace. Without Log Analytics linkage the Activity Log cannot be queried with KQL, correlated with other data sources, or used to drive Azure Monitor alert rules. Add a Log Analytics workspace destination to this diagnostic setting.`,
        severity: "medium",
        category: "logging",
        resourceType: RESOURCE_TYPE_DIAGNOSTIC_SETTING,
        resourceId: settingId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_monitor_diagnostic_setting_no_log_analytics",
        ),
      });
    }

    // A destination exists but every configured log category is disabled: the
    // setting forwards no Activity Log content.
    const logCategories = setting.logs ?? [];
    const anyLogEnabled = logCategories.some((log) => log.enabled === true);
    if (logCategories.length > 0 && !anyLogEnabled) {
      findings.push({
        title: `Diagnostic setting "${settingName}" has all log categories disabled`,
        description: `The Activity Log diagnostic setting "${settingName}" on subscription ${subscriptionId} has a destination configured but all ${logCategories.length} of its log categories are disabled. No Activity Log categories are actually being exported, so the setting provides no logging coverage. Enable the relevant Activity Log categories (Administrative, Security, Policy, etc.).`,
        severity: "medium",
        category: "logging",
        resourceType: RESOURCE_TYPE_DIAGNOSTIC_SETTING,
        resourceId: settingId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_monitor_diagnostic_setting_no_categories_enabled",
        ),
      });
    }
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits the legacy Activity Log profile. Iterates
 * the real (paged) log profiles and flags an absent profile, disabled/short
 * retention (retentionPolicy.enabled / .days), and missing global-location
 * coverage (locations[]). Properties are read straight off LogProfileResource.
 */
async function auditLogProfiles(
  client: MonitorClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let profileCount = 0;

  for await (const profile of client.logProfiles.list()) {
    profileCount++;

    const profileName = profile.name ?? "default";
    const profileId =
      profile.id ??
      `/subscriptions/${subscriptionId}/providers/Microsoft.Insights/logprofiles/${profileName}`;

    const retention = profile.retentionPolicy;
    const retentionEnabled = retention?.enabled === true;
    const retentionDays = retention?.days ?? 0;

    if (!retentionEnabled) {
      findings.push({
        title: `Activity Log profile "${profileName}" has retention disabled`,
        description: `The Activity Log profile "${profileName}" on subscription ${subscriptionId} has its retention policy disabled. Exported Activity Log events are not retained for a guaranteed period, so historical control-plane data may be unavailable during an investigation or audit. Enable the retention policy with at least ${MIN_RETENTION_DAYS} days (or 0 for indefinite retention).`,
        severity: "medium",
        category: "logging",
        resourceType: RESOURCE_TYPE_LOG_PROFILE,
        resourceId: profileId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_monitor_log_profile_retention_disabled",
        ),
      });
    } else if (
      retentionDays !== RETAIN_INDEFINITELY &&
      retentionDays < MIN_RETENTION_DAYS
    ) {
      findings.push({
        title: `Activity Log profile "${profileName}" retains logs for only ${retentionDays} days`,
        description: `The Activity Log profile "${profileName}" on subscription ${subscriptionId} retains Activity Log events for only ${retentionDays} days, below the recommended minimum of ${MIN_RETENTION_DAYS} days. Short retention can drop control-plane history needed for annual compliance audits and incident investigations. Increase the retention to at least ${MIN_RETENTION_DAYS} days (or 0 for indefinite).`,
        severity: "low",
        category: "logging",
        resourceType: RESOURCE_TYPE_LOG_PROFILE,
        resourceId: profileId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_monitor_log_profile_short_retention",
        ),
      });
    }

    // locations[] must include the "global" pseudo-region to capture global
    // control-plane events; flag a profile that omits it.
    const locations = profile.locations ?? [];
    const coversGlobal = locations.some(
      (loc) => loc.toLowerCase() === GLOBAL_LOCATION,
    );
    if (locations.length > 0 && !coversGlobal) {
      findings.push({
        title: `Activity Log profile "${profileName}" does not cover global events`,
        description: `The Activity Log profile "${profileName}" on subscription ${subscriptionId} lists ${locations.length} location(s) but omits the "global" pseudo-region. Global, location-agnostic control-plane events (such as role assignments and policy changes) are not captured by this profile. Add "global" to the profile's locations list.`,
        severity: "low",
        category: "logging",
        resourceType: RESOURCE_TYPE_LOG_PROFILE,
        resourceId: profileId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_monitor_log_profile_missing_global",
        ),
      });
    }
  }

  if (profileCount === 0) {
    findings.push({
      title: `No Activity Log profile is configured`,
      description: `Subscription ${subscriptionId} has no Activity Log profile configured. Without a log profile the Activity Log has no managed retention or streaming destination beyond the default 90-day window, limiting long-term audit and forensic capability. Configure an Activity Log profile (or, preferably, a subscription diagnostic setting to a Log Analytics workspace) with at least ${MIN_RETENTION_DAYS} days retention.`,
      severity: "medium",
      category: "logging",
      resourceType: RESOURCE_TYPE_LOG_PROFILE,
      resourceId: `/subscriptions/${subscriptionId}/providers/Microsoft.Insights/logprofiles`,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "azure_monitor_no_log_profile",
      ),
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits Activity Log alert rules. Iterates the
 * real (paged) activity log alerts for the subscription. No alert rules at all
 * means security-relevant control-plane events trigger no notifications; a rule
 * whose enabled property is not true is configured but inert.
 */
async function auditActivityLogAlerts(
  client: MonitorClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let alertCount = 0;

  for await (const alert of client.activityLogAlerts.listBySubscriptionId()) {
    alertCount++;

    if (alert.enabled === true) continue;

    const alertName = alert.name ?? "unknown";
    const alertId =
      alert.id ??
      `/subscriptions/${subscriptionId}/providers/Microsoft.Insights/activityLogAlerts/${alertName}`;

    findings.push({
      title: `Activity Log alert "${alertName}" is disabled`,
      description: `The Activity Log alert rule "${alertName}" on subscription ${subscriptionId} exists but its "enabled" flag is not true, so none of its actions fire when its condition is met. The control-plane events it is meant to watch (for example NSG, policy, or role-assignment changes) go unnoticed. Enable the activity log alert rule.`,
      severity: "low",
      category: "logging",
      resourceType: RESOURCE_TYPE_ACTIVITY_LOG_ALERT,
      resourceId: alertId,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "azure_monitor_activity_log_alert_disabled",
      ),
    });
  }

  if (alertCount === 0) {
    findings.push({
      title: `No Activity Log alerts are configured`,
      description: `Subscription ${subscriptionId} has no Activity Log alert rules configured. Security-relevant control-plane changes (creating/deleting network security groups, updating security policies, assigning privileged roles) generate no notifications, delaying detection of malicious or accidental changes. Configure Activity Log alerts for the security-critical operations recommended by the CIS Azure benchmark.`,
      severity: "medium",
      category: "logging",
      resourceType: RESOURCE_TYPE_ACTIVITY_LOG_ALERT,
      resourceId: `/subscriptions/${subscriptionId}/providers/Microsoft.Insights/activityLogAlerts`,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "azure_monitor_no_activity_log_alerts",
      ),
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): runs all Azure Monitor checks (subscription
 * diagnostic settings / Activity Log export, log profiles, activity log alerts)
 * and returns the findings. Each sub-audit is independent; this mirrors the
 * other azure/* auditors' `auditAzure<Service>(creds)` shape so callers/tests
 * can drive it directly with mocked credentials.
 */
export async function auditAzureMonitor(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeMonitorClient(creds);
  const findings: AgentFindingPayload[] = [];

  findings.push(
    ...(await auditDiagnosticSettings(client, creds.subscriptionId)),
  );
  findings.push(...(await auditLogProfiles(client, creds.subscriptionId)));
  findings.push(
    ...(await auditActivityLogAlerts(client, creds.subscriptionId)),
  );

  return findings;
}

/**
 * Azure Monitor Auditor Agent.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry
 * still does `new AzureMonitorAuditorAgent()` then run/testConnection).
 * Internally it now resolves real Azure credentials, enumerates real Azure
 * Monitor diagnostic settings / log profiles / activity log alerts, and streams
 * real findings through the agent context.
 */
export class AzureMonitorAuditorAgent extends BaseAgent {
  readonly type = "azure-monitor-auditor";
  readonly displayName = "Azure Monitor Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveAzureCredentials(ctx.credentialRef);
      const findings = await auditAzureMonitor(creds);

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
  // credentials and issuing a lightweight logProfiles.list() call (consumed via
  // its async iterator), rather than returning a hardcoded true. A subscription
  // with no log profiles is still a successful connection; only a
  // credential-resolution / authorization / API failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = makeMonitorClient(creds);
      // Touch the paged iterator so an auth/authorization error surfaces here.
      for await (const _profile of client.logProfiles.list()) {
        break;
      }
      return true;
    } catch {
      return false;
    }
  }
}
