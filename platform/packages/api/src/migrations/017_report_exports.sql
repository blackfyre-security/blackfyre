-- 017_report_exports.sql
-- Persists metadata about every tamper-evident PDF report exported from the
-- admin dashboard. The sha256 column is the fingerprint of the unsigned PDF
-- bytes; the public verify endpoint looks rows up by this hash to confirm
-- authenticity.

CREATE TABLE IF NOT EXISTS report_exports (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         REFERENCES tenants(id) ON DELETE CASCADE,
  report_type     VARCHAR(40)  NOT NULL,   -- 'tenant-health' | 'compliance-overview' | 'findings-rollup'
  sha256          VARCHAR(64)  NOT NULL,
  signed_by       VARCHAR(120) NOT NULL,   -- cert subject CN, e.g. 'BLACKFYRE Reporting Authority'
  encrypted       BOOLEAN      NOT NULL DEFAULT FALSE,
  recipient_email VARCHAR(255),
  generated_by    UUID         REFERENCES users(id),
  generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  payload_meta    JSONB                       -- non-sensitive metadata: counts, date range
);

CREATE INDEX IF NOT EXISTS report_exports_sha256_idx ON report_exports(sha256);
CREATE INDEX IF NOT EXISTS report_exports_tenant_idx ON report_exports(tenant_id);
