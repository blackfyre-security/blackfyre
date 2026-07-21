# ADR-0005: The operator console is not part of the open-source release

Status: accepted

## Context

The repository shipped two Next.js front-ends against one API:

- **`packages/portal`** (:3001) — the product. A tenant's own scans, findings,
  evidence, compliance posture, remediation, integrations, team and settings.
- **`packages/admin`** (:3003) — the console for whoever *operates* a hosted
  Blackfyre service. Its distinctive pages were tenant provisioning, billing, the
  marketing-site contact inbox, cross-tenant reporting and audit-log viewing.

Roughly ten of its fifteen pages were operator-scoped variants of pages the portal
already had, differing only in that they read across tenants rather than within one.

This split made sense while the software and the hosted service were one codebase.
It stopped making sense once the project was published: **a self-hosted install is
a single tenant.** There is nobody to provision, nobody to bill, and no marketing
inbox. Shipping the console asked every self-hoster to stand up a second Next.js
app, decide which of two dashboards to log into, and reason about a privilege tier
that had no meaning for them.

The API side mattered more than the UI. The operator surface is `/api/admin/*`
plus `/api/clients/*`, gated on a `users.is_platform_admin` column, and
`plugins/zero-leakage.ts` deliberately exempted `/api/admin/` from cross-tenant
leak detection because those routes return cross-tenant data by design.

Deleting only the front-end would therefore have been **worse than shipping it**:
the routes, the privilege column and the leak-detector exemption would all have
remained live and reachable by direct HTTP, including a path that lets a
platform-admin grant the flag to another account — just with no visible door.

## Decision

**The operator console is not part of the open-source release, and its API surface
is off by default.**

1. `packages/admin` is removed from this repository, along with its workspace
   entry, CI build/lint steps, Cloudflare Pages deploy job, container-image matrix
   leg, compose service and nginx vhost.
2. The operator routes remain in the codebase but are **not registered** unless
   `PLATFORM_ADMIN_API=true`. The default is `false`. This covers
   `routes/admin.ts`, `routes/admin-reports.ts` and `routes/clients.ts`.
3. `plugins/zero-leakage.ts` computes its exemption list from the same flag. With
   the operator API off, **no path is exempt** — every response on every route is
   leak-checked.

Consequence: on a default install, `users.is_platform_admin` grants nothing over
HTTP. The column still exists (dropping it is a separate migration decision), but
there is no route that reads it.

## Alternatives considered

**Delete the operator API outright.** Cleanest for self-hosters, but it would break
any hosted deployment built from this repository, since the console and the API
deploy from the same source. The env flag keeps one codebase serving both shapes.

**Keep the console and hide it behind a build flag.** Rejected: it ships thousands
of lines of unreachable UI, keeps two dashboards in every contributor's mental
model, and leaves the duplicate pages to drift.

**Reframe the console as "instance admin" for self-hosters.** Rejected: the portal
already has `team/` (list, invite, change role, remove) and `settings/`, which is
the whole of what a single-tenant operator needs. A second app for that is
overhead, not a feature.

## Consequences

- Self-hosters run one front-end. The quickstart drops from three terminals to two.
- The default install has no cross-tenant HTTP surface and no leak-check exemption.
- Anyone running Blackfyre as a multi-tenant service supplies their own operator
  console and sets `PLATFORM_ADMIN_API=true`.
- **Audit logs currently have no reader.** `GET /api/admin/audit-logs` was the only
  read path, and it is now off by default. Audit entries are still written. A
  tenant-scoped read endpoint plus a portal view is outstanding work and should
  land before this is described as complete.
- **This repository no longer has any browser/e2e tests.** The Playwright suite
  lived in the console. Portal e2e coverage is outstanding work.
