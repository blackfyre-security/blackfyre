/**
 * services/oidc-service.ts
 *
 * REAL IMPL (BLACKFYRE 2026-06): real, end-to-end OAuth2 / OpenID Connect (OIDC)
 * for enterprise SSO — Okta, Microsoft Entra (Azure AD) AND Google. Previously
 * POST /api/auth/sso accepted a `provider` param but only `google` worked (env
 * client creds, no discovery, no JWKS verify); every other provider returned 501.
 *
 * This service implements the full Authorization-Code + PKCE flow against any
 * spec-compliant OIDC provider:
 *
 *   1. discover()           GET <issuer>/.well-known/openid-configuration via safeFetch.
 *   2. buildAuthorizationUrl()  authorization endpoint URL with state + nonce + PKCE
 *                               (S256 code_challenge).
 *   3. exchangeCode()       POST <token_endpoint> via safeFetch with the tenant's
 *                           client creds + code_verifier; returns the raw token set.
 *   4. verifyIdToken()      verify the ID token with jose against the provider JWKS
 *                           (jwks_uri from discovery, fetched via safeFetch), checking
 *                           iss / aud / exp AND nonce.
 *   5. mapClaims()          map the provider-specific identity claims to {subject,email,name}
 *                           (Entra: oid / preferred_username, Okta: sub / email,
 *                           Google: sub / email).
 *
 * SSRF: ALL outbound HTTP (discovery, token exchange, JWKS) goes through
 * lib/safe-fetch.ts, so a malicious tenant-supplied issuer can never be used to
 * reach internal / cloud-metadata endpoints. The JWKS is fetched via safeFetch and
 * verified with jose's createLocalJWKSet (NOT createRemoteJWKSet, whose internal
 * http.get would bypass our SSRF chokepoint).
 *
 * LOGGING: structured pino only. Tokens, assertions, client secrets, code, and
 * code_verifier are NEVER logged.
 */

import { and, eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import {
  createLocalJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from "jose";
import type { FastifyBaseLogger } from "fastify";
import { users } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { badRequest } from "../utils/errors.js";
import { safeFetch, assertPublicUrl } from "../lib/safe-fetch.js";
import type { UserRole } from "@blackfyre/shared";

// ---------------------------------------------------------------------------
// Provider model
// ---------------------------------------------------------------------------

/** Canonical OIDC providers BLACKFYRE supports. */
export type OidcProvider = "google" | "okta" | "entra";

/**
 * Normalise a request-supplied provider string to a canonical OidcProvider, or
 * null when unsupported. Accepts the common aliases enterprises use so a config
 * keyed "azure_ad" still resolves to "entra".
 */
export function normalizeProvider(raw: string | undefined): OidcProvider | null {
  if (!raw) return null;
  const p = raw.trim().toLowerCase();
  if (p === "google" || p === "google_workspace") return "google";
  if (p === "okta") return "okta";
  if (p === "entra" || p === "azure" || p === "azure_ad" || p === "microsoft" || p === "azuread") {
    return "entra";
  }
  return null;
}

/** Tenant OIDC client config as persisted in oidc_provider_configs. */
export interface OidcClientConfig {
  tenantId: string;
  provider: OidcProvider;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  defaultRole: UserRole;
  autoProvision: boolean;
  enabled: boolean;
}

/** Subset of the OIDC discovery document we depend on. */
export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  code_challenge_methods_supported?: string[];
}

/** Identity resolved from a verified ID token, before tenant mapping. */
export interface ResolvedIdentity {
  /** Stable provider subject identifier (Entra oid, else `sub`). */
  subject: string;
  email: string;
  name: string;
}

/** Result of a successful PKCE authorization-URL build. The secrets must be
 * stored server-side (Redis) keyed by `state` and replayed on callback. */
export interface AuthorizationRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Token-endpoint response (only fields we consume; never logged). */
interface OidcTokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}

// Default OIDC scopes when a tenant config omits them.
const DEFAULT_SCOPES = "openid email profile";
// Bound outbound discovery/token/JWKS calls.
const OUTBOUND_TIMEOUT_MS = 8_000;
// Allow small clock skew on exp/iat checks (seconds).
const CLOCK_TOLERANCE_SEC = 60;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OidcService {
  /**
   * @param superDb owner pool (bypasses RLS). SSO start/callback run pre-auth so
   *   there is no tenant context to bind; we read configs cross-tenant and filter
   *   tenant_id by hand (same pattern as auth.ts / saml-service.ts).
   * @param log optional pino logger for structured, secret-free diagnostics.
   */
  constructor(
    private readonly superDb: Db,
    private readonly log?: FastifyBaseLogger,
  ) {}

  // -- config -----------------------------------------------------------------

  /**
   * Load the enabled OIDC client config for (tenant, provider). Returns null when
   * no row exists or it is disabled — the caller maps that to a 400/503 config
   * error (NOT 501). Reads via parameterized SQL on the owner pool.
   */
  async getConfig(tenantId: string, provider: OidcProvider): Promise<OidcClientConfig | null> {
    const rows = (await this.superDb.execute(sql`
      SELECT tenant_id, provider, issuer, client_id, client_secret, redirect_uri,
             scopes, default_role, auto_provision, enabled
      FROM oidc_provider_configs
      WHERE tenant_id = ${tenantId} AND provider = ${provider}
      LIMIT 1
    `)) as unknown as Array<{
      tenant_id: string;
      provider: string;
      issuer: string;
      client_id: string;
      client_secret: string;
      redirect_uri: string;
      scopes: string;
      default_role: string;
      auto_provision: boolean;
      enabled: boolean;
    }>;

    const row = rows[0];
    if (!row || !row.enabled) return null;

    return {
      tenantId: row.tenant_id,
      provider: provider,
      issuer: row.issuer,
      clientId: row.client_id,
      clientSecret: row.client_secret,
      redirectUri: row.redirect_uri,
      scopes: row.scopes || DEFAULT_SCOPES,
      defaultRole: row.default_role as UserRole,
      autoProvision: row.auto_provision,
      enabled: row.enabled,
    };
  }

  /**
   * Upsert a tenant OIDC client config via parameterized SQL on the owner pool.
   * Used by the admin/SSO-config surface (and tests) to wire a provider. The
   * client secret is persisted but never logged/returned.
   */
  async saveConfig(input: OidcClientConfig): Promise<void> {
    await this.superDb.execute(sql`
      INSERT INTO oidc_provider_configs (
        tenant_id, provider, issuer, client_id, client_secret, redirect_uri,
        scopes, default_role, auto_provision, enabled, updated_at
      ) VALUES (
        ${input.tenantId}, ${input.provider}, ${input.issuer}, ${input.clientId},
        ${input.clientSecret}, ${input.redirectUri}, ${input.scopes || DEFAULT_SCOPES},
        ${input.defaultRole}::user_role, ${input.autoProvision}, ${input.enabled}, now()
      )
      ON CONFLICT (tenant_id, provider) DO UPDATE SET
        issuer = EXCLUDED.issuer,
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        redirect_uri = EXCLUDED.redirect_uri,
        scopes = EXCLUDED.scopes,
        default_role = EXCLUDED.default_role,
        auto_provision = EXCLUDED.auto_provision,
        enabled = EXCLUDED.enabled,
        updated_at = now()
    `);

    this.log?.info(
      { event: "auth.oidc.config.persisted", tenantId: input.tenantId, provider: input.provider, enabled: input.enabled },
      "Persisted tenant OIDC provider config",
    );
  }

  // -- discovery --------------------------------------------------------------

  /**
   * Fetch the provider's OIDC discovery document. SSRF-validates the issuer host
   * first, then GETs <issuer>/.well-known/openid-configuration via safeFetch.
   */
  async discover(issuer: string): Promise<OidcDiscovery> {
    const base = issuer.replace(/\/+$/, "");
    const discoveryUrl = `${base}/.well-known/openid-configuration`;

    // Reject internal/metadata targets at the issuer level before any request.
    await assertPublicUrl(discoveryUrl, this.log);

    let res: Response;
    try {
      res = await safeFetch(
        discoveryUrl,
        { method: "GET", headers: { Accept: "application/json" } },
        { timeoutMs: OUTBOUND_TIMEOUT_MS, log: this.log },
      );
    } catch (err) {
      this.log?.warn(
        { event: "auth.oidc.discovery.fetch_failed", issuer: base, reason: errName(err) },
        "OIDC discovery request failed",
      );
      throw badRequest("OIDC_DISCOVERY_FAILED", "Could not reach the SSO provider's discovery endpoint");
    }

    if (!res.ok) {
      this.log?.warn(
        { event: "auth.oidc.discovery.bad_status", issuer: base, status: res.status },
        "OIDC discovery returned non-200",
      );
      throw badRequest("OIDC_DISCOVERY_FAILED", "SSO provider discovery endpoint returned an error");
    }

    const doc = (await res.json()) as Partial<OidcDiscovery>;
    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri || !doc.issuer) {
      throw badRequest("OIDC_DISCOVERY_INVALID", "SSO provider discovery document is missing required fields");
    }

    // The discovery `issuer` is the canonical value ID tokens will carry; trust it
    // (not the configured base) for later iss comparison. Validate endpoint hosts.
    await Promise.all([
      assertPublicUrl(doc.authorization_endpoint, this.log),
      assertPublicUrl(doc.token_endpoint, this.log),
      assertPublicUrl(doc.jwks_uri, this.log),
    ]);

    return {
      issuer: doc.issuer,
      authorization_endpoint: doc.authorization_endpoint,
      token_endpoint: doc.token_endpoint,
      jwks_uri: doc.jwks_uri,
      userinfo_endpoint: doc.userinfo_endpoint,
      code_challenge_methods_supported: doc.code_challenge_methods_supported,
    };
  }

  // -- authorization URL (state + nonce + PKCE) -------------------------------

  /**
   * Build the authorization-endpoint redirect URL with state, nonce and PKCE
   * (S256). The returned `state`, `nonce` and `codeVerifier` MUST be persisted
   * server-side keyed by `state` and replayed on the callback so the callback can
   * (a) validate the CSRF state, (b) bind the nonce into ID-token verification,
   * and (c) supply the PKCE code_verifier to the token exchange.
   */
  async buildAuthorizationUrl(config: OidcClientConfig): Promise<AuthorizationRequest> {
    const discovery = await this.discover(config.issuer);

    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes || DEFAULT_SCOPES,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Entra requires response_mode=query for code flow with a query redirect; it is
    // a spec-compliant param accepted (and ignored where defaulted) by Okta/Google.
    params.set("response_mode", "query");

    const url = `${discovery.authorization_endpoint}?${params.toString()}`;
    return { url, state, nonce, codeVerifier };
  }

  // -- token exchange ---------------------------------------------------------

  /**
   * Exchange an authorization `code` for tokens at the provider token endpoint
   * (POST via safeFetch). Sends the tenant client creds + PKCE code_verifier.
   * Returns the raw token set (id_token consumed by verifyIdToken).
   */
  async exchangeCode(
    config: OidcClientConfig,
    discovery: OidcDiscovery,
    code: string,
    codeVerifier: string,
  ): Promise<OidcTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: codeVerifier,
    });

    let res: Response;
    try {
      res = await safeFetch(
        discovery.token_endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body,
        },
        { timeoutMs: OUTBOUND_TIMEOUT_MS, log: this.log },
      );
    } catch (err) {
      this.log?.warn(
        { event: "auth.oidc.token.fetch_failed", provider: config.provider, reason: errName(err) },
        "OIDC token exchange request failed",
      );
      throw badRequest("OIDC_TOKEN_EXCHANGE_FAILED", "Could not complete the SSO token exchange");
    }

    if (!res.ok) {
      // The error body can contain the OAuth error code (e.g. invalid_grant) but
      // may echo back request material — log only the status, never the body.
      this.log?.warn(
        { event: "auth.oidc.token.bad_status", provider: config.provider, status: res.status },
        "OIDC token endpoint returned an error",
      );
      throw badRequest("OIDC_TOKEN_EXCHANGE_FAILED", "SSO token exchange was rejected by the provider");
    }

    const tokens = (await res.json()) as OidcTokenResponse;
    if (!tokens.id_token) {
      throw badRequest("OIDC_NO_ID_TOKEN", "SSO provider did not return an ID token");
    }
    return tokens;
  }

  // -- ID-token verification --------------------------------------------------

  /**
   * Verify the ID token against the provider JWKS (fetched via safeFetch from the
   * discovery jwks_uri) and the expected iss / aud / nonce. Returns the verified
   * claims. Throws a 400 on any verification failure (signature, iss, aud, exp,
   * nonce). The token itself is never logged.
   */
  async verifyIdToken(
    config: OidcClientConfig,
    discovery: OidcDiscovery,
    idToken: string,
    expectedNonce: string,
  ): Promise<JWTPayload> {
    // Pre-flight header check so a malformed token fails fast and never reaches JWKS.
    try {
      decodeProtectedHeader(idToken);
    } catch {
      throw badRequest("OIDC_IDTOKEN_MALFORMED", "SSO ID token is malformed");
    }

    const jwks = await this.fetchJwks(discovery.jwks_uri);
    const keySet = createLocalJWKSet(jwks);

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(idToken, keySet, {
        issuer: discovery.issuer,
        audience: config.clientId,
        clockTolerance: CLOCK_TOLERANCE_SEC,
      });
      payload = result.payload;
    } catch (err) {
      this.log?.warn(
        { event: "auth.oidc.idtoken.verify_failed", provider: config.provider, reason: errName(err) },
        "OIDC ID token verification failed",
      );
      throw badRequest("OIDC_IDTOKEN_INVALID", "SSO ID token verification failed");
    }

    // Bind the nonce: constant-time-ish equality on the replayed value.
    const tokenNonce = typeof payload.nonce === "string" ? payload.nonce : "";
    if (!expectedNonce || tokenNonce !== expectedNonce) {
      this.log?.warn(
        { event: "auth.oidc.idtoken.nonce_mismatch", provider: config.provider },
        "OIDC ID token nonce mismatch — possible replay",
      );
      throw badRequest("OIDC_NONCE_MISMATCH", "SSO ID token nonce did not match");
    }

    return payload;
  }

  /** Fetch + parse the provider JWKS via safeFetch (SSRF-safe). */
  private async fetchJwks(jwksUri: string): Promise<JSONWebKeySet> {
    let res: Response;
    try {
      res = await safeFetch(
        jwksUri,
        { method: "GET", headers: { Accept: "application/json" } },
        { timeoutMs: OUTBOUND_TIMEOUT_MS, log: this.log },
      );
    } catch (err) {
      this.log?.warn(
        { event: "auth.oidc.jwks.fetch_failed", reason: errName(err) },
        "OIDC JWKS fetch failed",
      );
      throw badRequest("OIDC_JWKS_FAILED", "Could not fetch the SSO provider signing keys");
    }
    if (!res.ok) {
      this.log?.warn({ event: "auth.oidc.jwks.bad_status", status: res.status }, "OIDC JWKS returned non-200");
      throw badRequest("OIDC_JWKS_FAILED", "SSO provider signing-key endpoint returned an error");
    }
    const jwks = (await res.json()) as JSONWebKeySet;
    if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      throw badRequest("OIDC_JWKS_EMPTY", "SSO provider returned no signing keys");
    }
    return jwks;
  }

  // -- claim mapping ----------------------------------------------------------

  /**
   * Map provider-specific identity claims to a canonical identity.
   *   - Entra (Azure AD): subject = `oid` (immutable object id), email/login =
   *     `preferred_username` (falls back to `email` / `upn`).
   *   - Okta: subject = `sub`, email = `email` (falls back to preferred_username).
   *   - Google: subject = `sub`, email = `email`.
   * Email is required (it is how we resolve / provision the tenant user).
   */
  mapClaims(provider: OidcProvider, claims: JWTPayload): ResolvedIdentity {
    const asStr = (v: unknown): string | undefined =>
      typeof v === "string" && v.length > 0 ? v : undefined;

    let subject: string | undefined;
    let email: string | undefined;

    if (provider === "entra") {
      subject = asStr(claims.oid) ?? asStr(claims.sub);
      email =
        asStr(claims.email) ??
        asStr(claims.preferred_username) ??
        asStr((claims as Record<string, unknown>).upn);
    } else {
      // Okta + Google both use sub + email.
      subject = asStr(claims.sub);
      email = asStr(claims.email) ?? asStr(claims.preferred_username);
    }

    if (!subject) throw badRequest("OIDC_NO_SUBJECT", "SSO ID token has no subject claim");
    if (!email || !email.includes("@")) {
      throw badRequest("OIDC_NO_EMAIL", "SSO ID token did not include a usable email claim");
    }

    const name =
      asStr(claims.name) ??
      asStr((claims as Record<string, unknown>).given_name) ??
      email.split("@")[0];

    return { subject, email: email.toLowerCase(), name };
  }

  // -- user provisioning / login ---------------------------------------------

  /**
   * Resolve the SSO identity to a tenant user. Looks up by (tenantId, email);
   * when found, refreshes lastLogin. When not found and auto_provision is enabled,
   * JIT-creates an SSO-only user with the config's default role and an
   * unusable (non-password) hash. When auto_provision is disabled and no user
   * exists, throws a 403 so a stranger cannot mint an account.
   *
   * Runs on the owner pool with an explicit tenant_id predicate (pre-auth path).
   */
  async provisionOrLoginUser(
    config: OidcClientConfig,
    identity: ResolvedIdentity,
  ): Promise<{ id: string; email: string; name: string; role: UserRole; tenantId: string; mfaEnabled: boolean }> {
    const [existing] = await this.superDb
      .select()
      .from(users)
      .where(and(eq(users.email, identity.email), eq(users.tenantId, config.tenantId)))
      .limit(1);

    if (existing) {
      await this.superDb.update(users).set({ lastLogin: new Date() }).where(eq(users.id, existing.id));
      this.log?.info(
        { event: "auth.oidc.login", tenantId: config.tenantId, provider: config.provider, userId: existing.id },
        "OIDC SSO login for existing user",
      );
      return {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role as UserRole,
        tenantId: existing.tenantId,
        mfaEnabled: existing.mfaEnabled,
      };
    }

    if (!config.autoProvision) {
      this.log?.warn(
        { event: "auth.oidc.provision_denied", tenantId: config.tenantId, provider: config.provider },
        "OIDC SSO user not found and auto-provision disabled",
      );
      throw badRequest("SSO_ACCOUNT_NOT_FOUND", "No account for this identity. Contact your admin to be invited.");
    }

    // SSO-only account: password hash is a non-verifiable placeholder so the
    // local login path can never authenticate it.
    const placeholderHash = `oidc:${config.provider}:${crypto.randomUUID()}`;
    const [created] = await this.superDb
      .insert(users)
      .values({
        tenantId: config.tenantId,
        email: identity.email,
        name: identity.name,
        passwordHash: placeholderHash,
        role: config.defaultRole,
        lastLogin: new Date(),
      })
      .returning();

    this.log?.info(
      { event: "auth.oidc.provisioned", tenantId: config.tenantId, provider: config.provider, userId: created.id },
      "OIDC SSO auto-provisioned new user",
    );

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role as UserRole,
      tenantId: created.tenantId,
      mfaEnabled: created.mfaEnabled,
    };
  }
}

/** Extract a safe, non-secret error label for structured logs. */
function errName(err: unknown): string {
  if (err instanceof Error) return err.name || "Error";
  return "Error";
}
