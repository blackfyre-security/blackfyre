<!-- Keep this brief. Skip sections that don't apply. -->

## What changed & why

<!-- 1-3 sentences. The "why" matters more than the "what". -->

## How tested

<!--
- [ ] Ran locally (docker compose / npm run dev)
- [ ] Added/updated tests for the change
- [ ] Hit relevant API endpoint(s) manually
- [ ] Browser-tested if UI
-->

## Checklist

- [ ] I signed off my commits (DCO — `git commit -s`)
- [ ] `npm run build` passes (from `platform/`)
- [ ] `npm run test:unit --workspace=packages/api` passes
- [ ] Lint passes if I touched portal/admin (`npm run lint --workspace=packages/portal|admin`)

## Does this touch tenant isolation / RLS?

- [ ] no
- [ ] yes — I used the RLS-bound `request.db` (not `app.db`/`app.superDb`), any new
      tenant table has `FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy, and
      I ran the tenant-isolation integration tests against the compose stack
      (`npx vitest run tests/integration/tenant-isolation.test.ts` from `packages/api`)

## Breaking change?

- [ ] no
- [ ] yes — described above + migration steps documented

## Heads-up to reviewers

<!-- Anything a reviewer should know before looking at the diff. -->
