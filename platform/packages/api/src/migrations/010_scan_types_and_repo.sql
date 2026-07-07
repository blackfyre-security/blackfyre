-- Migration 010: Add scan types, repo source, and artifact bucket to scans table
-- Supports Prowler deep scanning and IaC scanning integration

ALTER TABLE scans ADD COLUMN scan_types text[] NOT NULL DEFAULT ARRAY['quick'];
ALTER TABLE scans ADD COLUMN repo_source jsonb;
ALTER TABLE scans ADD COLUMN artifact_bucket text;

-- Validate scan_types values
ALTER TABLE scans ADD CONSTRAINT scans_scan_types_check
  CHECK (scan_types <@ ARRAY['quick', 'deep', 'iac']::text[]);

-- Add source column to findings for tracking which scanner produced the finding
ALTER TABLE findings ADD COLUMN source text NOT NULL DEFAULT 'custom';
ALTER TABLE findings ADD CONSTRAINT findings_source_check
  CHECK (source IN ('custom', 'prowler', 'checkov', 'semgrep', 'bandit'));

-- Add remediation notes for enriched findings from Prowler/IaC scanners
ALTER TABLE findings ADD COLUMN remediation_notes text;

-- Add 'iac' to the finding category enum
ALTER TYPE finding_category ADD VALUE IF NOT EXISTS 'iac';

-- Add 'storage' to finding category if not present (used by Prowler S3 findings)
ALTER TYPE finding_category ADD VALUE IF NOT EXISTS 'storage';

-- Index for filtering findings by source
CREATE INDEX findings_source_idx ON findings (source);
