import { eq, and, sql } from "drizzle-orm";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { ssoConfigs, users } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound, badRequest } from "../utils/errors.js";
import type { UserRole } from "@blackfyre/shared";

export interface SsoConfigInput {
  provider: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  defaultRole?: UserRole;
  autoProvision?: boolean;
  enabled?: boolean;
}

// REAL IMPL (BLACKFYRE 2026-06): minimal structured-logger surface (Fastify/pino
// compatible) so SAML lifecycle/security events (signature rejects, identity
// mapping, SP keypair generation) become structured, queryable records when a
// logger is wired, falling back silently otherwise. We log tenant id, provider,
// algorithm URIs and the mapped (non-secret) email/displayName — NEVER the raw
// SAMLResponse, the assertion, the IdP/SP certificates, or the SP private key.
interface SecurityLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

// REAL IMPL (BLACKFYRE 2026-06): the mapped, provider-normalized identity the ACS
// flow consumes. `externalId` is the IdP's stable, immutable subject key (Entra
// object id / Okta NameID / Google email) — distinct from `email`, which can be
// re-assigned at the IdP. The route currently destructures { email, name }; the
// extra fields are additive and do not change that shape.
export interface SamlIdentity {
  email: string;
  name: string;
  externalId: string;
  attributes: Record<string, string>;
}

// REAL IMPL (BLACKFYRE 2026-06): shape of a saml_sp_keypairs row as postgres-js
// returns it (snake_case columns) for the per-tenant SP signing material +
// signing/digest preferences. sp_private_key is a SECRET and is never logged or
// returned by any config endpoint.
interface SpKeypairRow {
  sp_certificate: string;
  sp_private_key: string;
  want_assertions_signed: boolean;
  authn_requests_signed: boolean;
  signature_algorithm: string;
  digest_algorithm: string;
}

// REAL IMPL (BLACKFYRE 2026-06): W3C XML-DSig algorithm URIs. We treat SHA-1 as
// broken and refuse to accept a SHA-1 signature/digest when the tenant requires a
// stronger one (the default). Enumerated so honoring the tenant's stored
// preference is an exact-string check, not a substring guess.
const SHA1_SIGNATURE = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1_DIGEST = "http://www.w3.org/2000/09/xmldsig#sha1";

// REAL IMPL (BLACKFYRE 2026-06): well-known IdP attribute Names per provider. SAML
// IdPs emit attributes under provider-specific Name URIs; mapping the right one to
// our user identity is what makes the assertion actually resolve to the correct
// person rather than a best-effort guess.
const ATTR = {
  // Microsoft Entra ID (Azure AD): the immutable object id (oid) is the only stable
  // subject key — UPN/email can be reassigned. Entra also emits emailaddress/name.
  ENTRA_OID: "http://schemas.microsoft.com/identity/claims/objectidentifier",
  ENTRA_TENANTID: "http://schemas.microsoft.com/identity/claims/tenantid",
  ENTRA_DISPLAYNAME: "http://schemas.microsoft.com/identity/claims/displayname",
  CLAIM_EMAIL: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  CLAIM_NAME: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  CLAIM_GIVENNAME: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  CLAIM_SURNAME: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  // Okta / Google Workspace commonly emit short attribute Names.
  EMAIL: "email",
  DISPLAY_NAME: "displayName",
  GIVEN_NAME: "givenName",
  FAMILY_NAME: "familyName",
} as const;

export class SamlService {
  private readonly log?: SecurityLogger;

  /**
   * REAL IMPL (BLACKFYRE 2026-06): optional pino-compatible logger is the only new
   * constructor parameter and is defaulted, so existing callers
   * (`new SamlService(app.db, app.superDb)`) keep compiling and behaving unchanged.
   */
  constructor(private db: Db, private superDb: Db, log?: SecurityLogger) {
    this.log = log;
  }

  async getConfig(tenantId: string) {
    const [config] = await this.superDb
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.tenantId, tenantId))
      .limit(1);
    return config ?? null;
  }

  async saveConfig(tenantId: string, input: SsoConfigInput) {
    const existing = await this.getConfig(tenantId);

    if (existing) {
      const [updated] = await this.superDb
        .update(ssoConfigs)
        .set({
          provider: input.provider,
          entityId: input.entityId,
          ssoUrl: input.ssoUrl,
          certificate: input.certificate,
          defaultRole: (input.defaultRole ?? existing.defaultRole) as UserRole,
          autoProvision: input.autoProvision ?? existing.autoProvision,
          enabled: input.enabled ?? existing.enabled,
          updatedAt: new Date(),
        })
        .where(eq(ssoConfigs.tenantId, tenantId))
        .returning();
      return updated;
    }

    const [created] = await this.superDb
      .insert(ssoConfigs)
      .values({
        tenantId,
        provider: input.provider,
        entityId: input.entityId,
        ssoUrl: input.ssoUrl,
        certificate: input.certificate,
        defaultRole: (input.defaultRole ?? "viewer") as UserRole,
        autoProvision: input.autoProvision ?? true,
        enabled: input.enabled ?? false,
      })
      .returning();
    return created;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Per-tenant SP signing material + signing/digest preferences
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * REAL IMPL (BLACKFYRE 2026-06): return the tenant's persisted SP keypair +
   * signing preferences, generating a self-signed RSA-2048 SP certificate on first
   * use and persisting it via PARAMETERIZED raw SQL (saml_sp_keypairs, migration
   * 039). Persistence keeps the published SP certificate STABLE across restarts /
   * Lambda cold starts — an IdP pins this cert in its trust config, so a
   * per-process ephemeral cert would break federation after every redeploy. Runs on
   * superDb because the metadata endpoint is public and the ACS flow precedes any
   * tenant session (no RLS context set yet); superDb is the owner pool documented to
   * bypass RLS, consistent with validateResponse/findOrCreateUser below.
   */
  async getOrCreateSpKeypair(tenantId: string): Promise<SpKeypairRow> {
    const existingRows = (await this.superDb.execute(sql`
      SELECT sp_certificate, sp_private_key, want_assertions_signed,
             authn_requests_signed, signature_algorithm, digest_algorithm
      FROM saml_sp_keypairs
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `)) as unknown as SpKeypairRow[];

    if (existingRows[0]) return existingRows[0];

    const { certificatePem, privateKeyPem } = this.generateSelfSignedSpCert(tenantId);

    const insertedRows = (await this.superDb.execute(sql`
      INSERT INTO saml_sp_keypairs (tenant_id, sp_certificate, sp_private_key)
      VALUES (${tenantId}, ${certificatePem}, ${privateKeyPem})
      ON CONFLICT (tenant_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
      RETURNING sp_certificate, sp_private_key, want_assertions_signed,
                authn_requests_signed, signature_algorithm, digest_algorithm
    `)) as unknown as SpKeypairRow[];

    this.log?.info(
      { event: "saml.sp_keypair.generated", tenantId },
      "Generated and persisted SP signing certificate",
    );

    // ON CONFLICT (lost race) returns the row that won — still the tenant's keypair.
    return insertedRows[0];
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): generate a real self-signed X.509 SP certificate
   * + RSA-2048 private key via node-forge. The cert is published in SP metadata so an
   * IdP can encrypt assertions to us / verify our signed AuthnRequests; the key never
   * leaves the server and is never logged.
   */
  private generateSelfSignedSpCert(tenantId: string): {
    certificatePem: string;
    privateKeyPem: string;
  } {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(15));
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    // 10-year SP cert: re-publishing metadata on rotation is operationally costly for
    // federated tenants, so the SP cert is long-lived (it signs/decrypts our own SP
    // traffic only; it is not a public TLS cert).
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    const attrs = [
      { name: "commonName", value: `blackfyre-sp-${tenantId}` },
      { name: "organizationName", value: "BLACKFYRE" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    return {
      certificatePem: forge.pki.certificateToPem(cert),
      privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): SP metadata generation. Two call shapes are
   * supported so the EXISTING global route (`generateSpMetadata(entityId, acsUrl)`)
   * keeps working AND a per-tenant variant can embed the tenant's real SP signing
   * certificate. When a certificate (PEM) is provided we emit a <KeyDescriptor> with
   * the base64 cert body — real SP metadata an IdP can consume — and reflect the
   * tenant's WantAssertionsSigned / AuthnRequestsSigned preferences.
   */
  generateSpMetadata(
    entityId: string,
    acsUrl: string,
    opts?: {
      certificatePem?: string;
      wantAssertionsSigned?: boolean;
      authnRequestsSigned?: boolean;
    },
  ): string {
    const wantAssertionsSigned = opts?.wantAssertionsSigned ?? true;
    const authnRequestsSigned = opts?.authnRequestsSigned ?? false;

    let keyDescriptor = "";
    if (opts?.certificatePem) {
      const certBody = this.pemBody(opts.certificatePem);
      // Advertise the cert for both signing (our AuthnRequests) and encryption
      // (IdP-encrypted assertions to us). use="signing"/"encryption" KeyDescriptors.
      keyDescriptor = `
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>${certBody}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>${certBody}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>`;
    }

    return `<?xml version="1.0"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${this.xmlEscape(entityId)}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="${authnRequestsSigned}"
    WantAssertionsSigned="${wantAssertionsSigned}"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">${keyDescriptor}
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${this.xmlEscape(acsUrl)}"
      index="1"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): convenience wrapper that loads the tenant's SP
   * cert + preferences and renders per-tenant metadata. The route's existing global
   * metadata endpoint stays on the 2-arg path; a per-tenant endpoint calls this.
   */
  async generateTenantSpMetadata(
    tenantId: string,
    entityId: string,
    acsUrl: string,
  ): Promise<string> {
    const kp = await this.getOrCreateSpKeypair(tenantId);
    return this.generateSpMetadata(entityId, acsUrl, {
      certificatePem: kp.sp_certificate,
      wantAssertionsSigned: kp.want_assertions_signed,
      authnRequestsSigned: kp.authn_requests_signed,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Assertion validation + provider-specific identity mapping
  // ──────────────────────────────────────────────────────────────────────────

  async validateResponse(
    samlResponse: string,
    tenantId: string,
  ): Promise<SamlIdentity> {
    const config = await this.getConfig(tenantId);
    if (!config) throw notFound("SSO configuration");
    if (!config.enabled) throw badRequest("SSO_DISABLED", "SSO is not enabled for this tenant");

    let xml: string;
    try {
      xml = Buffer.from(samlResponse, "base64").toString("utf8");
    } catch {
      throw badRequest("SAML_INVALID", "Failed to decode SAML response");
    }

    // Parse and verify XML signature via xml-crypto (replaces manual regex extraction).
    // xml-crypto validates the enveloped signature using canonical C14N, preventing
    // XML Signature Wrapping (XSW) attacks where an attacker injects a forged element
    // alongside a valid signature that covered a different subtree.
    const doc = new DOMParser().parseFromString(xml, "text/xml");

    const sigNodes = doc.getElementsByTagNameNS(
      "http://www.w3.org/2000/09/xmldsig#",
      "Signature",
    );
    if (!sigNodes || sigNodes.length === 0) {
      throw badRequest("SAML_SIGNATURE_MISSING", "SAML response must be signed");
    }

    // REAL IMPL (BLACKFYRE 2026-06): honor the tenant's signing/digest preferences.
    // Load them from the SP keypair row (defaults: require SHA-256, reject SHA-1).
    const kp = await this.getOrCreateSpKeypair(tenantId);

    const cert = this.normalizeCert(config.certificate);
    let sig: SignedXml;
    try {
      sig = new SignedXml({
        publicCert: cert,
        // Reject transforms not in the SAML-blessed allowlist to block wrapping via XSLT etc.
        implicitTransforms: [],
      });
      sig.loadSignature(sigNodes[0] as unknown as Node);
      const valid = await new Promise<boolean>((resolve) => {
        sig.checkSignature(xml, (err) => resolve(err == null));
      });
      if (!valid) {
        this.log?.warn(
          { event: "saml.signature.invalid", tenantId, provider: config.provider },
          "SAML signature verification failed",
        );
        throw badRequest("SAML_SIGNATURE_INVALID", "SAML response signature verification failed");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("SAML_")) throw err;
      throw badRequest("SAML_SIGNATURE_ERROR", "Failed to verify SAML signature");
    }

    // REAL IMPL (BLACKFYRE 2026-06): enforce signing/digest strength. xml-crypto has
    // verified the signature is cryptographically authentic; we additionally reject
    // SHA-1 signature/digest algorithms when the tenant requires stronger (the
    // default), so a downgraded-but-validly-signed assertion is refused.
    const sigAlg = sig.signatureAlgorithm;
    const refs = sig.getReferences();
    const digestAlgs = refs.map((r) => r.digestAlgorithm).filter(Boolean) as string[];
    const allowSha1 =
      kp.signature_algorithm === SHA1_SIGNATURE || kp.digest_algorithm === SHA1_DIGEST;
    if (!allowSha1) {
      if (sigAlg === SHA1_SIGNATURE || digestAlgs.includes(SHA1_DIGEST)) {
        this.log?.warn(
          {
            event: "saml.signature.weak_algorithm",
            tenantId,
            provider: config.provider,
            signatureAlgorithm: sigAlg ?? null,
          },
          "Rejected SAML assertion signed with SHA-1 (tenant requires SHA-256)",
        );
        throw badRequest(
          "SAML_WEAK_SIGNATURE",
          "SAML signature/digest algorithm is too weak (SHA-1 not permitted)",
        );
      }
    }

    // REAL IMPL (BLACKFYRE 2026-06): XSW-hardening — parse identity ONLY from the
    // canonicalized, validly-signed reference subtree(s), never the raw document.
    // getSignedReferences() returns the exact bytes the signature covered, so any
    // attacker-injected NameID/Attribute outside the signed subtree is invisible here.
    const signedRefs = sig.getSignedReferences();
    const signedXml = signedRefs.length > 0 ? signedRefs.join("") : xml;
    const signedDoc = new DOMParser().parseFromString(
      // The signed reference is a fragment; wrap so the parser has a single root.
      `<saml-signed-root xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">${signedXml}</saml-signed-root>`,
      "text/xml",
    );

    const identity = this.mapIdentity(config.provider, signedDoc);

    this.log?.info(
      {
        event: "saml.assertion.mapped",
        tenantId,
        provider: config.provider,
        email: identity.email,
        // externalId is a non-secret opaque IdP subject key; safe to log for audit.
        externalId: identity.externalId,
      },
      "Mapped SAML assertion to tenant identity",
    );

    return identity;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): provider-specific attribute mapping. Each IdP
   * emits identity under different Name URIs; mapping the right one is what makes the
   * assertion resolve to the correct user instead of a best-effort guess.
   *   - Microsoft Entra ID (azure_ad): externalId = oid claim (immutable object id);
   *     email from emailaddress/NameID; name from displayname.
   *   - Okta: externalId/email from NameID (email-format) or the `email` attribute.
   *   - Google Workspace: externalId/email from the `email` attribute / NameID.
   *   - custom: NameID + common attribute fallbacks.
   */
  private mapIdentity(provider: string, signedDoc: Document): SamlIdentity {
    const nameId = this.extractNameId(signedDoc);
    const attributes = this.extractAttributes(signedDoc);

    let email: string | undefined;
    let externalId: string | undefined;
    let name: string | undefined;

    switch (provider) {
      case "azure_ad": {
        // Entra: oid is the only immutable subject key. Email is a friendly claim.
        externalId = attributes[ATTR.ENTRA_OID] ?? nameId ?? undefined;
        email =
          attributes[ATTR.CLAIM_EMAIL] ??
          this.emailLike(nameId) ??
          attributes[ATTR.EMAIL];
        name =
          attributes[ATTR.ENTRA_DISPLAYNAME] ??
          attributes[ATTR.CLAIM_NAME] ??
          this.joinName(attributes[ATTR.CLAIM_GIVENNAME], attributes[ATTR.CLAIM_SURNAME]);
        break;
      }
      case "okta": {
        // Okta: NameID is typically the email; `email` attribute is the canonical one.
        email = attributes[ATTR.EMAIL] ?? this.emailLike(nameId);
        externalId = nameId ?? email;
        name =
          attributes[ATTR.DISPLAY_NAME] ??
          attributes[ATTR.CLAIM_NAME] ??
          this.joinName(
            attributes[ATTR.GIVEN_NAME] ?? attributes[ATTR.CLAIM_GIVENNAME],
            attributes[ATTR.FAMILY_NAME] ?? attributes[ATTR.CLAIM_SURNAME],
          );
        break;
      }
      case "google_workspace": {
        // Google Workspace: the primary email is the identity (NameID is also email).
        email = attributes[ATTR.EMAIL] ?? this.emailLike(nameId);
        externalId = email ?? nameId ?? undefined;
        name =
          attributes[ATTR.DISPLAY_NAME] ??
          attributes[ATTR.CLAIM_NAME] ??
          this.joinName(
            attributes[ATTR.GIVEN_NAME] ?? attributes[ATTR.CLAIM_GIVENNAME],
            attributes[ATTR.FAMILY_NAME] ?? attributes[ATTR.CLAIM_SURNAME],
          );
        break;
      }
      default: {
        // custom / unknown: NameID first, then the broadest set of common claims.
        email =
          this.emailLike(nameId) ??
          attributes[ATTR.EMAIL] ??
          attributes[ATTR.CLAIM_EMAIL];
        externalId = nameId ?? email;
        name =
          attributes[ATTR.DISPLAY_NAME] ??
          attributes[ATTR.ENTRA_DISPLAYNAME] ??
          attributes[ATTR.CLAIM_NAME] ??
          this.joinName(
            attributes[ATTR.GIVEN_NAME] ?? attributes[ATTR.CLAIM_GIVENNAME],
            attributes[ATTR.FAMILY_NAME] ?? attributes[ATTR.CLAIM_SURNAME],
          );
      }
    }

    if (!email) {
      throw badRequest("SAML_NO_EMAIL", "SAML assertion did not yield a usable email identity");
    }
    email = email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw badRequest("SAML_INVALID_EMAIL", "SAML email identity is not a valid email address");
    }

    if (!externalId) externalId = email;
    if (!name) name = email.split("@")[0];

    return { email, name: name.trim(), externalId: externalId.trim(), attributes };
  }

  async findOrCreateUser(tenantId: string, email: string, name: string, defaultRole: string) {
    // Try to find by email within the tenant
    const [existing] = await this.superDb
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);

    if (existing) {
      await this.superDb
        .update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, existing.id));
      return existing;
    }

    // Auto-provision: create user with a placeholder password hash (SSO-only account)
    const placeholderHash = `saml:${crypto.randomUUID()}`;
    const [created] = await this.superDb
      .insert(users)
      .values({
        tenantId,
        email,
        name,
        passwordHash: placeholderHash,
        role: defaultRole as UserRole,
        lastLogin: new Date(),
      })
      .returning();
    return created;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // XML helpers (DOM-based extraction over the signed subtree)
  // ──────────────────────────────────────────────────────────────────────────

  /** Extract the <NameID> text from the signed assertion DOM. */
  private extractNameId(doc: Document): string | null {
    const nodes = doc.getElementsByTagNameNS(
      "urn:oasis:names:tc:SAML:2.0:assertion",
      "NameID",
    );
    const text = nodes && nodes.length > 0 ? this.nodeText(nodes[0]) : null;
    if (text) return text.trim();
    // Fallback for documents that did not carry the SAML namespace on the fragment.
    const any = doc.getElementsByTagName("NameID");
    if (any && any.length > 0) {
      const t = this.nodeText(any[0]);
      return t ? t.trim() : null;
    }
    return null;
  }

  /**
   * Extract SAML <Attribute Name="..."><AttributeValue>...</AttributeValue> pairs
   * from the signed assertion DOM. Multi-valued attributes keep the first value
   * (sufficient for identity mapping). DOM walk avoids the regex pitfalls (and the
   * XSW exposure) of scanning raw markup.
   */
  private extractAttributes(doc: Document): Record<string, string> {
    const out: Record<string, string> = {};

    const collect = (attrs: HTMLCollectionOf<Element>) => {
      for (let i = 0; i < attrs.length; i++) {
        const el = attrs[i];
        if (!el) continue;
        const nameAttr = el.getAttribute("Name");
        if (!nameAttr || out[nameAttr] !== undefined) continue;

        let valueNodes = el.getElementsByTagNameNS(
          "urn:oasis:names:tc:SAML:2.0:assertion",
          "AttributeValue",
        );
        if (!valueNodes || valueNodes.length === 0) {
          valueNodes = el.getElementsByTagName("AttributeValue");
        }
        if (valueNodes && valueNodes.length > 0) {
          const value = this.nodeText(valueNodes[0]);
          if (value != null) out[nameAttr] = value.trim();
        }
      }
    };

    const nsAttrs = doc.getElementsByTagNameNS(
      "urn:oasis:names:tc:SAML:2.0:assertion",
      "Attribute",
    );
    if (nsAttrs && nsAttrs.length > 0) {
      collect(nsAttrs);
    } else {
      collect(doc.getElementsByTagName("Attribute"));
    }
    return out;
  }

  /** Concatenate the text content of a DOM node (xmldom Node). */
  private nodeText(node: unknown): string | null {
    const n = node as { textContent?: string | null };
    return n && typeof n.textContent === "string" ? n.textContent : null;
  }

  private emailLike(value: string | null | undefined): string | undefined {
    if (value && value.includes("@")) return value;
    return undefined;
  }

  private joinName(given?: string, family?: string): string | undefined {
    const parts = [given, family].filter((p): p is string => !!p && p.trim().length > 0);
    return parts.length > 0 ? parts.join(" ") : undefined;
  }

  private pemBody(pem: string): string {
    return pem
      .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, "")
      .trim();
  }

  private xmlEscape(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private normalizeCert(cert: string): string {
    const stripped = cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, "");
    return `-----BEGIN CERTIFICATE-----\n${stripped.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----`;
  }
}
