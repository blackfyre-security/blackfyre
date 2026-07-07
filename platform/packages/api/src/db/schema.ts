import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Enums ---

export const tenantPlanEnum = pgEnum("tenant_plan", [
  "comply", "protect", "defend",
]);
export const industryProfileEnum = pgEnum("industry_profile", [
  "fintech", "healthtech", "saas", "ecommerce", "aitech", "custom", "government",
]);
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "pending", "configuring", "scanning", "active", "suspended",
]);
export const userRoleEnum = pgEnum("user_role", [
  "owner", "admin", "engineer", "viewer", "auditor",
]);
export const integrationTypeEnum = pgEnum("integration_type", [
  "aws", "azure", "gcp", "okta", "azure_ad", "google_workspace",
  "jamf", "intune", "crowdstrike", "network",
]);
export const integrationStatusEnum = pgEnum("integration_status", [
  "active", "error", "expired",
]);
export const scanStatusEnum = pgEnum("scan_status", [
  "queued", "running", "completed", "completed_partial", "failed", "cancelled",
]);
export const severityEnum = pgEnum("severity", [
  "critical", "high", "medium", "low", "info",
]);
export const findingStatusEnum = pgEnum("finding_status", [
  "open", "acknowledged", "in_progress", "resolved", "dismissed",
]);
export const findingCategoryEnum = pgEnum("finding_category", [
  "iam", "encryption", "logging", "network", "endpoint", "identity", "config", "iac", "storage",
]);
export const remediationTierEnum = pgEnum("remediation_tier", [
  "auto", "approval", "manual",
]);
export const frameworkEnum = pgEnum("framework", [
  "soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "iso42001", "pdppl", "nist80053",
]);
export const controlStatusEnum = pgEnum("control_status", [
  "pass", "partial", "fail", "na",
]);
export const evidenceTypeEnum = pgEnum("evidence_type", [
  "config_snapshot", "api_response", "screenshot", "manual_upload",
]);
export const remediationStatusEnum = pgEnum("remediation_status", [
  "pending", "approved", "executing", "completed", "failed", "rolled_back",
]);
export const alertTriggerTypeEnum = pgEnum("alert_trigger_type", [
  "severity", "score_drop", "drift", "scan_complete", "deadline", "regulatory",
]);
export const reportTypeEnum = pgEnum("report_type", [
  "readiness", "evidence_package", "board_summary", "gap_analysis",
]);
export const reportStatusEnum = pgEnum("report_status", [
  "generating", "ready", "failed",
]);
export const driftChangeTypeEnum = pgEnum("drift_change_type", [
  "created", "modified", "deleted",
]);

// --- Pre-prod foundation enums (added 2026-05-11, marathon/preprod-foundation) ---
export const regionEnum = pgEnum("region", [
  "us-east-1", "us-east-2", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "me-south-1", "sa-east-1",
]);
export const tenantStatusEnum = pgEnum("tenant_status", [
  "trial", "active", "suspended", "churned",
]);
export const cloudProviderEnum = pgEnum("cloud_provider", [
  "aws", "azure", "gcp",
]);
export const cloudAccountStatusEnum = pgEnum("cloud_account_status", [
  "pending", "verifying", "verified", "error", "suspended",
]);
export const contactRoleEnum = pgEnum("contact_role", [
  "primary_spoc", "billing", "security", "technical", "executive", "legal", "oncall_24x7",
]);
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user", "system", "integration", "api_key",
]);
export const vaultProviderEnum = pgEnum("vault_provider", [
  "aws_secrets_manager", "hashicorp_vault", "aws_kms_inline",
]);

// --- Tables ---

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountNumber: varchar("account_number", { length: 20 })
    .notNull()
    .default(sql`'BFR-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('tenant_account_seq')::text, 6, '0')`),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  plan: tenantPlanEnum("plan").notNull(),
  industryProfile: industryProfileEnum("industry_profile").notNull().default("custom"),
  onboardingStatus: onboardingStatusEnum("onboarding_status").notNull().default("pending"),
  // --- Pre-prod foundation (2026-05-11) ---
  clientNumber: varchar("client_number", { length: 32 }).unique(),
  legalName: varchar("legal_name", { length: 300 }),
  displayName: varchar("display_name", { length: 200 }),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  region: regionEnum("region").notNull().default("us-east-1"),
  status: tenantStatusEnum("status").notNull().default("trial"),
  contractStartDate: timestamp("contract_start_date", { withTimezone: true }),
  renewalDate: timestamp("renewal_date", { withTimezone: true }),
  mrrCents: integer("mrr_cents").notNull().default(0),
  mfaRequired: boolean("mfa_required").notNull().default(false),
  ssoEnabled: boolean("sso_enabled").notNull().default(false),
  dataResidencyRegion: regionEnum("data_residency_region"),
  tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
  tosVersion: varchar("tos_version", { length: 20 }),
  dpaSignedAt: timestamp("dpa_signed_at", { withTimezone: true }),
  dpaSignerName: varchar("dpa_signer_name", { length: 200 }),
  dpaSignerEmail: varchar("dpa_signer_email", { length: 320 }),
  // --- Tenant-admin marathon (2026-05-12) ---
  customPlanLabel: varchar("custom_plan_label", { length: 120 }),
  monthlyPriceInr: integer("monthly_price_inr"),
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): Stripe billing columns referenced via `as any` in
  // routes/payments-stripe.ts but absent from the Drizzle model — the untyped casts hid the fact that
  // checkout/webhook writes targeted non-existent columns. Adding them restores type safety so the
  // build catches typos and the billing path writes to real, indexed columns. Additive & nullable:
  // Razorpay-only tenants keep NULLs. stripe_customer_id / stripe_subscription_id already exist at the
  // SQL level (migration 021); declaring them here closes the schema/code drift. Migration 011 adds
  // the remaining price/status/period columns the lifecycle handlers will populate.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: varchar("subscription_status", { length: 40 }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clientNumberIdx: index("tenants_client_number_idx").on(table.clientNumber),
  statusIdx: index("tenants_status_idx").on(table.status),
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): partial index on stripe_customer_id —
  // the webhook handler looks tenants up by customer id on subscription.deleted; without
  // an index that is a full table scan per webhook (a cheap DoS amplifier).
  stripeCustomerIdx: index("tenants_stripe_customer_id_idx").on(table.stripeCustomerId),
}));

export const tenantFeatures = pgTable("tenant_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  featureKey: varchar("feature_key", { length: 80 }).notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason"),
  grantedBy: uuid("granted_by"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("tenant_features_tenant_idx").on(table.tenantId),
  featureIdx: index("tenant_features_feature_idx").on(table.featureKey),
}));

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: varchar("prefix", { length: 12 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: integrationTypeEnum("type").notNull(),
  credentialRef: text("credential_ref").notNull(),
  status: integrationStatusEnum("status").notNull().default("active"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("integrations_tenant_id_idx").on(table.tenantId),
}));

export const scans = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  triggeredBy: uuid("triggered_by").notNull().references(() => users.id),
  frameworks: text("frameworks").array().notNull(),
  targets: text("targets").array().notNull(),
  scanTypes: text("scan_types").array().notNull().default(sql`ARRAY['quick']`),
  repoSource: jsonb("repo_source"),
  artifactBucket: text("artifact_bucket"),
  status: scanStatusEnum("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorDetails: text("error_details"),
  agentSwarmId: text("agent_swarm_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("scans_tenant_id_idx").on(table.tenantId),
  statusIdx: index("scans_status_idx").on(table.status),
  tenantStatusIdx: index("scans_tenant_status_idx").on(table.tenantId, table.status),
}));

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
  status: findingStatusEnum("status").notNull().default("open"),
  category: findingCategoryEnum("category").notNull(),
  resourceType: varchar("resource_type", { length: 200 }),
  resourceId: varchar("resource_id", { length: 500 }),
  resourceRegion: varchar("resource_region", { length: 100 }),
  remediationTier: remediationTierEnum("remediation_tier").notNull(),
  autoFixAvailable: boolean("auto_fix_available").notNull().default(false),
  dedupHash: varchar("dedup_hash", { length: 64 }).notNull(),
  source: text("source").notNull().default("custom"),
  remediationNotes: text("remediation_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("findings_tenant_id_idx").on(table.tenantId),
  scanIdx: index("findings_scan_id_idx").on(table.scanId),
  severityIdx: index("findings_severity_idx").on(table.severity),
  // Existing non-unique index retained for back-compat (other queries/plans may reference it).
  tenantDedupIdx: index("findings_tenant_dedup_idx").on(table.tenantId, table.dedupHash),
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): finding dedup. services/finding-service.ts checks
  // for an existing (tenant_id, dedup_hash) row OUTSIDE its insert transaction; with only the
  // non-unique index above, two concurrent scans both see "no existing" and both insert, creating
  // duplicate findings (inflated risk counts, double-counted controls). This UNIQUE index enforces
  // the dedup key at the DB level so the read-then-write race becomes an idempotent upsert
  // (ON CONFLICT (tenant_id, dedup_hash)) — the second writer updates instead of duplicating.
  tenantDedupUnique: uniqueIndex("findings_tenant_dedup_unique").on(table.tenantId, table.dedupHash),
  sourceIdx: index("findings_source_idx").on(table.source),
}));

export const controlMappings = pgTable("control_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").notNull().references(() => findings.id),
  framework: frameworkEnum("framework").notNull(),
  controlId: varchar("control_id", { length: 50 }).notNull(),
  controlName: varchar("control_name", { length: 300 }).notNull(),
  status: controlStatusEnum("status").notNull(),
  weight: integer("weight").notNull().default(1),
}, (table) => ({
  findingIdx: index("control_mappings_finding_id_idx").on(table.findingId),
  frameworkIdx: index("control_mappings_framework_idx").on(table.framework),
}));

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").notNull().references(() => findings.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: evidenceTypeEnum("type").notNull(),
  storagePath: text("storage_path").notNull(),
  sha256Hash: varchar("sha256_hash", { length: 64 }).notNull(),
  // REAL IMPL (BLACKFYRE 2026-06): tamper-evidence honesty. `hashSource` records what
  // sha256Hash was actually computed over: "content" (caller-supplied bytes),
  // "reference-fetch" (bytes we fetched from a URL via safeFetch), or "metadata-only"
  // (no content available — hash is over collection metadata and is NOT content-tamper-
  // evident). `integrityVerified` is true ONLY when the hash covers real evidence bytes.
  hashSource: varchar("hash_source", { length: 20 }).notNull().default("metadata-only"),
  integrityVerified: boolean("integrity_verified").notNull().default(false),
  framework: varchar("framework", { length: 20 }),
  s3ObjectKey: text("s3_object_key"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  collectedBy: varchar("collected_by", { length: 200 }).notNull(),
}, (table) => ({
  findingIdx: index("evidence_finding_id_idx").on(table.findingId),
  tenantIdx: index("evidence_tenant_id_idx").on(table.tenantId),
}));

export const auditorFrameworks = pgTable("auditor_frameworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  framework: varchar("framework", { length: 20 }).notNull(),
  assignedBy: uuid("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("auditor_frameworks_user_idx").on(table.userId),
  tenantIdx: index("auditor_frameworks_tenant_idx").on(table.tenantId),
}));

// REAL IMPL (BLACKFYRE 2026-06): durable, append-only, tamper-evident evidence
// ledger. Backs EvidenceChainService, which previously stored the "tamper-evident
// audit ledger" in a volatile in-memory Map (lost on restart). Each row is one
// hash-chained, optionally HMAC-signed chain entry. See migration
// 022_evidence_chain.sql for the RLS/FORCE-RLS tenant-isolation policy and the
// UNIQUE (tenant_id, seq) constraint that makes the ledger genuinely append-only.
export const evidenceChain = pgTable("evidence_chain", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  evidenceId: text("evidence_id").notNull(),
  seq: integer("seq").notNull(),
  sha256: text("sha256").notNull(),
  prevHash: text("prev_hash").notNull(),
  entryHash: text("entry_hash").notNull(),
  // HMAC-SHA-256 over the canonical payload; null when no server ledger key was
  // configured at append time (entry is hash-chained but not signed).
  entryHmac: text("entry_hmac"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  collectedBy: varchar("collected_by", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantSeqUnique: uniqueIndex("evidence_chain_tenant_seq_unique").on(table.tenantId, table.seq),
  tenantEvidenceIdx: index("evidence_chain_tenant_evidence_idx").on(table.tenantId, table.evidenceId),
  tenantCollectedIdx: index("evidence_chain_tenant_collected_idx").on(table.tenantId, table.collectedAt),
}));

export const remediations = pgTable("remediations", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").notNull().references(() => findings.id),
  tier: remediationTierEnum("tier").notNull(),
  status: remediationStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by").references(() => users.id),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot"),
  playbookContent: text("playbook_content"),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  findingIdx: index("remediations_finding_id_idx").on(table.findingId),
  statusIdx: index("remediations_status_idx").on(table.status),
}));

export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  triggerType: alertTriggerTypeEnum("trigger_type").notNull(),
  triggerConfig: jsonb("trigger_config").notNull(),
  channels: text("channels").array().notNull(),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
  quietHoursTz: varchar("quiet_hours_tz", { length: 50 }),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("alert_rules_tenant_id_idx").on(table.tenantId),
}));

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: reportTypeEnum("type").notNull(),
  framework: varchar("framework", { length: 20 }),
  status: reportStatusEnum("status").notNull().default("generating"),
  storagePath: text("storage_path"),
  shareToken: varchar("share_token", { length: 64 }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const complianceScores = pgTable("compliance_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  framework: frameworkEnum("framework").notNull(),
  score: integer("score").notNull(),
  passCount: integer("pass_count").notNull(),
  partialCount: integer("partial_count").notNull(),
  failCount: integer("fail_count").notNull(),
  naCount: integer("na_count").notNull(),
  totalControls: integer("total_controls").notNull(),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantFrameworkIdx: index("compliance_scores_tenant_fw_idx").on(table.tenantId, table.framework),
  scanIdx: index("compliance_scores_scan_id_idx").on(table.scanId),
}));

export const learningPatterns = pgTable("learning_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  patternType: varchar("pattern_type", { length: 50 }).notNull(),
  industry: industryProfileEnum("industry").notNull(),
  framework: frameworkEnum("framework"),
  category: varchar("category", { length: 200 }).notNull(),
  metric: varchar("metric", { length: 200 }).notNull(),
  value: integer("value").notNull(),
  sampleSize: integer("sample_size").notNull().default(0),
  confidence: integer("confidence").notNull().default(0),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driftEvents = pgTable("drift_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  integrationId: uuid("integration_id").notNull().references(() => integrations.id),
  changeType: driftChangeTypeEnum("change_type").notNull(),
  resourceType: varchar("resource_type", { length: 200 }).notNull(),
  resourceId: varchar("resource_id", { length: 500 }).notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  severity: severityEnum("severity").notNull(),
  acknowledged: boolean("acknowledged").notNull().default(false),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("drift_events_tenant_id_idx").on(table.tenantId),
  integrationIdx: index("drift_events_integration_id_idx").on(table.integrationId),
}));

export const generatedPolicies = pgTable("generated_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  templateId: varchar("template_id", { length: 100 }).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  framework: text("framework").array().notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  content: text("content").notNull(),
  customization: jsonb("customization").notNull(),
  version: varchar("version", { length: 20 }).notNull().default("1.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("generated_policies_tenant_id_idx").on(table.tenantId),
  templateIdx: index("generated_policies_template_id_idx").on(table.templateId),
}));

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  // userId kept for backward-compat with existing rows; new system/integration
  // events use actorType + actorId instead. Nullable for non-user actors.
  userId: uuid("user_id"),
  actorType: auditActorTypeEnum("actor_type").notNull().default("user"),
  actorId: varchar("actor_id", { length: 200 }),
  actorEmail: varchar("actor_email", { length: 320 }),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 500 }),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  outcome: varchar("outcome", { length: 20 }).notNull().default("success"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("audit_logs_tenant_id_idx").on(table.tenantId),
  userIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  actorTypeIdx: index("audit_logs_actor_type_idx").on(table.actorType),
  resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
}));

// --- Report Exports (tamper-evident PDF audit trail; migration 017) ---

export const reportExports = pgTable("report_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  reportType: varchar("report_type", { length: 40 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  signedBy: varchar("signed_by", { length: 120 }).notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  generatedBy: uuid("generated_by").references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  payloadMeta: jsonb("payload_meta"),
}, (table) => ({
  sha256Idx: index("report_exports_sha256_idx").on(table.sha256),
  tenantIdx: index("report_exports_tenant_idx").on(table.tenantId),
}));

// --- AI Ethics & Governance ---

export const aiEthicsReviews = pgTable("ai_ethics_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  reviewType: varchar("review_type", { length: 50 }).notNull(),
  aiSystemId: varchar("ai_system_id", { length: 255 }),
  overallScore: integer("overall_score"),
  dimensions: jsonb("dimensions"),
  findings: jsonb("findings"),
  recommendations: jsonb("recommendations"),
  status: varchar("status", { length: 30 }).notNull().default("completed"),
  reviewedBy: uuid("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("ai_ethics_reviews_tenant_id_idx").on(table.tenantId),
  typeIdx: index("ai_ethics_reviews_type_idx").on(table.reviewType),
}));

export const encryptionModeEnum = pgEnum("encryption_mode", [
  "blackfyre-managed", "client-byok-aws", "client-byok-azure",
]);

export const tenantSovereignty = pgTable("tenant_sovereignty", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().unique().references(() => tenants.id),
  encryptionMode: encryptionModeEnum("encryption_mode").notNull().default("blackfyre-managed"),
  kmsKeyArn: text("kms_key_arn"),
  azureKeyVaultUrl: text("azure_key_vault_url"),
  azureKeyName: text("azure_key_name"),
  allowedRegions: text("allowed_regions").array().notNull().default([]),
  primaryRegion: varchar("primary_region", { length: 100 }).notNull().default("ap-south-1"),
  dataResidencyLaw: varchar("data_residency_law", { length: 50 }),
  geoPinEnforced: boolean("geo_pin_enforced").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("tenant_sovereignty_tenant_id_idx").on(table.tenantId),
}));

export const aiDecisionLog = pgTable("ai_decision_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  decisionType: varchar("decision_type", { length: 100 }).notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  confidence: real("confidence"),
  modelVersion: varchar("model_version", { length: 100 }),
  explainability: jsonb("explainability"),
  humanApproved: boolean("human_approved").notNull().default(false),
  approvedBy: uuid("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("ai_decision_log_tenant_id_idx").on(table.tenantId),
  typeIdx: index("ai_decision_log_type_idx").on(table.decisionType),
}));

export const tenantBranding = pgTable("tenant_branding", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  logoUrl: varchar("logo_url", { length: 500 }),
  primaryColor: varchar("primary_color", { length: 7 }).default("#FF4D00"),
  secondaryColor: varchar("secondary_color", { length: 7 }).default("#F59E0B"),
  companyName: varchar("company_name", { length: 200 }),
  tagline: varchar("tagline", { length: 300 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stakeholderLinks = pgTable("stakeholder_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  frameworks: text("frameworks").array(),
  showRemediation: boolean("show_remediation").default(false),
  showTrend: boolean("show_trend").default(true),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  accessCount: integer("access_count").default(0),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  familyId: uuid("family_id").notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  familyIdx: index("refresh_tokens_family_id_idx").on(table.familyId),
  tokenHashIdx: index("refresh_tokens_token_hash_idx").on(table.tokenHash),
}));

export const ssoConfigs = pgTable("sso_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id).unique(),
  provider: varchar("provider", { length: 50 }).notNull(), // "okta", "azure_ad", "google_workspace", "custom"
  entityId: text("entity_id").notNull(), // IdP Entity ID
  ssoUrl: text("sso_url").notNull(), // IdP SSO URL
  certificate: text("certificate").notNull(), // IdP X.509 certificate (PEM)
  defaultRole: userRoleEnum("default_role").notNull().default("viewer"),
  autoProvision: boolean("auto_provision").notNull().default(true),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// Incident response, copilot & advanced platform tables
// ═══════════════════════════════════════════════════════════════════

export const incidentSeverityEnum = pgEnum("incident_severity", ["p1", "p2", "p3", "p4"]);
export const incidentStatusEnum = pgEnum("incident_status", [
  "detected", "triaged", "investigating", "contained", "remediating", "resolved", "closed",
]);
export const incidentSourceTypeEnum = pgEnum("incident_source_type", ["finding", "drift", "threat"]);
export const agentNameEnum = pgEnum("agent_name", [
  "scout", "shield", "helix", "pulse", "cortex", "ledger", "signal",
]);
export const autopilotActionTypeEnum = pgEnum("autopilot_action_type", [
  "scan", "collect_evidence", "remediate", "report", "alert", "drift_response",
]);
export const autopilotActionStatusEnum = pgEnum("autopilot_action_status", [
  "pending", "approved", "running", "completed", "failed",
]);
export const mappingStrengthEnum = pgEnum("mapping_strength", ["exact", "strong", "partial", "weak"]);
export const workflowStepStatusEnum = pgEnum("workflow_step_status", [
  "pending", "running", "completed", "failed", "skipped",
]);
export const regulatoryChangeTypeEnum = pgEnum("regulatory_change_type", [
  "new_version", "amendment", "guidance", "enforcement",
]);
export const deadlineStatusEnum = pgEnum("deadline_status", ["upcoming", "due", "overdue", "completed"]);
export const copilotIntentEnum = pgEnum("copilot_intent", [
  "gap_analysis", "findings_query", "remediation_query", "analytics_query",
  "risk_assessment", "benchmarking", "drift_query", "readiness_assessment", "general",
]);
export const nistImpactLevelEnum = pgEnum("nist_impact_level", ["low", "moderate", "high"]);
export const scanProfileEnum = pgEnum("scan_profile", ["quick", "standard", "deep"]);

export const controlCrossMappings = pgTable("control_cross_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceFramework: frameworkEnum("source_framework").notNull(),
  sourceControlId: varchar("source_control_id", { length: 50 }).notNull(),
  targetFramework: frameworkEnum("target_framework").notNull(),
  targetControlId: varchar("target_control_id", { length: 50 }).notNull(),
  mappingStrength: mappingStrengthEnum("mapping_strength").notNull(),
  mappingRationale: text("mapping_rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceIdx: index("ccm_source_idx").on(table.sourceFramework, table.sourceControlId),
  targetIdx: index("ccm_target_idx").on(table.targetFramework, table.targetControlId),
}));

export const copilotConversations = pgTable("copilot_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  intentClassification: copilotIntentEnum("intent_classification").notNull(),
  response: jsonb("response").notNull(),
  sources: jsonb("sources"),
  confidence: real("confidence"),
  feedbackRating: integer("feedback_rating"),
  sessionId: uuid("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("copilot_conv_tenant_idx").on(table.tenantId),
  sessionIdx: index("copilot_conv_session_idx").on(table.sessionId),
}));

export const remediationPlaybooks = pgTable("remediation_playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: findingCategoryEnum("category").notNull(),
  severity: severityEnum("severity").notNull(),
  cloudProvider: varchar("cloud_provider", { length: 20 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  steps: jsonb("steps").notNull(),
  cliCommands: jsonb("cli_commands"),
  iacFix: text("iac_fix"),
  effortHours: real("effort_hours"),
  riskLevel: varchar("risk_level", { length: 20 }),
  rollbackPlan: text("rollback_plan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("playbooks_category_idx").on(table.category),
}));

export const findingCorrelations = pgTable("finding_correlations", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  chainName: varchar("chain_name", { length: 300 }).notNull(),
  chainDescription: text("chain_description"),
  combinedSeverity: severityEnum("combined_severity").notNull(),
  findingIds: uuid("finding_ids").array().notNull(),
  mitreTechniques: text("mitre_techniques").array(),
  exploitNarrative: text("exploit_narrative"),
  businessImpact: text("business_impact"),
  correlationType: varchar("correlation_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("finding_corr_tenant_idx").on(table.tenantId),
  scanIdx: index("finding_corr_scan_idx").on(table.scanId),
}));

export const agentLearning = pgTable("agent_learning", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentType: varchar("agent_type", { length: 100 }).notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  findingPattern: jsonb("finding_pattern"),
  totalOccurrences: integer("total_occurrences").notNull().default(0),
  falsePositives: integer("false_positives").notNull().default(0),
  suppressionRecommended: boolean("suppression_recommended").notNull().default(false),
  confidence: integer("confidence").notNull().default(50),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  agentIdx: index("agent_learning_agent_idx").on(table.agentType),
  tenantIdx: index("agent_learning_tenant_idx").on(table.tenantId),
}));

export const scanTemplates = pgTable("scan_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  profile: scanProfileEnum("profile").notNull(),
  configuration: jsonb("configuration").notNull(),
  isScheduled: boolean("is_scheduled").notNull().default(false),
  cronExpression: varchar("cron_expression", { length: 100 }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("scan_templates_tenant_idx").on(table.tenantId),
}));

export const nistBaselines = pgTable("nist_baselines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  impactLevel: nistImpactLevelEnum("impact_level").notNull(),
  customAdditions: jsonb("custom_additions"),
  customRemovals: jsonb("custom_removals"),
  tailoringRationale: text("tailoring_rationale"),
  selectedBy: uuid("selected_by").references(() => users.id),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("nist_baselines_tenant_idx").on(table.tenantId),
}));

export const remediationWorkflowSteps = pgTable("remediation_workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  remediationId: uuid("remediation_id").notNull().references(() => remediations.id),
  stepNumber: integer("step_number").notNull(),
  stepName: varchar("step_name", { length: 50 }).notNull(),
  status: workflowStepStatusEnum("status").notNull().default("pending"),
  input: jsonb("input"),
  output: jsonb("output"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorDetails: text("error_details"),
}, (table) => ({
  remediationIdx: index("workflow_steps_remediation_idx").on(table.remediationId),
}));

export const changeWindows = pgTable("change_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 300 }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  approvedChangeTypes: jsonb("approved_change_types"),
  approvedResources: jsonb("approved_resources"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("change_windows_tenant_idx").on(table.tenantId),
}));

// REAL IMPL (BLACKFYRE 2026-06): the durable evidence ledger table is defined once,
// above (see the `evidenceChain` declaration next to the auditor_frameworks block).
// A stale legacy duplicate (chain_sequence/sha256_hash/previous_entry_hash columns,
// indexes evidence_chain_tenant_idx/evidence_chain_seq_idx) that predated the
// append-only Postgres ledger lived here and caused a `Cannot redeclare block-scoped
// variable 'evidenceChain'` build break; it did not match migration
// 022_evidence_chain.sql and had no consumers, so it was removed.
export const threatIntel = pgTable("threat_intel", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 50 }).notNull(),
  cveId: varchar("cve_id", { length: 50 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  severity: severityEnum("severity").notNull(),
  affectedProducts: text("affected_products").array(),
  mitreTechniques: text("mitre_techniques").array(),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  severityIdx: index("threat_intel_sev_idx").on(table.severity),
}));

export const threatMatches = pgTable("threat_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  threatId: uuid("threat_id").notNull().references(() => threatIntel.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  resourceType: varchar("resource_type", { length: 200 }),
  resourceId: varchar("resource_id", { length: 500 }),
  matchReason: text("match_reason"),
  matchConfidence: real("match_confidence"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("threat_matches_tenant_idx").on(table.tenantId),
}));

export const complianceDeadlines = pgTable("compliance_deadlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  framework: varchar("framework", { length: 20 }),
  deadlineDate: timestamp("deadline_date", { withTimezone: true }).notNull(),
  reminderDays: jsonb("reminder_days"),
  status: deadlineStatusEnum("status").notNull().default("upcoming"),
  readinessScore: integer("readiness_score").default(0),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("deadlines_tenant_idx").on(table.tenantId),
}));

export const regulatoryChanges = pgTable("regulatory_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  framework: varchar("framework", { length: 20 }),
  changeType: regulatoryChangeTypeEnum("change_type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  impactLevel: severityEnum("impact_level").notNull(),
  effectiveDate: timestamp("effective_date", { withTimezone: true }),
  sourceUrl: text("source_url"),
  aiAnalysis: jsonb("ai_analysis"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
});

export const complianceAutopilot = pgTable("compliance_autopilot", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  framework: frameworkEnum("framework").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  configuration: jsonb("configuration").notNull(),
  lastScanAt: timestamp("last_scan_at", { withTimezone: true }),
  nextScanAt: timestamp("next_scan_at", { withTimezone: true }),
  autoFixesCount: integer("auto_fixes_count").notNull().default(0),
  pendingApprovalsCount: integer("pending_approvals_count").notNull().default(0),
  monthlyAiCost: real("monthly_ai_cost").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("autopilot_tenant_idx").on(table.tenantId),
}));

export const autopilotActionsTable = pgTable("autopilot_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  autopilotId: uuid("autopilot_id").notNull().references(() => complianceAutopilot.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  actionType: autopilotActionTypeEnum("action_type").notNull(),
  agentName: agentNameEnum("agent_name").notNull(),
  details: jsonb("details"),
  status: autopilotActionStatusEnum("status").notNull().default("pending"),
  costTokens: integer("cost_tokens").notNull().default(0),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("autopilot_actions_tenant_idx").on(table.tenantId),
  statusIdx: index("autopilot_actions_stat_idx").on(table.status),
}));

export const incidentsTable = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  severity: incidentSeverityEnum("severity").notNull(),
  sourceType: incidentSourceTypeEnum("source_type").notNull(),
  sourceId: uuid("source_id"),
  sourceAgent: agentNameEnum("source_agent"),
  status: incidentStatusEnum("status").notNull().default("detected"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  slaTargetMinutes: integer("sla_target_minutes").notNull(),
  responseTimeMinutes: integer("response_time_minutes"),
  rootCause: text("root_cause"),
  lessonsLearned: text("lessons_learned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => ({
  tenantIdx: index("incidents_tenant_idx").on(table.tenantId),
  statusIdx: index("incidents_stat_idx").on(table.status),
}));

export const incidentTimeline = pgTable("incident_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidentsTable.id),
  action: varchar("action", { length: 200 }).notNull(),
  details: text("details"),
  performedBy: varchar("performed_by", { length: 200 }).notNull(),
  agentName: agentNameEnum("agent_name"),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  incidentIdx: index("incident_tl_incident_idx").on(table.incidentId),
}));

export const findingComments = pgTable("finding_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").notNull().references(() => findings.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  findingIdx: index("finding_comments_finding_idx").on(table.findingId),
}));

export const findingAssignments = pgTable("finding_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").notNull().references(() => findings.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  assignedBy: uuid("assigned_by").notNull().references(() => users.id),
  dueDate: timestamp("due_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  findingIdx: index("finding_assign_finding_idx").on(table.findingId),
}));

// =====================================================================
// Pre-prod foundation tables (2026-05-11, marathon/preprod-foundation)
// =====================================================================

// One client may link multiple cloud accounts (e.g. prod + staging in AWS).
// AWS auth: roleArn + externalId for cross-account sts:AssumeRole.
// Azure auth: clientId + tenantId in credentialMeta jsonb.
// GCP auth: workload-identity pool/provider in credentialMeta jsonb.
export const cloudAccounts = pgTable("cloud_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  provider: cloudProviderEnum("provider").notNull(),
  accountId: varchar("account_id", { length: 100 }).notNull(),
  accountAlias: varchar("account_alias", { length: 200 }),
  externalId: varchar("external_id", { length: 64 }).notNull(),
  roleArn: text("role_arn"),
  credentialMeta: jsonb("credential_meta"),
  regions: text("regions").array().notNull().default(sql`ARRAY[]::text[]`),
  status: cloudAccountStatusEnum("status").notNull().default("pending"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  verifiedCallerArn: text("verified_caller_arn"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("cloud_accounts_tenant_idx").on(table.tenantId),
  providerAccountIdx: index("cloud_accounts_provider_account_idx").on(table.provider, table.accountId),
  statusIdx: index("cloud_accounts_status_idx").on(table.status),
}));

// SPOC + functional contacts per tenant. Multiple contacts per role allowed
// (primary + backup) — losing one person can't break the relationship.
export const tenantContacts = pgTable("tenant_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  role: contactRoleEnum("role").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  timezone: varchar("timezone", { length: 64 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantRoleIdx: index("tenant_contacts_tenant_role_idx").on(table.tenantId, table.role),
  emailIdx: index("tenant_contacts_email_idx").on(table.email),
}));

// Vault-backed credential pointers. NEVER store plaintext secrets here —
// vaultRef holds an ARN or path; the worker resolves at scan time.
export const integrationCredentials = pgTable("integration_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").notNull().references(() => integrations.id, { onDelete: "cascade" }),
  vaultProvider: vaultProviderEnum("vault_provider").notNull(),
  vaultRef: text("vault_ref").notNull(),
  kmsKeyId: text("kms_key_id"),
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): encrypted credential storage. The existing
  // vault_ref / kms_key_id columns are pointers, but some integrations still persist secret
  // material directly. These additive, nullable columns let the credential path write
  // envelope-encrypted ciphertext (AES-256-GCM via EncryptionProviderService) instead of any
  // plaintext: credential_ciphertext (base64), credential_key_id (which KMS/managed key wrapped
  // it), credential_alg (cipher used), credential_nonce (the GCM IV/nonce), credential_auth_tag
  // (GCM auth tag — required to detect tampering on decrypt). Nullable & back-compatible: existing
  // rows that only use vault_ref are untouched; downstream agents stop writing plaintext and start
  // populating these. Never log these values — they hold wrapped secret material.
  credentialCiphertext: text("credential_ciphertext"),
  credentialKeyId: text("credential_key_id"),
  credentialAlg: text("credential_alg"),
  credentialNonce: text("credential_nonce"),
  credentialAuthTag: text("credential_auth_tag"),
  scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
  rotationDueAt: timestamp("rotation_due_at", { withTimezone: true }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("integration_credentials_tenant_idx").on(table.tenantId),
  integrationIdx: index("integration_credentials_integration_idx").on(table.integrationId),
  rotationDueIdx: index("integration_credentials_rotation_due_idx").on(table.rotationDueAt),
}));

// Note: per-tenant audit trail is the existing `auditLogs` table (above),
// which was extended in this migration to support system/integration actors

// =====================================================================
// Contact form submissions — marketing website lead capture (2026-05-18)
// =====================================================================
// Pre-tenant data: leads submitted by people who don't have an account yet.
// No tenant_id; no RLS. Operationally similar to threat_intel and
// regulatory_changes (cross-tenant reference / inbox data).

export const contactSubmissionStatusEnum = pgEnum("contact_submission_status", [
  "new", "contacted", "qualified", "archived", "spam",
]);

export const contactSubmissions = pgTable("contact_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 200 }),
  preferredDate: varchar("preferred_date", { length: 32 }),
  preferredTime: varchar("preferred_time", { length: 32 }),
  topic: varchar("topic", { length: 100 }),
  message: text("message"),
  source: varchar("source", { length: 64 }).notNull().default("website-booking"),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  status: contactSubmissionStatusEnum("status").notNull().default("new"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index("contact_submissions_email_idx").on(table.email),
  statusIdx: index("contact_submissions_status_idx").on(table.status),
  createdIdx: index("contact_submissions_created_idx").on(table.createdAt),
}));

// Email recipients who get notified when a new lead arrives. Managed via the
// admin Settings > Notifications tab so a future marketing team can be added
// without a code change.
export const leadNotificationRecipients = pgTable("lead_notification_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 200 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeIdx: index("lead_notification_recipients_active_idx").on(table.isActive),
}));
// (actorType, actorId, actorEmail, outcome). See migration 015.
