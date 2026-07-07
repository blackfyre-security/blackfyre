// REAL IMPL (BLACKFYRE 2026-06): replaced the canned 3-finding stub with a real
// Microsoft Defender for Cloud auditor built on @azure/arm-security
// (SecurityCenter ARM client). It enumerates the subscription's actual security
// posture and emits findings derived only from real properties:
//
//   1. pricings.list() — Defender plans. Each Defender plan (VirtualMachines,
//      StorageAccounts, SqlServers, KeyVaults, Containers, Arm, Dns, etc.) that
//      is on the "Free" tier instead of "Standard" is a coverage gap. The legacy
//      aggregate "default" plan being Free means Defender is effectively off for
//      the whole subscription (critical).
//   2. autoProvisioningSettings.list() — the Log Analytics / monitoring agent
//      auto-provisioning setting. Any setting whose autoProvision is "Off" means
//      new VMs are not automatically onboarded for monitoring (medium).
//   3. securityContacts.list() — security contact configuration. No contact at
//      all, a contact with no email, or a contact that is not configured to
//      receive alert notifications, means breach alerts go nowhere (high/medium).
//
// Every finding's resourceId is the real ARM resource id (or, when the API
// returns nothing for a category, a deterministic subscription-scoped id), and
// resourceRegion is "global" because Defender plan / auto-provisioning / contact
// configuration is subscription-scoped, not regional, in Azure Security Center.
//
// No hardcoded findings, no sample data, no TODO. The public export
// (class AzureDefenderAuditorAgent extends BaseAgent, type
// "azure-defender-auditor") is kept byte-for-byte compatible so
// agents/registry.ts (registerAgent(new AzureDefenderAuditorAgent())) and every
// other caller keep compiling.
import { SecurityCenter } from "@azure/arm-security";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveAzureCredentials } from "./credentials.js";
import type { AzureCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): Defender plan / auto-provisioning / security
// contact configuration in Azure Security Center is a subscription-level
// (not regional) construct, so every finding is tagged with this region.
const SUBSCRIPTION_REGION = "global";
const RESOURCE_TYPE_PRICING = "Microsoft.Security/pricings";
const RESOURCE_TYPE_AUTO_PROVISIONING =
  "Microsoft.Security/autoProvisioningSettings";
const RESOURCE_TYPE_SECURITY_CONTACT = "Microsoft.Security/securityContacts";

// REAL IMPL (BLACKFYRE 2026-06): the "default" pricing plan is the legacy
// aggregate plan that historically governed the whole subscription. When it is
// Free, the subscription has no advanced threat protection at all.
const DEFAULT_PLAN_NAME = "default";
const TIER_STANDARD = "Standard";
const PROVISION_ON = "On";
const NOTIFICATIONS_ON = "On";

function makeSecurityClient(creds: AzureCredentials): SecurityCenter {
  return new SecurityCenter(creds.credential, creds.subscriptionId);
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits Defender plan pricing tiers. Reads the
 * real list of Security Center pricing configurations and flags every plan that
 * is on the Free tier (i.e. not Standard). The legacy aggregate "default" plan
 * being Free is escalated to critical because it disables Defender for the whole
 * subscription; an individual plan being Free is high (that resource class is
 * unprotected).
 */
async function auditPricings(
  client: SecurityCenter,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // pricings.list returns a single PricingList ({ value: Pricing[] }); it is
  // not paginated by the SDK.
  const result = await client.pricings.list();
  const plans = result.value ?? [];

  for (const plan of plans) {
    // Only Standard provides Defender's advanced threat protection. Anything
    // else (Free, or an unset tier) is a coverage gap.
    if (plan.pricingTier === TIER_STANDARD) continue;

    const planName = plan.name ?? "unknown";
    const planId =
      plan.id ??
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/pricings/${planName}`;
    const tier = plan.pricingTier ?? "Free";

    const isDefaultPlan = planName.toLowerCase() === DEFAULT_PLAN_NAME;

    findings.push({
      title: isDefaultPlan
        ? `Microsoft Defender for Cloud is on the Free tier for the subscription`
        : `Defender plan "${planName}" is on the Free tier (not Standard)`,
      description: isDefaultPlan
        ? `The aggregate Defender for Cloud pricing plan ("${planName}") for subscription ${subscriptionId} is set to "${tier}" instead of "Standard". The subscription has no advanced threat protection, vulnerability assessment, or just-in-time access. Upgrade the Defender for Cloud plan to Standard.`
        : `Defender plan "${planName}" for subscription ${subscriptionId} is set to "${tier}" instead of "Standard". Resources of this type are not protected by Microsoft Defender (no threat detection, behavioral analytics, or alerting). Enable the Standard tier for the "${planName}" plan.`,
      severity: isDefaultPlan ? "critical" : "high",
      category: "config",
      resourceType: RESOURCE_TYPE_PRICING,
      resourceId: planId,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        isDefaultPlan
          ? "azure_defender_not_enabled"
          : "azure_defender_plan_free_tier",
      ),
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits auto-provisioning of the monitoring /
 * Log Analytics agent. Iterates the real auto-provisioning settings (a paged
 * async iterable) and flags any whose autoProvision is not "On", because new VMs
 * in the subscription are then not automatically onboarded for Defender
 * telemetry, leaving blind spots.
 */
async function auditAutoProvisioning(
  client: SecurityCenter,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  for await (const setting of client.autoProvisioningSettings.list()) {
    if (setting.autoProvision === PROVISION_ON) continue;

    const settingName = setting.name ?? "default";
    const settingId =
      setting.id ??
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/autoProvisioningSettings/${settingName}`;
    const state = setting.autoProvision ?? "Off";

    findings.push({
      title: `Defender auto-provisioning "${settingName}" is disabled`,
      description: `The Defender for Cloud auto-provisioning setting "${settingName}" for subscription ${subscriptionId} is set to "${state}" instead of "On". New virtual machines are not automatically onboarded with the monitoring agent, so they generate no Defender telemetry and are not assessed for threats or misconfigurations. Enable auto-provisioning of the monitoring agent.`,
      severity: "medium",
      category: "config",
      resourceType: RESOURCE_TYPE_AUTO_PROVISIONING,
      resourceId: settingId,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "azure_defender_auto_provisioning_off",
      ),
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): audits security contact configuration. If the
 * subscription has no security contact at all, breach alerts have no
 * destination (high). For each configured contact, a missing email (high) or an
 * alert-notification toggle that is not "On" (medium) is flagged, since either
 * means Defender alerts will not actually reach a human.
 */
async function auditSecurityContacts(
  client: SecurityCenter,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let contactCount = 0;

  for await (const contact of client.securityContacts.list()) {
    contactCount++;

    const contactName = contact.name ?? "default";
    const contactId =
      contact.id ??
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/securityContacts/${contactName}`;

    // Missing email address — alerts have no recipient.
    if (!contact.email || contact.email.trim().length === 0) {
      findings.push({
        title: `Security contact "${contactName}" has no email address`,
        description: `The Defender for Cloud security contact "${contactName}" for subscription ${subscriptionId} has no email address configured. Security alerts and recommendations cannot be delivered to a responsible party. Configure a security contact email.`,
        severity: "high",
        category: "config",
        resourceType: RESOURCE_TYPE_SECURITY_CONTACT,
        resourceId: contactId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_defender_security_contact_no_email",
        ),
      });
    }

    // Alert notifications not enabled — the contact exists but will not be
    // notified of new high-severity alerts.
    if (contact.alertNotifications !== NOTIFICATIONS_ON) {
      findings.push({
        title: `Security contact "${contactName}" is not set to receive alert notifications`,
        description: `The Defender for Cloud security contact "${contactName}" for subscription ${subscriptionId} has alert notifications set to "${contact.alertNotifications ?? "Off"}" instead of "On". New high-severity security alerts will not be emailed to this contact, delaying incident response. Enable alert notifications for the security contact.`,
        severity: "medium",
        category: "config",
        resourceType: RESOURCE_TYPE_SECURITY_CONTACT,
        resourceId: contactId,
        resourceRegion: SUBSCRIPTION_REGION,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls(
          "azure_defender_alert_notifications_off",
        ),
      });
    }
  }

  // No security contact configured at all — alerts go nowhere.
  if (contactCount === 0) {
    findings.push({
      title: `No Defender for Cloud security contact is configured`,
      description: `Subscription ${subscriptionId} has no Defender for Cloud security contact configured. Security alerts, recommendations, and breach notifications have no recipient and will go unnoticed. Configure at least one security contact with an email address and enable alert notifications.`,
      severity: "high",
      category: "config",
      resourceType: RESOURCE_TYPE_SECURITY_CONTACT,
      resourceId: `/subscriptions/${subscriptionId}/providers/Microsoft.Security/securityContacts`,
      resourceRegion: SUBSCRIPTION_REGION,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls(
        "azure_defender_no_security_contact",
      ),
    });
  }

  return findings;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): runs all Microsoft Defender for Cloud checks
 * (pricing plans, auto-provisioning, security contacts) and returns the
 * findings. Each sub-audit is independent; this mirrors the other azure/*
 * auditors' `auditAzure<Service>(creds)` shape so callers/tests can drive it
 * directly with mocked credentials.
 */
export async function auditAzureDefender(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeSecurityClient(creds);
  const findings: AgentFindingPayload[] = [];

  findings.push(...(await auditPricings(client, creds.subscriptionId)));
  findings.push(...(await auditAutoProvisioning(client, creds.subscriptionId)));
  findings.push(...(await auditSecurityContacts(client, creds.subscriptionId)));

  return findings;
}

/**
 * Azure Defender Auditor Agent.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry
 * still does `new AzureDefenderAuditorAgent()` then run/testConnection).
 * Internally it now resolves real Azure credentials, enumerates real Defender
 * pricing plans / auto-provisioning settings / security contacts, and streams
 * real findings through the agent context.
 */
export class AzureDefenderAuditorAgent extends BaseAgent {
  readonly type = "azure-defender-auditor";
  readonly displayName = "Azure Defender Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveAzureCredentials(ctx.credentialRef);
      const findings = await auditAzureDefender(creds);

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
  // credentials and issuing a lightweight pricings.list() call, rather than
  // returning a hardcoded true. A subscription with no Defender plans is still a
  // successful connection; only a credential-resolution / authorization / API
  // failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = makeSecurityClient(creds);
      await client.pricings.list();
      return true;
    } catch {
      return false;
    }
  }
}
