/**
 * SCIM 2.0 provisioning routes — RFC 7643 + RFC 7644
 *
 * Registered under prefix /scim/v2 in app.ts.
 * Auth is handled by the scimAuthenticate preHandler from scim-auth plugin.
 * Only tenants on the "defend" plan may use SCIM (enforced in scim-auth).
 *
 * Soft-delete rationale: DELETE sets deactivated_at rather than removing the
 * row so that audit trails are preserved and IdPs that re-provision a user do
 * not lose historical data. Hard deletes would also break foreign-key chains
 * (scans, findings, etc.) owned by that user.
 *
 * Integration tests are owed (see TRACK_D.md residual work).
 */

import type { FastifyPluginAsync } from "fastify";
import { eq, and, ilike, sql, count } from "drizzle-orm";
import { z } from "zod";
import { users, tenants } from "../db/schema.js";
import { notFound, conflict, badRequest } from "../utils/errors.js";
import { hashPassword } from "../utils/password.js";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// SCIM content-type
// ---------------------------------------------------------------------------
const SCIM_CONTENT_TYPE = "application/scim+json";

// ---------------------------------------------------------------------------
// SCIM schema URNs
// ---------------------------------------------------------------------------
const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
const LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
const SP_CONFIG_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): durable SCIM Group storage (Wave-2 persistence).
//
// SCIM Groups + memberships previously lived in a process-global, capped
// in-memory Map: lost on every restart and silently evicted under load. They now
// persist in the `scim_groups` + `scim_group_members` tables (migration
// 024_scim_groups.sql) via parameterized SQL through `app.superDb`.
//
// Connection choice: SCIM requests authenticate via scimAuthenticate, which (by
// design, mirroring the existing SCIM Users handlers) does NOT bind
// app.current_tenant / SET ROLE app_user — so there is no request-scoped
// RLS-bound `request.db` here. We therefore use `app.superDb` (the owner pool)
// and HAND-FILTER every read/write by tenant_id, exactly as the SCIM Users
// handlers above do (see `eq(users.tenantId, tenantId)`). The tables also carry
// FORCE-RLS tenant_isolation policies (024_scim_groups.sql) as defense-in-depth.
//
// All SQL below is PARAMETERIZED (Drizzle `sql` tagged template → bound params);
// no raw string interpolation of caller-supplied values.
// ---------------------------------------------------------------------------

// Shape returned to the scimGroup() serializer — kept identical to the previous
// in-memory object so the SCIM response is byte-for-byte unchanged.
interface GroupRecord {
  id: string;
  externalId: string | null;
  displayName: string;
  members: any[];
  createdAt: string;
  updatedAt: string;
}

type GroupHeaderRow = {
  id: string;
  external_id: string | null;
  display_name: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type MemberRow = {
  group_id: string;
  value: string;
  display: string | null;
  type: string | null;
  ref: string | null;
};

function toIso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

// Reconstruct a SCIM member object from a stored row, omitting null sub-attrs so
// the round-tripped member matches what the IdP originally sent.
function rowToMember(r: MemberRow): any {
  const m: any = { value: r.value };
  if (r.display != null) m.display = r.display;
  if (r.type != null) m.type = r.type;
  if (r.ref != null) m.$ref = r.ref;
  return m;
}

// Normalize an inbound SCIM member (object or bare string) for persistence.
function normalizeMember(m: any): { value: string; display: string | null; type: string | null; ref: string | null } | null {
  if (typeof m === "string") {
    return m ? { value: m, display: null, type: null, ref: null } : null;
  }
  if (m && typeof m === "object") {
    const value = m.value ?? m.$ref ?? m.ref;
    if (value == null || value === "") return null;
    return {
      value: String(value),
      display: m.display != null ? String(m.display) : null,
      type: m.type != null ? String(m.type) : null,
      ref: m.$ref != null ? String(m.$ref) : m.ref != null ? String(m.ref) : null,
    };
  }
  return null;
}

// Load a single group (header + ordered members) scoped to the tenant. Returns
// null when the group does not exist for this tenant.
async function loadGroup(db: any, tenantId: string, id: string): Promise<GroupRecord | null> {
  const headers: GroupHeaderRow[] = await db.execute(
    sql`SELECT id, external_id, display_name, created_at, updated_at
        FROM scim_groups
        WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1`,
  );
  const header = headers[0];
  if (!header) return null;

  const memberRows: MemberRow[] = await db.execute(
    sql`SELECT group_id, value, display, type, ref
        FROM scim_group_members
        WHERE group_id = ${id}
        ORDER BY position ASC, created_at ASC`,
  );

  return {
    id: header.id,
    externalId: header.external_id,
    displayName: header.display_name,
    members: memberRows.map(rowToMember),
    createdAt: toIso(header.created_at),
    updatedAt: toIso(header.updated_at),
  };
}

// Replace a group's membership rows with `members` (the SCIM PUT/replace
// semantics), preserving order via `position`. Caller must run inside a txn.
async function replaceMembers(tx: any, groupId: string, members: any[]): Promise<void> {
  await tx.execute(sql`DELETE FROM scim_group_members WHERE group_id = ${groupId}`);
  let position = 0;
  for (const raw of members) {
    const m = normalizeMember(raw);
    if (!m) continue;
    await tx.execute(
      sql`INSERT INTO scim_group_members (group_id, value, display, type, ref, position)
          VALUES (${groupId}, ${m.value}, ${m.display}, ${m.type}, ${m.ref}, ${position})`,
    );
    position += 1;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function scimUser(user: any, baseUrl: string) {
  return {
    schemas: [USER_SCHEMA],
    id: user.id,
    externalId: user.scimExternalId ?? undefined,
    userName: user.scimUserName ?? user.email,
    name: {
      formatted: user.name,
      givenName: user.name.split(" ")[0] ?? user.name,
      familyName: user.name.split(" ").slice(1).join(" ") || undefined,
    },
    emails: [{ value: user.email, primary: true, type: "work" }],
    active: !user.deactivatedAt,
    meta: {
      resourceType: "User",
      created: user.createdAt,
      lastModified: user.updatedAt ?? user.createdAt,
      location: `${baseUrl}/Users/${user.id}`,
    },
  };
}

function scimGroup(group: any, baseUrl: string) {
  return {
    schemas: [GROUP_SCHEMA],
    id: group.id,
    externalId: group.externalId ?? undefined,
    displayName: group.displayName,
    members: group.members ?? [],
    meta: {
      resourceType: "Group",
      created: group.createdAt,
      lastModified: group.updatedAt ?? group.createdAt,
      location: `${baseUrl}/Groups/${group.id}`,
    },
  };
}

function listResponse(resources: any[], totalResults: number, startIndex: number, count: number) {
  return {
    schemas: [LIST_RESPONSE_SCHEMA],
    totalResults,
    itemsPerPage: count,
    startIndex,
    Resources: resources,
  };
}

function scimError(status: number, detail: string) {
  return { schemas: [ERROR_SCHEMA], status: String(status), detail };
}

// Parse ?filter=userName eq "value"
function parseUsernameFilter(filter?: string): string | null {
  if (!filter) return null;
  const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SCIM User create/replace had NO
// schema validation and performed `body as any` mass-assignment — a malicious
// or buggy IdP could submit arbitrary/oversized fields. These Zod schemas
// validate and bound the SCIM User payload (RFC 7643 §4.1) so only known,
// length-checked fields are accepted; route handlers then map fields EXPLICITLY
// (no spread/`as any` of the raw body) into the users table.
// ---------------------------------------------------------------------------
const scimNameSchema = z
  .object({
    formatted: z.string().max(200).optional(),
    givenName: z.string().max(200).optional(),
    familyName: z.string().max(200).optional(),
  })
  .passthrough(); // allow extra SCIM name sub-attrs (middleName, etc.) but ignore them

const scimEmailSchema = z
  .object({
    value: z.string().email().max(320),
    primary: z.boolean().optional(),
    type: z.string().max(50).optional(),
  })
  .passthrough();

// Accepts a SCIM User resource; unknown top-level attributes are tolerated
// (passthrough) but never assigned — the handler reads only validated fields.
const scimUserBodySchema = z
  .object({
    schemas: z.array(z.string()).optional(),
    externalId: z.string().max(256).optional(),
    userName: z.string().max(320).optional(),
    name: scimNameSchema.optional(),
    emails: z.array(scimEmailSchema).max(20).optional(),
    active: z.boolean().optional(),
  })
  .passthrough();

type ScimUserBody = z.infer<typeof scimUserBodySchema>;

// Derive the canonical email + display name from a validated SCIM User body.
function deriveEmail(body: ScimUserBody, fallback?: string): string {
  const primary = body.emails?.find((e) => e.primary)?.value;
  return (primary ?? body.userName ?? fallback ?? "").toLowerCase();
}

function deriveName(body: ScimUserBody, fallback: string): string {
  const parts = `${body.name?.givenName ?? ""} ${body.name?.familyName ?? ""}`.trim();
  return body.name?.formatted ?? (parts || fallback);
}

// ---------------------------------------------------------------------------
// SECURITY FIX (BLACKFYRE audit 2026-06-05): PATCH handlers (Users + Groups)
// previously consumed `body as any` with NO validation of the Operations array
// or the size of the values it carried — unlike POST/PUT which validate via
// scimUserBodySchema. A malicious/buggy IdP could send an unbounded number of
// ops or oversized field values (e.g. a 100MB email), causing DB errors or
// resource exhaustion. These bounds enforce the same RFC 7643 field-length
// limits as scimUserBodySchema, plus a cap on operations per request.
// ---------------------------------------------------------------------------
const MAX_PATCH_OPERATIONS = 10;
const MAX_GROUP_MEMBERS = 1_000;
// Field length limits — kept in sync with scimUserBodySchema above.
const FIELD_LIMITS = {
  email: 320,
  userName: 320,
  externalId: 256,
  name: 200,
  displayName: 200,
} as const;

// Returns true if `v` is a string that exceeds `max`. Non-strings are ignored
// here (callers only length-check string values; structural shape is handled by
// the per-op assignment logic).
function strTooLong(v: unknown, max: number): boolean {
  return typeof v === "string" && v.length > max;
}

// Validate a single SCIM User PATCH operation's value sizes against the same
// field limits enforced by scimUserBodySchema. Returns a reason string when the
// op violates a bound, or null when it is acceptable.
function userPatchOpViolation(op: any): string | null {
  const opType = (op?.op ?? "").toLowerCase();
  if (opType !== "replace" && opType !== "add" && opType !== "remove") {
    return "unsupported_op";
  }
  const path: string = typeof op?.path === "string" ? op.path : "";
  const value = op?.value;

  // userName
  const userName = path === "userName" ? value : value?.userName;
  if (strTooLong(userName, FIELD_LIMITS.userName)) return "userName_too_long";
  // externalId
  const externalId = path === "externalId" ? value : value?.externalId;
  if (strTooLong(externalId, FIELD_LIMITS.externalId)) return "externalId_too_long";
  // name.formatted
  const formatted = path === "name.formatted" ? value : value?.name?.formatted;
  if (strTooLong(formatted, FIELD_LIMITS.name)) return "name_too_long";
  // emails
  if (path === "emails" && Array.isArray(value)) {
    if (value.length > 20) return "emails_too_many";
    for (const e of value) {
      if (strTooLong(e?.value, FIELD_LIMITS.email)) return "email_too_long";
    }
  }
  return null;
}

// SCIM Group create/replace payload — bounds displayName, externalId and the
// member array so an IdP cannot submit oversized values before they are
// persisted to scim_groups / scim_group_members (see loadGroup/replaceMembers).
const scimGroupBodySchema = z
  .object({
    schemas: z.array(z.string()).optional(),
    externalId: z.string().max(FIELD_LIMITS.externalId).optional(),
    displayName: z.string().min(1).max(FIELD_LIMITS.displayName),
    members: z.array(z.any()).max(MAX_GROUP_MEMBERS).optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------
export const scimRoutes: FastifyPluginAsync = async (app) => {
  const auth = (app as any).scimAuthenticate;

  function baseUrl(request: any): string {
    return `${request.protocol}://${request.hostname}/scim/v2`;
  }

  // -------------------------------------------------------------------------
  // ServiceProviderConfig
  // -------------------------------------------------------------------------
  app.get("/ServiceProviderConfig", { preHandler: [auth] }, async (_req, reply) => {
    return reply.type(SCIM_CONTENT_TYPE).send({
      schemas: [SP_CONFIG_SCHEMA],
      documentationUri: "https://blackfyre.tech/docs/scim",
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Authentication scheme using the OAuth Bearer Token Standard",
          specUri: "http://www.rfc-editor.org/info/rfc6750",
          primary: true,
        },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // Schemas
  // -------------------------------------------------------------------------
  app.get("/Schemas", { preHandler: [auth] }, async (_req, reply) => {
    return reply.type(SCIM_CONTENT_TYPE).send({
      schemas: [LIST_RESPONSE_SCHEMA],
      totalResults: 2,
      itemsPerPage: 2,
      startIndex: 1,
      Resources: [
        {
          id: USER_SCHEMA,
          name: "User",
          description: "User Account",
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
          attributes: [
            { name: "userName", type: "string", multiValued: false, required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
            { name: "name", type: "complex", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
            { name: "emails", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default" },
            { name: "active", type: "boolean", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
            { name: "externalId", type: "string", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
          ],
        },
        {
          id: GROUP_SCHEMA,
          name: "Group",
          description: "Group",
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
          attributes: [
            { name: "displayName", type: "string", multiValued: false, required: true, mutability: "readWrite", returned: "default" },
            { name: "members", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default" },
          ],
        },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // Users — LIST
  // -------------------------------------------------------------------------
  app.get("/Users", { preHandler: [auth] }, async (request: any, reply) => {
    const tenantId = request.scimTenant.id;
    const { filter, startIndex: si, count: cnt } = request.query as any;
    const startIndex = Math.max(1, parseInt(si ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(cnt ?? "100", 10)));
    const offset = startIndex - 1;

    const usernameFilter = parseUsernameFilter(filter);

    const base = app.superDb
      .select()
      .from(users)
      .where(
        usernameFilter
          ? and(eq(users.tenantId, tenantId), ilike(users.email, usernameFilter))
          : eq(users.tenantId, tenantId),
      );

    const [{ total }] = await app.superDb
      .select({ total: count() })
      .from(users)
      .where(
        usernameFilter
          ? and(eq(users.tenantId, tenantId), ilike(users.email, usernameFilter))
          : eq(users.tenantId, tenantId),
      );

    const rows = await base.limit(pageSize).offset(offset);
    const burl = baseUrl(request);

    return reply.type(SCIM_CONTENT_TYPE).send(
      listResponse(rows.map((u) => scimUser(u, burl)), Number(total), startIndex, pageSize),
    );
  });

  // -------------------------------------------------------------------------
  // Users — GET by id
  // -------------------------------------------------------------------------
  app.get("/Users/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;

    const [user] = await app.superDb
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "User not found"));
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit sensitive single-user
    // reads (info: sensitive-but-normal access) so reads of user PII are
    // traceable. No secrets are logged — only tenant/user identifiers.
    request.log.info(
      { event: "scim.user.get", tenantId, userId: id },
      "SCIM user read",
    );

    return reply.type(SCIM_CONTENT_TYPE).send(scimUser(user, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Users — CREATE (POST)
  // -------------------------------------------------------------------------
  app.post("/Users", { preHandler: [auth] }, async (request: any, reply) => {
    const tenantId = request.scimTenant.id;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): validate the SCIM User payload
    // with Zod instead of `body as any` mass-assignment.
    const parsed = scimUserBodySchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(
        { event: "scim.user.create.invalid", tenantId, issues: parsed.error.issues.map((i) => i.path.join(".")) },
        "SCIM user create rejected: invalid payload",
      );
      return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "Invalid SCIM User payload"));
    }
    const body = parsed.data;

    const email = deriveEmail(body);
    if (!email) {
      return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "email or userName is required"));
    }
    const name = deriveName(body, email);

    // Duplicate check
    const [existing] = await app.superDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return reply.status(409).type(SCIM_CONTENT_TYPE).send(scimError(409, "User already exists"));
    }

    // Provision with a random password; user must reset via invite email
    const tempPassword = nanoid(24);
    const passwordHash = await hashPassword(tempPassword);

    // Explicit field mapping — only validated, allow-listed fields are written.
    const [created] = await app.superDb
      .insert(users)
      .values({
        tenantId,
        email,
        name,
        passwordHash,
        role: "viewer",
        scimExternalId: body.externalId ?? null,
        scimUserName: body.userName ?? email,
      } as any)
      .returning();

    request.log.info(
      { event: "scim.user.create", tenantId, userId: created?.id },
      "SCIM user provisioned",
    );

    // TODO: send invite email via existing email service (residual)

    return reply.status(201).type(SCIM_CONTENT_TYPE).send(scimUser(created, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Users — PATCH (partial update per RFC 7644 §3.5.2)
  // -------------------------------------------------------------------------
  app.patch("/Users/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;
    const body = request.body as any;

    const [user] = await app.superDb
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "User not found"));
    }

    const ops: any[] = Array.isArray(body?.Operations) ? body.Operations : [];

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): validate the PATCH Operations
    // array before processing — PATCH previously had NO bounds (unlike POST/PUT).
    // (1) cap the number of operations per request, (2) require a valid op type
    // and path on each, (3) enforce the same RFC 7643 field-length limits as
    // scimUserBodySchema so an oversized value (e.g. 100MB email) cannot reach
    // the DB. Denials are logged at warn for anomaly detection.
    if (ops.length > MAX_PATCH_OPERATIONS) {
      request.log.warn(
        { event: "scim.user.patch.invalid", reason: "too_many_operations", tenantId, userId: id, count: ops.length },
        "SCIM user patch rejected: too many operations",
      );
      return reply
        .status(400)
        .type(SCIM_CONTENT_TYPE)
        .send(scimError(400, `At most ${MAX_PATCH_OPERATIONS} PATCH operations are allowed`));
    }
    for (const op of ops) {
      const violation = userPatchOpViolation(op);
      if (violation) {
        request.log.warn(
          { event: "scim.user.patch.invalid", reason: violation, tenantId, userId: id },
          "SCIM user patch rejected: invalid operation",
        );
        return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "Invalid SCIM PATCH operation"));
      }
    }

    const patch: Record<string, any> = {};

    for (const op of ops) {
      const opType = (op.op ?? "").toLowerCase();
      const path: string = op.path ?? "";
      const value = op.value;

      if (opType === "replace" || opType === "add") {
        if (path === "active" || (typeof value === "object" && value !== null && "active" in value)) {
          const active = path === "active" ? value : value.active;
          patch.deactivatedAt = active === false || active === "false" ? new Date() : null;
        }
        if (path === "userName" || value?.userName) {
          patch.scimUserName = path === "userName" ? value : value.userName;
        }
        if (path === "externalId" || value?.externalId) {
          patch.scimExternalId = path === "externalId" ? value : value.externalId;
        }
        if (path === "name.formatted" || value?.name?.formatted) {
          patch.name = path === "name.formatted" ? value : value.name.formatted;
        }
        if (path === "emails" && Array.isArray(value)) {
          const primary = value.find((e: any) => e.primary);
          if (primary?.value) patch.email = primary.value;
        }
      }

      if (opType === "remove") {
        if (path === "active") patch.deactivatedAt = new Date();
      }
    }

    if (Object.keys(patch).length === 0) {
      return reply.type(SCIM_CONTENT_TYPE).send(scimUser(user, baseUrl(request)));
    }

    const [updated] = await app.superDb
      .update(users)
      .set(patch as any)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit user modifications
    // (info: sensitive-but-normal). Logs only which fields changed (patch keys),
    // never the values, so no PII or secrets are written to logs.
    request.log.info(
      { event: "scim.user.patch", tenantId, userId: id, patchKeys: Object.keys(patch) },
      "SCIM user patched",
    );

    return reply.type(SCIM_CONTENT_TYPE).send(scimUser(updated, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Users — PUT (full replace)
  // -------------------------------------------------------------------------
  app.put("/Users/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): validate the SCIM User replace
    // payload with Zod instead of `body as any` mass-assignment.
    const parsed = scimUserBodySchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(
        { event: "scim.user.replace.invalid", tenantId, userId: id, issues: parsed.error.issues.map((i) => i.path.join(".")) },
        "SCIM user replace rejected: invalid payload",
      );
      return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "Invalid SCIM User payload"));
    }
    const body = parsed.data;

    const [user] = await app.superDb
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "User not found"));
    }

    const email = deriveEmail(body, user.email);
    const name = deriveName(body, user.name);
    const active = body.active !== false;

    // Explicit field mapping — only validated, allow-listed fields are written.
    const [updated] = await app.superDb
      .update(users)
      .set({
        email,
        name,
        scimUserName: body.userName ?? email,
        scimExternalId: body.externalId ?? null,
        deactivatedAt: active ? null : new Date(),
      } as any)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();

    request.log.info(
      { event: "scim.user.replace", tenantId, userId: id, active },
      "SCIM user replaced",
    );

    return reply.type(SCIM_CONTENT_TYPE).send(scimUser(updated, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Users — DELETE (soft delete — sets deactivated_at)
  // -------------------------------------------------------------------------
  app.delete("/Users/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;

    const [user] = await app.superDb
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "User not found"));
    }

    await app.superDb
      .update(users)
      .set({ deactivatedAt: new Date() } as any)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit user (soft-)deletes
    // (info: sensitive-but-normal) so deprovisioning is traceable. Only
    // tenant/user identifiers are logged — no secrets.
    request.log.info(
      { event: "scim.user.delete", tenantId, userId: id },
      "SCIM user soft-deleted",
    );

    return reply.status(204).send();
  });

  // -------------------------------------------------------------------------
  // Groups — LIST
  // -------------------------------------------------------------------------
  app.get("/Groups", { preHandler: [auth] }, async (request: any, reply) => {
    const tenantId = request.scimTenant.id;
    const { startIndex: si, count: cnt } = request.query as any;
    const startIndex = Math.max(1, parseInt(si ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(cnt ?? "100", 10)));

    // REAL IMPL (BLACKFYRE 2026-06): read groups from Postgres (tenant-scoped),
    // paginating in the DB. Same ordering shape as the old insertion-order Map
    // (created_at ASC) so list responses remain stable.
    const [{ total }] = (await app.superDb.execute(
      sql`SELECT count(*)::int AS total FROM scim_groups WHERE tenant_id = ${tenantId}`,
    )) as Array<{ total: number }>;

    const pageRows: GroupHeaderRow[] = await app.superDb.execute(
      sql`SELECT id, external_id, display_name, created_at, updated_at
          FROM scim_groups
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at ASC, id ASC
          LIMIT ${pageSize} OFFSET ${startIndex - 1}`,
    );

    const groups: GroupRecord[] = [];
    for (const header of pageRows) {
      const memberRows: MemberRow[] = await app.superDb.execute(
        sql`SELECT group_id, value, display, type, ref
            FROM scim_group_members
            WHERE group_id = ${header.id}
            ORDER BY position ASC, created_at ASC`,
      );
      groups.push({
        id: header.id,
        externalId: header.external_id,
        displayName: header.display_name,
        members: memberRows.map(rowToMember),
        createdAt: toIso(header.created_at),
        updatedAt: toIso(header.updated_at),
      });
    }

    const burl = baseUrl(request);

    return reply.type(SCIM_CONTENT_TYPE).send(
      listResponse(groups.map((g) => scimGroup(g, burl)), Number(total), startIndex, pageSize),
    );
  });

  // -------------------------------------------------------------------------
  // Groups — GET by id
  // -------------------------------------------------------------------------
  app.get("/Groups/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;

    // REAL IMPL (BLACKFYRE 2026-06): tenant-scoped read from Postgres.
    const group = await loadGroup(app.superDb, tenantId, id);

    if (!group) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "Group not found"));
    }

    return reply.type(SCIM_CONTENT_TYPE).send(scimGroup(group, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Groups — CREATE
  // -------------------------------------------------------------------------
  app.post("/Groups", { preHandler: [auth] }, async (request: any, reply) => {
    const tenantId = request.scimTenant.id;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): validate the SCIM Group payload
    // with Zod instead of `body as any` — displayName/externalId/members were
    // previously assigned with no bounds, so an IdP could submit a 100MB
    // displayName or an unbounded members array. The schema enforces field
    // length + member-count limits; rejections are logged at warn.
    const parsed = scimGroupBodySchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(
        { event: "scim.group.create.invalid", tenantId, issues: parsed.error.issues.map((i) => i.path.join(".")) },
        "SCIM group create rejected: invalid payload",
      );
      return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "Invalid SCIM Group payload"));
    }
    const body = parsed.data;

    const id = crypto.randomUUID();
    const externalId = body.externalId ?? null;
    const members = body.members ?? [];

    // REAL IMPL (BLACKFYRE 2026-06): persist the group header + members durably in
    // one transaction (replaces the bounded in-memory store). Tenant-scoped insert;
    // parameterized SQL. The returned record is read back so timestamps come from
    // the DB and the response shape is identical to the previous in-memory object.
    await app.superDb.transaction(async (tx: any) => {
      await tx.execute(
        sql`INSERT INTO scim_groups (id, tenant_id, external_id, display_name)
            VALUES (${id}, ${tenantId}, ${externalId}, ${body.displayName})`,
      );
      await replaceMembers(tx, id, members);
    });

    const group = await loadGroup(app.superDb, tenantId, id);
    if (!group) {
      // Should not happen (we just inserted under this tenant); fail loudly.
      request.log.error(
        { event: "scim.group.create.readback_failed", tenantId, groupId: id },
        "SCIM group created but could not be read back",
      );
      return reply.status(500).type(SCIM_CONTENT_TYPE).send(scimError(500, "Failed to persist group"));
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit group creation
    // (info: sensitive-but-normal), mirroring User create logging. displayName
    // is an IdP-set label (not a secret) and is bounded above.
    request.log.info(
      { event: "scim.group.create", tenantId, groupId: group.id, displayName: group.displayName },
      "SCIM group created",
    );

    return reply.status(201).type(SCIM_CONTENT_TYPE).send(scimGroup(group, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Groups — PATCH
  // -------------------------------------------------------------------------
  app.patch("/Groups/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;

    // REAL IMPL (BLACKFYRE 2026-06): load the persisted group (tenant-scoped),
    // apply the SCIM PATCH ops against this in-memory copy (validation + op
    // semantics unchanged), then write the final state back to Postgres in one
    // transaction. The mutable `group` object mirrors the previous in-memory
    // record so the op-application logic and response are identical.
    const group = await loadGroup(app.superDb, tenantId, id);

    if (!group) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "Group not found"));
    }

    const ops: any[] = Array.isArray((request.body as any)?.Operations)
      ? (request.body as any).Operations
      : [];

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): bound the Group PATCH Operations
    // array and the values it carries — previously unvalidated, so displayName
    // could be an oversized payload and members unbounded. (1) cap operations per
    // request, (2) bound displayName length, (3) cap members per operation.
    // Denials are logged at warn.
    if (ops.length > MAX_PATCH_OPERATIONS) {
      request.log.warn(
        { event: "scim.group.patch.invalid", reason: "too_many_operations", tenantId, groupId: id, count: ops.length },
        "SCIM group patch rejected: too many operations",
      );
      return reply
        .status(400)
        .type(SCIM_CONTENT_TYPE)
        .send(scimError(400, `At most ${MAX_PATCH_OPERATIONS} PATCH operations are allowed`));
    }
    for (const op of ops) {
      const opType = (op?.op ?? "").toLowerCase();
      if (opType !== "replace" && opType !== "add" && opType !== "remove") {
        request.log.warn(
          { event: "scim.group.patch.invalid", reason: "unsupported_op", tenantId, groupId: id },
          "SCIM group patch rejected: unsupported operation",
        );
        return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "Invalid SCIM PATCH operation"));
      }
      const displayName = op?.path === "displayName" ? op?.value : op?.value?.displayName;
      if (strTooLong(displayName, FIELD_LIMITS.displayName)) {
        request.log.warn(
          { event: "scim.group.patch.invalid", reason: "displayName_too_long", tenantId, groupId: id },
          "SCIM group patch rejected: displayName too long",
        );
        return reply.status(400).type(SCIM_CONTENT_TYPE).send(scimError(400, "displayName exceeds maximum length"));
      }
      const incomingMembers = op?.path === "members" ? op?.value : op?.value?.members;
      if (Array.isArray(incomingMembers) && incomingMembers.length > MAX_GROUP_MEMBERS) {
        request.log.warn(
          { event: "scim.group.patch.invalid", reason: "too_many_members", tenantId, groupId: id, count: incomingMembers.length },
          "SCIM group patch rejected: too many members",
        );
        return reply
          .status(400)
          .type(SCIM_CONTENT_TYPE)
          .send(scimError(400, `At most ${MAX_GROUP_MEMBERS} members are allowed per operation`));
      }
    }

    for (const op of ops) {
      const opType = (op.op ?? "").toLowerCase();
      if ((opType === "replace" || opType === "add") && op.value) {
        if (op.path === "displayName" || op.value.displayName) {
          group.displayName = op.path === "displayName" ? op.value : op.value.displayName;
        }
        if (op.path === "members" || op.value.members) {
          const incoming = op.path === "members" ? op.value : op.value.members;
          if (opType === "add") {
            group.members = [...(group.members ?? []), ...(Array.isArray(incoming) ? incoming : [incoming])];
          } else {
            group.members = Array.isArray(incoming) ? incoming : [incoming];
          }
        }
      }
      if (opType === "remove" && op.path === "members") {
        group.members = [];
      }
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): enforce the per-group member cap
    // after applying ops too, so additive ops cannot grow members past the bound.
    if (Array.isArray(group.members) && group.members.length > MAX_GROUP_MEMBERS) {
      request.log.warn(
        { event: "scim.group.patch.invalid", reason: "members_cap_exceeded", tenantId, groupId: id, count: group.members.length },
        "SCIM group patch rejected: resulting member count exceeds cap",
      );
      return reply
        .status(400)
        .type(SCIM_CONTENT_TYPE)
        .send(scimError(400, `Group may not exceed ${MAX_GROUP_MEMBERS} members`));
    }

    // REAL IMPL (BLACKFYRE 2026-06): persist the patched group durably. Update the
    // header (display_name + updated_at, tenant-scoped) and replace membership rows
    // with the final computed member list, all in one transaction. Then read the
    // group back so the response reflects exactly what was stored.
    await app.superDb.transaction(async (tx: any) => {
      await tx.execute(
        sql`UPDATE scim_groups
            SET display_name = ${group.displayName}, updated_at = now()
            WHERE id = ${id} AND tenant_id = ${tenantId}`,
      );
      await replaceMembers(tx, id, group.members ?? []);
    });

    const persisted = (await loadGroup(app.superDb, tenantId, id)) ?? group;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit group modifications
    // (info: sensitive-but-normal), mirroring User patch logging. No secrets.
    request.log.info(
      { event: "scim.group.patch", tenantId, groupId: id },
      "SCIM group patched",
    );

    return reply.type(SCIM_CONTENT_TYPE).send(scimGroup(persisted, baseUrl(request)));
  });

  // -------------------------------------------------------------------------
  // Groups — DELETE
  // -------------------------------------------------------------------------
  app.delete("/Groups/:id", { preHandler: [auth] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.scimTenant.id;

    // REAL IMPL (BLACKFYRE 2026-06): hard-delete the group (tenant-scoped) from
    // Postgres; membership rows cascade via the ON DELETE CASCADE FK. Use RETURNING
    // to detect whether a row actually existed for this tenant so the 404 behavior
    // is preserved without a separate existence check.
    const deleted = (await app.superDb.execute(
      sql`DELETE FROM scim_groups WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`,
    )) as Array<{ id: string }>;

    if (deleted.length === 0) {
      return reply.status(404).type(SCIM_CONTENT_TYPE).send(scimError(404, "Group not found"));
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit group deletion
    // (info: sensitive-but-normal), mirroring User delete logging. No secrets.
    request.log.info(
      { event: "scim.group.delete", tenantId, groupId: id },
      "SCIM group deleted",
    );

    return reply.status(204).send();
  });
};
