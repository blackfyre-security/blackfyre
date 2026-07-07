-- Migration 017 — Contact form submissions + lead notification recipients
-- Captures leads from the public marketing website ("Book a discovery call"
-- form on blackfyre.tech) and the list of internal email addresses notified
-- when a new lead arrives.

CREATE TYPE contact_submission_status AS ENUM (
  'new', 'contacted', 'qualified', 'archived', 'spam'
);

CREATE TABLE contact_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(200) NOT NULL,
  email           varchar(320) NOT NULL,
  company         varchar(200),
  preferred_date  varchar(32),
  preferred_time  varchar(32),
  topic           varchar(100),
  message         text,
  source          varchar(64) NOT NULL DEFAULT 'website-booking',
  ip_address      varchar(64),
  user_agent      text,
  status          contact_submission_status NOT NULL DEFAULT 'new',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_submissions_email_idx   ON contact_submissions(email);
CREATE INDEX contact_submissions_status_idx  ON contact_submissions(status);
CREATE INDEX contact_submissions_created_idx ON contact_submissions(created_at DESC);

CREATE TABLE lead_notification_recipients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       varchar(320) NOT NULL UNIQUE,
  name        varchar(200),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_notification_recipients_active_idx
  ON lead_notification_recipients(is_active);

-- Seed the founder so notifications work the moment SMTP is configured.
INSERT INTO lead_notification_recipients (email, name)
VALUES ('founder@blackfyre.tech', 'Founder')
ON CONFLICT (email) DO NOTHING;

-- These tables intentionally have NO tenant_id — leads from the marketing
-- website are pre-tenant. They're cross-tenant operational data (like
-- regulatory_changes, control_cross_mappings). No RLS policy applied.
