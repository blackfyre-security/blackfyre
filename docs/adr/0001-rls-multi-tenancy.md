# ADR-0001: Multi-tenancy via Postgres row-level security

Status: accepted (2026-06, hardened from an earlier inert implementation)

## Context

Blackfyre is a multi-tenant SaaS holding security findings and compliance evidence —
data where cross-tenant leakage is an existential bug. Application-level `WHERE
tenant_id = ?` filtering alone fails open: one forgotten predicate in any of ~40
route modules leaks data. We wanted isolation enforced by the database, below the
ORM, in a way a buggy route can't bypass.

Two earlier attempts shipped inert: (1) policies existed but the app connected as the
table owner, which Postgres exempts from RLS by default; (2) the tenant GUC was set
on the wrong pool at session scope, so it never reached the querying connection and
leaked across pooled requests.

## Decision

Enforce isolation with Postgres RLS, made real by three mechanisms
(migrations `009a_rls_enforcement.sql` and `019_force_rls.sql`):

1. **A non-owner `app_user` role** (`NOLOGIN`, not superuser, no BYPASSRLS, not the
   table owner). The app connects as the owner but drops privileges per request with
   `SET ROLE app_user`.
2. **`FORCE ROW LEVEL SECURITY`** on every tenant table, so policies apply even to
   the owner — belt-and-braces against a missed `SET ROLE`.
3. **A request-scoped connection binding** (`request.db`): after authentication, the
   API reserves a dedicated connection, runs
   `set_config('app.current_tenant', <tenantId>, false)` + `SET ROLE app_user`, and
   hands routes a Drizzle handle on that connection. Policies key on
   `current_setting('app.current_tenant', true)::uuid` — the `missing_ok` flag makes
   an unset context evaluate NULL → deny-all (fail closed) instead of erroring. The
   connection is RESET and released in `onResponse`/`onError` hooks.

Cross-tenant admin/provisioning paths use a separate owner pool (`app.superDb`) that
bypasses RLS by design and must filter `tenant_id` explicitly.

## Consequences

- A route that forgets a tenant filter returns only the caller's rows anyway — the
  DB enforces it. New tenant tables must ship ENABLE+FORCE RLS plus a policy in the
  same migration ([migrations.md](../developer/migrations.md#rls-in-migrations)).
- Costs one reserved connection per in-flight authenticated request, and
  `request.db.transaction()` is unsupported (postgres.js reserved connections lack
  `begin` at runtime); transactional work uses `app.db`/`superDb` with explicit
  scoping.
- The reserved-connection handle needs `drizzleReserved()`
  (`db/connection.ts`) — plain `drizzle()` breaks on reserved connections.
- `superDb` remains a sharp edge: reviews must treat any `superDb` query touching
  tenant data as security-sensitive.
- Works on managed Postgres (RDS has no superuser) — see the RDS notes in
  `009a` and [migrations.md](../developer/migrations.md#rds-compatibility-gotchas-managed-postgres-has-no-superuser).
