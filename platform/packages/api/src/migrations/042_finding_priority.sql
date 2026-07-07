-- ============================================================================
-- 042_finding_priority.sql
-- REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003).
--
-- The product spec ranks findings by priority = severity x exploitability x
-- compliance_impact, but the findings table only ever stored `severity`. The
-- other two dimensions were never computed or persisted, so the API could not
-- rank findings the way the spec describes (it fell back to ordering by the
-- severity enum alone). This migration adds the two missing, persisted factors.
--
-- `exploitability` and `compliance_impact` are stored as smallint on a 1..5
-- scale (1 = least, 5 = most). They are NULLABLE on purpose: every row that
-- already exists predates this migration and has no computed value. The
-- application (services/finding-service.ts -> calculateFindingPriority) treats a
-- NULL as a sensible neutral default (see EXPLOITABILITY_DEFAULT /
-- COMPLIANCE_IMPACT_DEFAULT there), so legacy rows still rank correctly and the
-- read path never has to special-case missing data. New findings get both
-- factors derived at write time and persisted, so the priority is reproducible
-- from the row alone.
--
-- No RLS change is needed: `findings` already has ENABLE + FORCE ROW LEVEL
-- SECURITY with the tenant_isolation_findings policy from 009a_rls_enforcement.sql
-- (tenant_id keyed on current_setting('app.current_tenant', true)::uuid, fail
-- closed). Adding columns does not alter that policy, and the non-owner
-- `app_user` role already holds DML on the table. We only ADD COLUMN IF NOT
-- EXISTS so this is idempotent and back-compatible.
--
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT
-- EXISTS, guarded CHECK constraint).
-- ============================================================================

BEGIN;

-- Exploitability: how reachable/weaponizable the issue is, derived at write time
-- from severity + resource-exposure signals (network/internet-facing resource
-- types, auto-fixable surface, etc.). 1..5; NULL on pre-existing rows.
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS exploitability smallint;

-- Compliance impact: how much regulatory weight the finding carries, derived
-- from how many controls/frameworks it maps to and their control weights.
-- 1..5; NULL on pre-existing rows.
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS compliance_impact smallint;

-- Persisted priority score so rows can be ranked in SQL without re-deriving the
-- formula. numeric (not int) because the application multiplies severity weight
-- x exploitability x compliance_impact and may normalize. NULL on legacy rows;
-- the read path coalesces to a derived value, but persisting it keeps ranking
-- queries index-friendly and reproducible.
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS priority_score numeric(8,2);

-- Range guards. Added via a guarded DO block so the migration stays idempotent
-- (ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS). NULLs pass a CHECK, so
-- legacy rows are unaffected.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'findings_exploitability_range'
  ) THEN
    ALTER TABLE findings
      ADD CONSTRAINT findings_exploitability_range
      CHECK (exploitability IS NULL OR (exploitability BETWEEN 1 AND 5));
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'findings_compliance_impact_range'
  ) THEN
    ALTER TABLE findings
      ADD CONSTRAINT findings_compliance_impact_range
      CHECK (compliance_impact IS NULL OR (compliance_impact BETWEEN 1 AND 5));
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'findings_priority_score_nonneg'
  ) THEN
    ALTER TABLE findings
      ADD CONSTRAINT findings_priority_score_nonneg
      CHECK (priority_score IS NULL OR priority_score >= 0);
  END IF;
END $$;

-- Rank findings within a tenant by priority. DESC NULLS LAST so computed
-- (non-null) high-priority findings surface first and legacy/un-derived rows
-- fall to the bottom of a priority-ordered page.
CREATE INDEX IF NOT EXISTS findings_tenant_priority_idx
  ON findings (tenant_id, priority_score DESC NULLS LAST);

COMMIT;
