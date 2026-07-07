# BLACKFYRE Data Collection Policy

**Version:** 1.0  **Date:** 2026-03-28  **Requirement:** FOUND-06

## Principle
BLACKFYRE agents collect only the minimum data necessary to assess security posture. No PII, customer records, or business content is ever collected.

## What We Collect Per Agent

### AWS Agent
- IAM: policy documents, role trust relationships, user/group memberships (no passwords or access keys)
- S3: bucket ACLs, encryption config, versioning status (no object contents)
- EC2: security group rules, VPC config, instance metadata (no user data payloads)
- CloudTrail: trail config status, log validation (no log contents)
- KMS: key rotation status, key policy (no key material)

### Azure Agent (Phase 4)
- IAM: role assignments, conditional access policies
- Storage: account access tiers, encryption, soft delete config
- Key Vault: access policies, soft delete, purge protection

### GCP Agent (Phase 4)
- IAM: policy bindings, service account key ages
- Storage: bucket IAM, encryption config
- KMS: key rotation, CryptoKey version status

### On-Premise Agent (Phase 6)
- Server: patch level, running services, open ports
- Active Directory: user accounts, group memberships, GPO settings (no passwords)
- Network devices: SNMP config, open ports (no routing tables or traffic)

## What We Never Collect
- Passwords, private keys, or secret values
- Customer PII or business data
- File contents, database records, or application data
- Network traffic payloads or packet contents

## Enforcement
1. Every integration has an `allowed_scopes` field listing permitted collection scopes
2. Agent findings are validated against `allowed_scopes` before DB write
3. Findings outside allowed scopes are dropped and logged as policy violations
4. Tenants can restrict scopes further via the Integrations settings page
