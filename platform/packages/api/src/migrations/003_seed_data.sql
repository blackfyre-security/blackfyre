-- Production guard: abort if running in production
DO $$
BEGIN
  IF current_setting('app.env', true) IS NULL OR current_setting('app.env', true) != 'development' THEN
    RAISE EXCEPTION 'Seed data must not run in production';
  END IF;
END $$;

-- 002_seed_data.sql
-- Development/demo seed data for the BLACKFYRE platform.
-- WARNING: Do NOT run in production. Passwords are a well-known dev-only value.

BEGIN;

-- ============================================================================
-- TENANTS
-- ============================================================================

INSERT INTO tenants (id, name, slug, plan, industry_profile, onboarding_status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'acme-corp', 'protect', 'fintech', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'HealthFirst', 'healthfirst', 'defend', 'healthtech', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'CloudSaaS Inc', 'cloudsaas', 'comply', 'saas', 'configuring')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- USERS
-- password_hash is a REAL argon2id hash of "password123" (dev only — never use
-- this password anywhere real). FOUND DURING COMMUNITY DOCS VERIFICATION
-- (2026-07): the previous value here was not a real argon2 hash at all — it
-- was a base64-encoded literal placeholder string ("claudeflowpasswordhashdemo...")
-- that looked plausible but failed verify() for any password, so none of these
-- seeded logins actually worked. Regenerated with the project's own
-- @node-rs/argon2 hash() so `npm run migrate` produces a genuinely working
-- local login out of the box.
-- ============================================================================

INSERT INTO users (id, tenant_id, email, name, password_hash, role)
VALUES
  (
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'admin@acme.com',
    'Admin User',
    '$argon2id$v=19$m=19456,t=2,p=1$JtaAUTbPgJaOTkkZm/7arg$0BRZTh5fKCpw2RPnKbIVfjipGVu837Hs46ZKFd5qZLU',
    'owner'
  ),
  (
    'aaaa2222-aaaa-2222-aaaa-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'engineer@acme.com',
    'Engineer User',
    '$argon2id$v=19$m=19456,t=2,p=1$JtaAUTbPgJaOTkkZm/7arg$0BRZTh5fKCpw2RPnKbIVfjipGVu837Hs46ZKFd5qZLU',
    'engineer'
  ),
  (
    'aaaa3333-aaaa-3333-aaaa-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'viewer@acme.com',
    'Viewer User',
    '$argon2id$v=19$m=19456,t=2,p=1$JtaAUTbPgJaOTkkZm/7arg$0BRZTh5fKCpw2RPnKbIVfjipGVu837Hs46ZKFd5qZLU',
    'viewer'
  ),
  (
    'bbbb1111-bbbb-1111-bbbb-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'admin@healthfirst.com',
    'Health Admin',
    '$argon2id$v=19$m=19456,t=2,p=1$JtaAUTbPgJaOTkkZm/7arg$0BRZTh5fKCpw2RPnKbIVfjipGVu837Hs46ZKFd5qZLU',
    'owner'
  ),
  (
    'bbbb2222-bbbb-2222-bbbb-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'engineer@healthfirst.com',
    'Health Engineer',
    '$argon2id$v=19$m=19456,t=2,p=1$JtaAUTbPgJaOTkkZm/7arg$0BRZTh5fKCpw2RPnKbIVfjipGVu837Hs46ZKFd5qZLU',
    'engineer'
  ),
  (
    'cccc1111-cccc-1111-cccc-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'admin@cloudsaas.com',
    'CloudSaaS Admin',
    '$argon2id$v=19$m=19456,t=2,p=1$JtaAUTbPgJaOTkkZm/7arg$0BRZTh5fKCpw2RPnKbIVfjipGVu837Hs46ZKFd5qZLU',
    'owner'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INTEGRATIONS
-- ============================================================================

INSERT INTO integrations (id, tenant_id, type, credential_ref, status, last_verified_at)
VALUES
  (
    'dddd1111-dddd-1111-dddd-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'aws',
    'vault://acme/aws-creds',
    'active',
    NOW() - INTERVAL '2 hours'
  ),
  (
    'dddd2222-dddd-2222-dddd-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'okta',
    'vault://acme/okta-creds',
    'active',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'dddd3333-dddd-3333-dddd-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'aws',
    'vault://healthfirst/aws-creds',
    'active',
    NOW() - INTERVAL '3 hours'
  ),
  (
    'dddd4444-dddd-4444-dddd-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'azure',
    'vault://healthfirst/azure-creds',
    'active',
    NOW() - INTERVAL '5 hours'
  ),
  (
    'dddd5555-dddd-5555-dddd-555555555555',
    '33333333-3333-3333-3333-333333333333',
    'gcp',
    'vault://cloudsaas/gcp-creds',
    'active',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCANS (completed scan for Acme Corp)
-- ============================================================================

INSERT INTO scans (id, tenant_id, triggered_by, frameworks, targets, status, progress, started_at, completed_at, agent_swarm_id)
VALUES
  (
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    ARRAY['soc2', 'iso27001'],
    ARRAY['aws:*', 'okta:*'],
    'completed',
    100,
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '3 hours',
    'swarm-acme-20260325-001'
  ),
  (
    'eeee2222-eeee-2222-eeee-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'bbbb1111-bbbb-1111-bbbb-111111111111',
    ARRAY['hipaa'],
    ARRAY['aws:*', 'azure:*'],
    'completed',
    100,
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '5 hours',
    'swarm-healthfirst-20260325-001'
  ),
  (
    'eeee3333-eeee-3333-eeee-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'aaaa2222-aaaa-2222-aaaa-222222222222',
    ARRAY['soc2'],
    ARRAY['aws:s3:*'],
    'queued',
    0,
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FINDINGS (for Acme Corp completed scan)
-- ============================================================================

INSERT INTO findings (id, scan_id, tenant_id, title, description, severity, status, category, resource_type, resource_id, resource_region, remediation_tier, auto_fix_available, dedup_hash)
VALUES
  -- Critical: Root account MFA disabled
  (
    'ffff1111-ffff-1111-ffff-111111111111',
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'AWS root account MFA not enabled',
    'The AWS root account does not have multi-factor authentication enabled. This is a critical security risk as the root account has unrestricted access to all AWS services and resources.',
    'critical',
    'open',
    'iam',
    'aws:iam:root',
    'arn:aws:iam::123456789012:root',
    'global',
    'manual',
    FALSE,
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
  ),
  -- High: S3 bucket public
  (
    'ffff2222-ffff-2222-ffff-222222222222',
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'S3 bucket allows public read access',
    'The S3 bucket "acme-data-exports" has a bucket policy that allows public read access. This could lead to data exposure of sensitive financial records.',
    'high',
    'in_progress',
    'encryption',
    'aws:s3:bucket',
    'arn:aws:s3:::acme-data-exports',
    'us-east-1',
    'auto',
    TRUE,
    'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3'
  ),
  -- High: CloudTrail not enabled
  (
    'ffff3333-ffff-3333-ffff-333333333333',
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'CloudTrail logging not enabled in all regions',
    'AWS CloudTrail is not enabled in all regions. Without comprehensive trail logging, security events in non-monitored regions will go undetected.',
    'high',
    'open',
    'logging',
    'aws:cloudtrail:trail',
    'arn:aws:cloudtrail:us-east-1:123456789012:trail/main',
    'us-east-1',
    'approval',
    TRUE,
    'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
  ),
  -- Medium: Security group overly permissive
  (
    'ffff4444-ffff-4444-ffff-444444444444',
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Security group allows unrestricted SSH access',
    'Security group sg-0a1b2c3d allows inbound SSH (port 22) from 0.0.0.0/0. This should be restricted to known IP ranges.',
    'medium',
    'acknowledged',
    'network',
    'aws:ec2:security-group',
    'sg-0a1b2c3d4e5f6a1b2',
    'us-east-1',
    'approval',
    TRUE,
    'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'
  ),
  -- Low: Password policy could be stronger
  (
    'ffff5555-ffff-5555-ffff-555555555555',
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'IAM password policy allows short passwords',
    'The IAM password policy requires only 8 characters minimum. Best practice recommends at least 14 characters for enterprise environments.',
    'low',
    'open',
    'iam',
    'aws:iam:password-policy',
    'arn:aws:iam::123456789012:account-password-policy',
    'global',
    'manual',
    FALSE,
    'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'
  ),
  -- Info: Okta SSO configured
  (
    'ffff6666-ffff-6666-ffff-666666666666',
    'eeee1111-eeee-1111-eeee-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Okta SSO properly configured with MFA enforcement',
    'Okta integration is properly configured with MFA enforcement for all users. This meets SOC2 and ISO 27001 authentication requirements.',
    'info',
    'resolved',
    'identity',
    'okta:application',
    'okta-app-acme-prod-001',
    NULL,
    'manual',
    FALSE,
    'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'
  ),
  -- HealthFirst finding (HIPAA-related)
  (
    'ffff7777-ffff-7777-ffff-777777777777',
    'eeee2222-eeee-2222-eeee-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'PHI data stored without encryption at rest',
    'An Azure Blob Storage container holding patient health information (PHI) does not have encryption at rest enabled, violating HIPAA 164.312(a)(2)(iv).',
    'critical',
    'open',
    'encryption',
    'azure:storage:container',
    '/subscriptions/sub-123/resourceGroups/rg-prod/providers/Microsoft.Storage/storageAccounts/hfphi/blobServices/default/containers/patient-records',
    'eastus',
    'approval',
    FALSE,
    'a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8'
  ),
  -- HealthFirst finding (logging)
  (
    'ffff8888-ffff-8888-ffff-888888888888',
    'eeee2222-eeee-2222-eeee-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'Audit logging not enabled for Azure SQL Database',
    'Azure SQL Database hosting PHI records does not have auditing enabled. HIPAA requires detailed audit trails for all access to protected health information.',
    'high',
    'open',
    'logging',
    'azure:sql:database',
    '/subscriptions/sub-123/resourceGroups/rg-prod/providers/Microsoft.Sql/servers/hf-prod/databases/patients',
    'eastus',
    'auto',
    TRUE,
    'b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CONTROL MAPPINGS (for Acme Corp findings)
-- ============================================================================

INSERT INTO control_mappings (id, finding_id, framework, control_id, control_name, status, weight)
VALUES
  -- Root MFA -> SOC2 CC6.1
  (
    '11110001-0001-0001-0001-000000000001',
    'ffff1111-ffff-1111-ffff-111111111111',
    'soc2',
    'CC6.1',
    'Logical Access Security - Authentication',
    'fail',
    3
  ),
  -- Root MFA -> ISO 27001 A.9.4.2
  (
    '11110001-0001-0001-0001-000000000002',
    'ffff1111-ffff-1111-ffff-111111111111',
    'iso27001',
    'A.9.4.2',
    'Secure log-on procedures',
    'fail',
    2
  ),
  -- S3 public access -> SOC2 CC6.6
  (
    '11110001-0001-0001-0001-000000000003',
    'ffff2222-ffff-2222-ffff-222222222222',
    'soc2',
    'CC6.6',
    'Logical Access Security - External Access',
    'fail',
    2
  ),
  -- CloudTrail -> SOC2 CC7.2
  (
    '11110001-0001-0001-0001-000000000004',
    'ffff3333-ffff-3333-ffff-333333333333',
    'soc2',
    'CC7.2',
    'System Operations - Monitoring',
    'fail',
    2
  ),
  -- CloudTrail -> ISO 27001 A.12.4.1
  (
    '11110001-0001-0001-0001-000000000005',
    'ffff3333-ffff-3333-ffff-333333333333',
    'iso27001',
    'A.12.4.1',
    'Event logging',
    'fail',
    2
  ),
  -- Security group -> SOC2 CC6.6
  (
    '11110001-0001-0001-0001-000000000006',
    'ffff4444-ffff-4444-ffff-444444444444',
    'soc2',
    'CC6.6',
    'Logical Access Security - External Access',
    'partial',
    1
  ),
  -- Okta SSO -> SOC2 CC6.1 (pass)
  (
    '11110001-0001-0001-0001-000000000007',
    'ffff6666-ffff-6666-ffff-666666666666',
    'soc2',
    'CC6.1',
    'Logical Access Security - Authentication',
    'pass',
    2
  ),
  -- PHI encryption -> HIPAA 164.312(a)(2)(iv)
  (
    '11110001-0001-0001-0001-000000000008',
    'ffff7777-ffff-7777-ffff-777777777777',
    'hipaa',
    '164.312(a)(2)(iv)',
    'Encryption and Decryption',
    'fail',
    3
  ),
  -- Audit logging -> HIPAA 164.312(b)
  (
    '11110001-0001-0001-0001-000000000009',
    'ffff8888-ffff-8888-ffff-888888888888',
    'hipaa',
    '164.312(b)',
    'Audit Controls',
    'fail',
    2
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- EVIDENCE (for selected findings)
-- ============================================================================

INSERT INTO evidence (id, finding_id, tenant_id, type, storage_path, sha256_hash, collected_at, collected_by)
VALUES
  (
    'eedd0001-eedd-0001-eedd-000000000001',
    'ffff1111-ffff-1111-ffff-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'api_response',
    's3://blackfyre-evidence/acme/scans/eeee1111/root-mfa-check.json',
    'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    NOW() - INTERVAL '3 hours',
    'agent:iam-scanner'
  ),
  (
    'eedd0001-eedd-0001-eedd-000000000002',
    'ffff2222-ffff-2222-ffff-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'config_snapshot',
    's3://blackfyre-evidence/acme/scans/eeee1111/s3-bucket-policy.json',
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    NOW() - INTERVAL '3 hours',
    'agent:s3-scanner'
  ),
  (
    'eedd0001-eedd-0001-eedd-000000000003',
    'ffff7777-ffff-7777-ffff-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'config_snapshot',
    's3://blackfyre-evidence/healthfirst/scans/eeee2222/blob-encryption.json',
    '7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    NOW() - INTERVAL '5 hours',
    'agent:azure-storage-scanner'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- REMEDIATIONS
-- ============================================================================

INSERT INTO remediations (id, finding_id, tier, status, approved_by, before_snapshot, after_snapshot, playbook_content, executed_at, completed_at)
VALUES
  -- Auto-fix for S3 public access (in progress)
  (
    'aadd0001-aadd-0001-aadd-000000000001',
    'ffff2222-ffff-2222-ffff-222222222222',
    'auto',
    'executing',
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    '{"bucket_policy": {"Statement": [{"Effect": "Allow", "Principal": "*", "Action": "s3:GetObject"}]}}',
    NULL,
    'aws s3api put-bucket-policy --bucket acme-data-exports --policy file://deny-public.json',
    NOW() - INTERVAL '1 hour',
    NULL
  ),
  -- Manual remediation for root MFA (pending)
  (
    'aadd0001-aadd-0001-aadd-000000000002',
    'ffff1111-ffff-1111-ffff-111111111111',
    'manual',
    'pending',
    NULL,
    NULL,
    NULL,
    'Navigate to AWS Console > IAM > Dashboard > Activate MFA on your root account. Use a hardware MFA device for highest security.',
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ALERT RULES
-- ============================================================================

INSERT INTO alert_rules (id, tenant_id, trigger_type, trigger_config, channels, quiet_hours_start, quiet_hours_end, quiet_hours_tz, enabled)
VALUES
  -- Acme: critical severity alerts
  (
    'aabb0001-aabb-0001-aabb-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'severity',
    '{"min_severity": "critical"}',
    ARRAY['slack:#security-alerts', 'email:security-team@acme.com'],
    '22:00',
    '07:00',
    'America/New_York',
    TRUE
  ),
  -- Acme: drift detection alerts
  (
    'aabb0001-aabb-0001-aabb-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'drift',
    '{"resource_types": ["aws:iam:*", "aws:s3:*"]}',
    ARRAY['slack:#infra-drift'],
    NULL,
    NULL,
    NULL,
    TRUE
  ),
  -- Acme: scan completion alerts
  (
    'aabb0001-aabb-0001-aabb-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'scan_complete',
    '{}',
    ARRAY['email:admin@acme.com'],
    NULL,
    NULL,
    NULL,
    TRUE
  ),
  -- HealthFirst: critical + high severity alerts
  (
    'aabb0001-aabb-0001-aabb-000000000004',
    '22222222-2222-2222-2222-222222222222',
    'severity',
    '{"min_severity": "high"}',
    ARRAY['slack:#hipaa-alerts', 'pager:oncall-security'],
    NULL,
    NULL,
    NULL,
    TRUE
  ),
  -- HealthFirst: regulatory deadline alerts
  (
    'aabb0001-aabb-0001-aabb-000000000005',
    '22222222-2222-2222-2222-222222222222',
    'regulatory',
    '{"framework": "hipaa", "deadline_days_warning": 30}',
    ARRAY['email:compliance@healthfirst.com', 'slack:#compliance'],
    NULL,
    NULL,
    NULL,
    TRUE
  ),
  -- CloudSaaS: score drop alerts
  (
    'aabb0001-aabb-0001-aabb-000000000006',
    '33333333-3333-3333-3333-333333333333',
    'score_drop',
    '{"threshold_percent": 5}',
    ARRAY['email:admin@cloudsaas.com'],
    NULL,
    NULL,
    NULL,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- REPORTS
-- ============================================================================

INSERT INTO reports (id, tenant_id, type, framework, status, storage_path, share_token, generated_at, expires_at)
VALUES
  (
    'ccdd0001-ccdd-0001-ccdd-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'readiness',
    'soc2',
    'ready',
    's3://blackfyre-reports/acme/soc2-readiness-20260325.pdf',
    'tk_acme_soc2_abcdef1234567890abcdef1234567890abcdef12',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '30 days'
  ),
  (
    'ccdd0001-ccdd-0001-ccdd-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'gap_analysis',
    'hipaa',
    'ready',
    's3://blackfyre-reports/healthfirst/hipaa-gap-20260325.pdf',
    'tk_hf_hipaa_1234567890abcdef1234567890abcdef12345678',
    NOW() - INTERVAL '4 hours',
    NOW() + INTERVAL '30 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMPLIANCE SCORES (from completed scans)
-- ============================================================================

INSERT INTO compliance_scores (id, tenant_id, scan_id, framework, score, pass_count, partial_count, fail_count, na_count, total_controls, snapshot_at)
VALUES
  -- Acme Corp SOC2 scores
  (
    'cc110001-cc11-0001-cc11-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'eeee1111-eeee-1111-eeee-111111111111',
    'soc2',
    68,
    45,
    8,
    12,
    5,
    70,
    NOW() - INTERVAL '3 hours'
  ),
  -- Acme Corp ISO 27001 scores
  (
    'cc110001-cc11-0001-cc11-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'eeee1111-eeee-1111-eeee-111111111111',
    'iso27001',
    72,
    82,
    10,
    14,
    8,
    114,
    NOW() - INTERVAL '3 hours'
  ),
  -- HealthFirst HIPAA scores
  (
    'cc110001-cc11-0001-cc11-000000000003',
    '22222222-2222-2222-2222-222222222222',
    'eeee2222-eeee-2222-eeee-222222222222',
    'hipaa',
    55,
    30,
    5,
    18,
    2,
    55,
    NOW() - INTERVAL '5 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LEARNING PATTERNS (global cross-tenant patterns)
-- ============================================================================

INSERT INTO learning_patterns (id, pattern_type, industry, framework, category, metric, value, sample_size, confidence, last_updated_at)
VALUES
  (
    'ddee0001-ddee-0001-ddee-000000000001',
    'remediation_time',
    'fintech',
    'soc2',
    'iam',
    'avg_days_to_resolve_critical',
    3,
    150,
    85,
    NOW() - INTERVAL '1 day'
  ),
  (
    'ddee0001-ddee-0001-ddee-000000000002',
    'common_finding',
    'fintech',
    'soc2',
    'encryption',
    'percent_orgs_with_s3_public_buckets',
    34,
    200,
    90,
    NOW() - INTERVAL '1 day'
  ),
  (
    'ddee0001-ddee-0001-ddee-000000000003',
    'compliance_trend',
    'healthtech',
    'hipaa',
    'encryption',
    'avg_initial_score',
    52,
    80,
    78,
    NOW() - INTERVAL '2 days'
  ),
  (
    'ddee0001-ddee-0001-ddee-000000000004',
    'remediation_time',
    'saas',
    'soc2',
    'logging',
    'avg_days_to_resolve_high',
    5,
    120,
    82,
    NOW() - INTERVAL '3 days'
  ),
  (
    'ddee0001-ddee-0001-ddee-000000000005',
    'common_finding',
    'healthtech',
    'hipaa',
    'logging',
    'percent_orgs_missing_audit_trails',
    61,
    80,
    75,
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DRIFT EVENTS (recent drift for Acme)
-- ============================================================================

INSERT INTO drift_events (id, tenant_id, integration_id, change_type, resource_type, resource_id, before_state, after_state, severity, acknowledged, detected_at)
VALUES
  (
    'eeaa0001-eeaa-0001-eeaa-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'dddd1111-dddd-1111-dddd-111111111111',
    'modified',
    'aws:s3:bucket-policy',
    'arn:aws:s3:::acme-internal-docs',
    '{"Statement": [{"Effect": "Deny", "Principal": "*", "Action": "s3:*", "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}',
    '{"Statement": []}',
    'high',
    FALSE,
    NOW() - INTERVAL '30 minutes'
  ),
  (
    'eeaa0001-eeaa-0001-eeaa-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'dddd1111-dddd-1111-dddd-111111111111',
    'created',
    'aws:ec2:security-group',
    'sg-0newrule12345678',
    NULL,
    '{"GroupName": "temp-debug", "IpPermissions": [{"FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}]}',
    'medium',
    FALSE,
    NOW() - INTERVAL '15 minutes'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
