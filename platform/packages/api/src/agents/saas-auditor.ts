import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../services/compliance-mapper.js";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — customer-controlled apiUrl was fetched
// with raw fetch(), allowing a read-SSRF oracle to reach internal/cloud-metadata endpoints
// (e.g. 169.254.169.254) and exfiltrate cloud credentials. All outbound calls to the tenant-
// supplied apiUrl now route through safeFetch(), which blocks private/reserved targets and
// re-validates every redirect hop. SsrfBlockedError is caught to distinguish a policy
// rejection from an ordinary network error.
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

// REAL IMPL (BLACKFYRE 2026-06): this auditor previously returned 4 IDENTICAL canned findings
// for EVERY tenant (MFA-not-enforced / admin-no-MFA / weak-password-policy / SSO-not-configured
// with synthetic resourceIds saas-0..3), regardless of whether any SaaS integration existed or
// what its real security posture was. It now reads the tenant's REAL org-level SaaS security
// configuration from the configured provider (Okta org-wide MFA-enrollment + password policies
// and SAML IdPs, Microsoft Entra ID authenticationMethodsPolicy + authorizationPolicy +
// federated domains, or Google Workspace customer 2-Step-Verification + password + SSO settings)
// using the tenant integration credential, and emits findings derived from the ACTUAL returned
// policy state. The provider admin REST APIs ARE this platform's SaaS SDK; every outbound call
// is routed through safeFetch (the SSRF chokepoint). When no integration/credential is present,
// or the admin API cannot be read, it emits a single explicit "not-assessed" informational
// finding instead of inventing posture. NO finding is fabricated.

interface SaasConfig {
  provider: "google_workspace" | "okta" | "azure_ad";
  apiUrl: string;
  apiKey?: string;
  /** Google Workspace primary domain (used to resolve customer + SSO settings). */
  domain?: string;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): normalized org-level SaaS security policy snapshot derived
 * from the live provider admin APIs. `null` on any field means "the provider did not report
 * that setting" — it is never defaulted to a fabricated value.
 */
interface SaasPolicyState {
  /** Org-wide MFA/2-Step-Verification enforced for all users. null = unknown. */
  mfaEnforcedAll: boolean | null;
  /** MFA explicitly enforced for admin/privileged accounts. null = unknown. */
  mfaEnforcedAdmins: boolean | null;
  /** Password policy meets a strong baseline (>=12 chars + complexity). null = unknown. */
  passwordPolicyStrong: boolean | null;
  /** Real minimum password length the provider reports (for evidence). null = unknown. */
  passwordMinLength: number | null;
  /** SSO / SAML federation configured at the org. null = unknown. */
  ssoConfigured: boolean | null;
}

const STRONG_PASSWORD_MIN_LENGTH = 12;

/**
 * SaaS Security Auditor Agent
 *
 * Scans: org-level MFA enforcement, admin MFA enforcement, password-policy strength, and
 * SSO/federation configuration of the connected SaaS platform.
 * Integration: Google Workspace Admin SDK, Okta API, Microsoft Entra ID (Azure AD) Graph.
 *
 * REAL IMPL (BLACKFYRE 2026-06): reads the tenant's real SaaS security policy via the provider
 * admin API and emits findings computed from that real state. With no integration/credential it
 * returns an explicit not-assessed finding rather than canned posture.
 */
export class SaasAuditorAgent extends BaseAgent {
  readonly type = "saas-auditor";
  readonly displayName = "SaaS Security Auditor";
  readonly supportedIntegrations = ["google_workspace", "okta", "azure_ad"];

  private parseConfig(credentialRef: string): SaasConfig {
    try {
      const parsed = JSON.parse(credentialRef) as Partial<SaasConfig>;
      return {
        provider: parsed.provider ?? this.inferProvider(credentialRef),
        apiUrl: parsed.apiUrl ?? "",
        apiKey: parsed.apiKey,
        domain: parsed.domain,
      };
    } catch {
      return {
        provider: this.inferProvider(credentialRef),
        apiUrl: credentialRef.replace("vault://", ""),
        domain: credentialRef.split("/").pop(),
      };
    }
  }

  private inferProvider(ref: string): SaasConfig["provider"] {
    return ref.includes("okta")
      ? "okta"
      : ref.includes("azure") || ref.includes("entra")
        ? "azure_ad"
        : "google_workspace";
  }

  private providerName(config: SaasConfig): string {
    return config.provider === "okta"
      ? "Okta"
      : config.provider === "azure_ad"
        ? "Microsoft Entra ID"
        : "Google Workspace";
  }

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    const config = this.parseConfig(ctx.credentialRef);

    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): needsLiveEnv — without a live SaaS admin credential we
      // cannot read the org security policy. Emit an explicit not-assessed finding (no canned
      // posture) and finish, rather than the previous 4 identical fabricated findings.
      const hasCreds = Boolean(config.apiUrl) && Boolean(config.apiKey);
      if (!hasCreds) {
        await ctx.onFinding(
          this.notAssessedFinding(config, "no SaaS admin API credential was provided to the scan"),
        );
        ctx.onProgress(100);
        return this.createResult(startedAt, 1);
      }

      ctx.onProgress(15);

      // Phase 1: read the REAL org-level security policy from the provider admin API (15-70%).
      const policy = await this.fetchPolicyState(config);
      ctx.onProgress(70);

      if (policy === null) {
        // Reachable credential path but the admin API returned nothing usable (auth/permission/
        // transport failure or SSRF-blocked target). Do NOT fabricate posture.
        await ctx.onFinding(
          this.notAssessedFinding(
            config,
            "the SaaS admin API did not return a readable security policy (check credential scope/permissions and network egress policy)",
          ),
        );
        ctx.onProgress(100);
        return this.createResult(startedAt, 1);
      }

      // Phase 2: derive findings from the REAL policy state (70-100%).
      const findings = this.evaluate(config, policy);
      for (const f of findings) {
        await ctx.onFinding(f);
        findingsCount++;
      }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  // -------------------------------------------------------------------------
  // Real org-level policy enumeration (per provider)
  // -------------------------------------------------------------------------

  /**
   * REAL IMPL (BLACKFYRE 2026-06): read the live org security policy from the configured
   * provider. Returns null when the admin API is unreachable/unauthorized (so the caller emits
   * not-assessed instead of fabricating).
   */
  private async fetchPolicyState(config: SaasConfig): Promise<SaasPolicyState | null> {
    try {
      switch (config.provider) {
        case "okta":
          return await this.fetchOktaPolicy(config);
        case "azure_ad":
          return await this.fetchEntraPolicy(config);
        case "google_workspace":
          return await this.fetchGooglePolicy(config);
        default:
          return null;
      }
    } catch (err) {
      this.warnIfSsrf(err, config, "fetchPolicyState");
      return null;
    }
  }

  private authHeader(config: SaasConfig): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.apiKey) {
      headers["Authorization"] =
        config.provider === "okta" ? `SSWS ${config.apiKey}` : `Bearer ${config.apiKey}`;
    }
    return headers;
  }

  private async getJson(url: string, config: SaasConfig, phase: string): Promise<unknown | null> {
    try {
      const res = await safeFetch(url, { headers: this.authHeader(config) }, { timeoutMs: 8000 });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      this.warnIfSsrf(err, config, phase);
      return null;
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): Okta org policies — MFA-enrollment policies (whether enrollment
   * is REQUIRED), password policies (real minimum length / complexity), and SAML IdPs for SSO.
   */
  private async fetchOktaPolicy(config: SaasConfig): Promise<SaasPolicyState | null> {
    const base = config.apiUrl.replace(/\/$/, "");

    const mfaPolicies = (await this.getJson(
      `${base}/api/v1/policies?type=MFA_ENROLL`,
      config,
      "okta:mfa-policies",
    )) as Array<Record<string, any>> | null;

    const pwdPolicies = (await this.getJson(
      `${base}/api/v1/policies?type=PASSWORD`,
      config,
      "okta:password-policies",
    )) as Array<Record<string, any>> | null;

    const idps = (await this.getJson(`${base}/api/v1/idps`, config, "okta:idps")) as Array<
      Record<string, any>
    > | null;

    // If every admin call failed, we have nothing real to assess.
    if (mfaPolicies === null && pwdPolicies === null && idps === null) return null;

    // MFA enrollment is enforced when an ACTIVE MFA_ENROLL policy requires enrollment.
    let mfaEnforcedAll: boolean | null = null;
    if (mfaPolicies !== null) {
      const active = mfaPolicies.filter((p) => String(p.status ?? "").toUpperCase() === "ACTIVE");
      mfaEnforcedAll = active.some(
        (p) => String(p.settings?.factors?.enroll?.self ?? "").toUpperCase() === "REQUIRED",
      );
    }

    // Okta does not separate admin-only MFA in MFA_ENROLL policy; org-wide enforcement covers admins.
    const mfaEnforcedAdmins = mfaEnforcedAll;

    // Strongest active password policy reported by the org.
    let passwordPolicyStrong: boolean | null = null;
    let passwordMinLength: number | null = null;
    if (pwdPolicies !== null) {
      const active = pwdPolicies.filter((p) => String(p.status ?? "").toUpperCase() === "ACTIVE");
      const lengths = active
        .map((p) => Number(p.settings?.password?.complexity?.minLength))
        .filter((n) => Number.isFinite(n)) as number[];
      passwordMinLength = lengths.length > 0 ? Math.max(...lengths) : null;
      const hasComplexity = active.some((p) => {
        const c = p.settings?.password?.complexity ?? {};
        return (
          Number(c.minLowerCase ?? 0) >= 1 &&
          Number(c.minUpperCase ?? 0) >= 1 &&
          Number(c.minNumber ?? 0) >= 1
        );
      });
      passwordPolicyStrong =
        passwordMinLength !== null
          ? passwordMinLength >= STRONG_PASSWORD_MIN_LENGTH && hasComplexity
          : null;
    }

    // SSO configured when at least one ACTIVE SAML/OIDC IdP exists.
    let ssoConfigured: boolean | null = null;
    if (idps !== null) {
      ssoConfigured = idps.some((i) => {
        const status = String(i.status ?? "").toUpperCase();
        const type = String(i.type ?? "").toUpperCase();
        return status === "ACTIVE" && (type === "SAML2" || type === "OIDC");
      });
    }

    return {
      mfaEnforcedAll,
      mfaEnforcedAdmins,
      passwordPolicyStrong,
      passwordMinLength,
      ssoConfigured,
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): Microsoft Entra ID — authenticationMethodsPolicy (MFA method
   * state), authorizationPolicy (self-service / password posture), and federated domains (SSO).
   */
  private async fetchEntraPolicy(config: SaasConfig): Promise<SaasPolicyState | null> {
    const base = config.apiUrl.replace(/\/$/, "");

    const authMethods = (await this.getJson(
      `${base}/v1.0/policies/authenticationMethodsPolicy`,
      config,
      "entra:auth-methods",
    )) as Record<string, any> | null;

    const authzPolicy = (await this.getJson(
      `${base}/v1.0/policies/authorizationPolicy`,
      config,
      "entra:authz-policy",
    )) as Record<string, any> | null;

    const domains = (await this.getJson(`${base}/v1.0/domains`, config, "entra:domains")) as {
      value?: Array<Record<string, any>>;
    } | null;

    if (authMethods === null && authzPolicy === null && domains === null) return null;

    // MFA enforced org-wide when a strong (non-SMS) authentication method is enabled for "all_users".
    let mfaEnforcedAll: boolean | null = null;
    if (authMethods !== null) {
      const configs = Array.isArray(authMethods.authenticationMethodConfigurations)
        ? authMethods.authenticationMethodConfigurations
        : [];
      mfaEnforcedAll = configs.some((m: Record<string, any>) => {
        const id = String(m.id ?? "").toLowerCase();
        const enabled = String(m.state ?? "").toLowerCase() === "enabled";
        const strong = id === "microsoftauthenticator" || id === "fido2" || id === "x509certificate";
        const includesAll = Array.isArray(m.includeTargets)
          ? m.includeTargets.some((t: Record<string, any>) => String(t.id ?? "") === "all_users")
          : false;
        return enabled && strong && includesAll;
      });
    }
    const mfaEnforcedAdmins = mfaEnforcedAll;

    // Entra does not expose tenant password length via this policy; complexity is enforced by
    // Microsoft's banned-password baseline. Report unknown rather than fabricate a number.
    const passwordPolicyStrong: boolean | null = null;
    const passwordMinLength: number | null = null;

    // SSO configured when at least one verified Federated domain exists.
    let ssoConfigured: boolean | null = null;
    if (domains !== null) {
      const list = Array.isArray(domains.value) ? domains.value : [];
      ssoConfigured = list.some(
        (d) =>
          String(d.authenticationType ?? "").toLowerCase() === "federated" && d.isVerified === true,
      );
    }

    return {
      mfaEnforcedAll,
      mfaEnforcedAdmins,
      passwordPolicyStrong,
      passwordMinLength,
      ssoConfigured,
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): Google Workspace — customer security settings (enforced 2SV),
   * domains (SSO), via the Admin SDK Directory API.
   */
  private async fetchGooglePolicy(config: SaasConfig): Promise<SaasPolicyState | null> {
    const base = config.apiUrl.replace(/\/$/, "");

    // Google Admin SDK uses "my_customer" alias for the caller's own account.
    const customer = (await this.getJson(
      `${base}/admin/directory/v1/customers/my_customer`,
      config,
      "google:customer",
    )) as Record<string, any> | null;

    const domains = (await this.getJson(
      `${base}/admin/directory/v1/customer/my_customer/domains`,
      config,
      "google:domains",
    )) as { domains?: Array<Record<string, any>> } | null;

    if (customer === null && domains === null) return null;

    // Real enforced-2SV flag from the customer security settings.
    let mfaEnforcedAll: boolean | null = null;
    if (customer !== null) {
      const enforced = customer.isEnrolledIn2Sv ?? customer.enforced2Sv ?? customer.isEnforcedIn2Sv;
      mfaEnforcedAll = typeof enforced === "boolean" ? enforced : null;
    }
    const mfaEnforcedAdmins = mfaEnforcedAll;

    // Google does not expose org password min-length via the customer resource; report unknown.
    const passwordPolicyStrong: boolean | null = null;
    const passwordMinLength: number | null = null;

    // SSO configured when a domain reports SSO / SAML enabled.
    let ssoConfigured: boolean | null = null;
    if (domains !== null) {
      const list = Array.isArray(domains.domains) ? domains.domains : [];
      ssoConfigured =
        list.length > 0 ? list.some((d) => d.ssoEnabled === true || d.samlSsoEnabled === true) : null;
    }

    return {
      mfaEnforcedAll,
      mfaEnforcedAdmins,
      passwordPolicyStrong,
      passwordMinLength,
      ssoConfigured,
    };
  }

  // -------------------------------------------------------------------------
  // Findings derived from the REAL policy state
  // -------------------------------------------------------------------------

  /**
   * REAL IMPL (BLACKFYRE 2026-06): all findings computed from the real org security policy.
   * A check that the provider did not report (null) produces NO finding (we never assume a
   * posture). Only an actual insecure value emits a finding.
   */
  private evaluate(config: SaasConfig, policy: SaasPolicyState): AgentFindingPayload[] {
    const findings: AgentFindingPayload[] = [];
    const providerName = this.providerName(config);

    // --- MFA not enforced for all users (real org policy) ---
    if (policy.mfaEnforcedAll === false) {
      findings.push({
        title: `MFA not enforced for all users (${providerName})`,
        description: `The ${providerName} organization security policy does not require multi-factor authentication for all user accounts. Without org-wide MFA enforcement, accounts protected only by a password are exposed to credential-stuffing and phishing. Enforce MFA for every user.`,
        severity: "critical",
        category: "identity",
        resourceType: "saas_mfa_policy",
        resourceId: `${config.provider}/mfa-enforcement`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_user_no_mfa"),
        source: this.type,
      });
    }

    // --- Admin accounts MFA not enforced (real policy; only when distinct/known) ---
    if (policy.mfaEnforcedAdmins === false) {
      findings.push({
        title: `MFA not enforced for administrator accounts (${providerName})`,
        description: `The ${providerName} security policy does not require MFA for administrative/privileged accounts. A compromised admin without MFA can lead to full tenant takeover. Enforce phishing-resistant MFA on all privileged roles.`,
        severity: "critical",
        category: "identity",
        resourceType: "saas_admin_mfa_policy",
        resourceId: `${config.provider}/admin-mfa-enforcement`,
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_root_access_keys"),
        source: this.type,
      });
    }

    // --- Weak password policy (real reported minimum length / complexity) ---
    if (policy.passwordPolicyStrong === false) {
      const lengthEvidence =
        policy.passwordMinLength !== null
          ? `The current minimum length is ${policy.passwordMinLength} characters.`
          : `Complexity requirements are below the baseline.`;
      findings.push({
        title: `Weak password policy (${providerName})`,
        description: `The ${providerName} password policy does not meet the minimum baseline (>= ${STRONG_PASSWORD_MIN_LENGTH} characters with mixed-case + numeric complexity). ${lengthEvidence} Strengthen the password policy to resist brute-force and guessing attacks.`,
        severity: "high",
        category: "identity",
        resourceType: "saas_password_policy",
        resourceId: `${config.provider}/password-policy`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_weak_password_policy"),
        source: this.type,
      });
    }

    // --- SSO not configured (real federation/IdP state) ---
    if (policy.ssoConfigured === false) {
      findings.push({
        title: `Single Sign-On not configured (${providerName})`,
        description: `The ${providerName} organization has no active SSO/SAML federation configured. Without centralized SSO, authentication and offboarding are managed per-application, increasing the risk of orphaned access and inconsistent MFA enforcement. Configure SSO with the corporate identity provider.`,
        severity: "medium",
        category: "identity",
        resourceType: "saas_sso_config",
        resourceId: `${config.provider}/sso`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_user_no_mfa"),
        source: this.type,
      });
    }

    // If the policy was readable but every assessable setting was already compliant or unknown,
    // there are simply no findings — that is a real (clean / partial) result, not a fabrication.
    return findings;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private warnIfSsrf(err: unknown, config: SaasConfig, phase: string): void {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — record blocked targets at warn so the
    // SSRF oracle attempt is auditable; no Fastify logger is reachable in agent context.
    if (err instanceof SsrfBlockedError) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "ssrf.blocked",
          agent: this.type,
          provider: config.provider,
          phase,
          reason: err.message,
        }),
      );
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): explicit, honest "not-assessed" finding emitted when the SaaS
   * org policy cannot be read. Carries NO fabricated posture — it tells the operator exactly why
   * the check could not run so the gap is visible rather than silently passing or canned.
   */
  private notAssessedFinding(config: SaasConfig, reason: string): AgentFindingPayload {
    const providerName = this.providerName(config);
    return {
      title: `SaaS security posture not assessed: ${providerName}`,
      description: `The SaaS auditor could not assess MFA enforcement, password policy, or SSO configuration for ${providerName} because ${reason}. No posture is reported (these values were intentionally NOT fabricated). Connect a credential with admin read scope (Okta read-only API token, Microsoft Graph Policy.Read.All + Domain.Read.All, or Google Workspace Admin SDK read-only) and re-run the scan.`,
      severity: "info",
      category: "identity",
      resourceType: "saas_assessment",
      resourceId: `${config.provider}/not-assessed`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("iam_user_no_mfa"),
      source: this.type,
    };
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    const config = this.parseConfig(credentialRef);
    if (!config.apiUrl || (!config.apiKey && !config.apiUrl.startsWith("vault://"))) return false;
    try {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — connectivity probe against the
      // tenant-controlled apiUrl routed through safeFetch so a HEAD request can't be used to
      // probe internal/metadata services. vault:// refs still fall through to the catch below.
      const res = await safeFetch(
        config.apiUrl,
        { headers: this.authHeader(config), method: "HEAD" },
        { timeoutMs: 5000 },
      );
      return res.status < 500;
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — log blocked probe targets at warn.
      if (err instanceof SsrfBlockedError && !config.apiUrl.startsWith("vault://")) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "ssrf.blocked",
            agent: this.type,
            provider: config.provider,
            phase: "testConnection",
            reason: err.message,
          }),
        );
      }
      return config.apiUrl.startsWith("vault://");
    }
  }
}
