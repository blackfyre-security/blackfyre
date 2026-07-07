/**
 * BLACKFYRE Platform -- Enterprise Readiness Gap Analysis
 *
 * Audit date: 2026-03-26
 * Auditor: Product Manager Gap Audit
 *
 * Compares the automated-security-audit-agent design against the current
 * implementation (platform/packages/*) and documents every gap.
 *
 * Priority scale:
 *   P0 = Blocker   -- Blocks production deployment or certification
 *   P1 = Critical  -- Major feature missing; enterprise clients would reject
 *   P2 = Important -- Notable gap that affects competitive positioning
 *   P3 = Nice-to-have -- Polish, optimization, or convenience feature
 *
 * Status:
 *   missing  = No code exists for this feature
 *   partial  = Some code exists but is incomplete or stubbed
 *   stub     = Code is structurally present but has no real logic
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GapPriority = "P0" | "P1" | "P2" | "P3";
export type GapStatus = "missing" | "partial" | "stub";

export interface EnterpriseGap {
  /** Unique identifier for tracking */
  id: string;
  /** Spec section number this maps to */
  specSection: number;
  /** Human-readable gap title */
  title: string;
  /** Detailed description of what is missing vs. what the spec requires */
  description: string;
  /** Priority */
  priority: GapPriority;
  /** Implementation status */
  status: GapStatus;
  /** Which package(s) are affected */
  packages: string[];
  /** Suggested fix or implementation path */
  suggestedFix: string;
  /** Whether this gap was fixed in this audit pass */
  fixedInThisPass: boolean;
}

// ---------------------------------------------------------------------------
// Gap Registry
// ---------------------------------------------------------------------------

export const ENTERPRISE_GAPS: EnterpriseGap[] = [

  // ==========================================================================
  // SECTION 2: System Architecture -- Agents
  // ==========================================================================
  {
    id: "GAP-001",
    specSection: 2,
    title: "7 of 13 scan agents not implemented",
    description:
      "Spec defines 13 agents. Only 6 scanning agents are registered (cloud-auditor-aws, " +
      "cloud-auditor-azure, cloud-auditor-gcp, identity-auditor, endpoint-auditor, network-scanner). " +
      "Missing: evidence-collector, compliance-mapper, report-generator, drift-monitor, " +
      "remediation-agent, threat-intel-agent, tenant-guardian. Registry comment says these " +
      "are deferred to Plans 3-6, but they are spec-required at launch.",
    priority: "P1",
    status: "partial",
    packages: ["api"],
    suggestedFix:
      "Create stub agents for all 7 missing types so the registry has 13 entries, " +
      "even if scan logic is placeholder. This unblocks swarm completeness checks.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 3: Compliance Framework Engine
  // ==========================================================================
  {
    id: "GAP-002",
    specSection: 3,
    title: "Cross-framework deduplication logic is within-tenant only",
    description:
      "Spec requires 'Fix once -> resolved in all frameworks'. The FindingService uses " +
      "dedup_hash to avoid duplicate findings across scans, but there is no explicit " +
      "cross-framework resolution logic -- when a finding is resolved, its status is " +
      "updated on the finding row and control mappings across all frameworks are implicitly " +
      "affected. This is acceptable structurally but is never surfaced in the portal or CLI " +
      "as a cross-framework dedup display.",
    priority: "P2",
    status: "partial",
    packages: ["api", "portal", "cli"],
    suggestedFix:
      "Add a 'Cross-framework impact' section to the finding detail endpoint and portal page.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-003",
    specSection: 3,
    title: "Finding priority formula not implemented",
    description:
      "Spec requires: priority = severity x exploitability x compliance impact. " +
      "No exploitability field exists in the data model. Finding priority is derived " +
      "solely from the severity enum. The formula is entirely absent.",
    priority: "P2",
    status: "missing",
    packages: ["shared", "api"],
    suggestedFix:
      "Add exploitability and compliance_impact columns to findings table, implement " +
      "calculateFindingPriority() function in scoring.ts.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-004",
    specSection: 3,
    title: "Regulatory Update Tracker not implemented",
    description:
      "Spec requires tracking framework version updates, monitoring enforcement actions, " +
      "and auto-flagging clients when compliance score would drop under new requirements. " +
      "The compliance diff endpoint exists but returns empty changes array (stub).",
    priority: "P2",
    status: "stub",
    packages: ["api"],
    suggestedFix:
      "Populate the control-registry with version diffs for at least PCI-DSS v3.2->v4.0.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-005",
    specSection: 3,
    title: "Certification readiness checklist missing",
    description:
      "Spec lists 'Certification readiness -- Go/no-go checklist' as a Compliance Engine output. " +
      "No endpoint or service method generates a readiness checklist. The readiness report " +
      "in ReportGeneratorService generates a report but not a structured go/no-go checklist.",
    priority: "P2",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add getCertificationReadiness() method to ComplianceService.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 4: Portal
  // ==========================================================================
  {
    id: "GAP-006",
    specSection: 4,
    title: "Portal pages present but all use hardcoded/mock data",
    description:
      "All 9 portal pages exist (dashboard, findings, compliance, remediation, reports, " +
      "monitoring, clients, scans/config, insights) plus settings and login. However, " +
      "the dashboard uses hardcoded stats/activity data instead of fetching from the API. " +
      "This means the portal is a visual shell only.",
    priority: "P1",
    status: "partial",
    packages: ["portal"],
    suggestedFix:
      "Wire each page to the API client with real data fetching using SWR or React Query.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 5: CLI
  // ==========================================================================
  {
    id: "GAP-007",
    specSection: 5,
    title: "--csv flag missing from all CLI commands",
    description:
      "Spec requires every command supports --json and --csv flags. " +
      "All commands support --json but none support --csv.",
    priority: "P2",
    status: "missing",
    packages: ["cli"],
    suggestedFix: "Add a csv() formatter to formatters.ts and wire --csv option to all commands.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-008",
    specSection: 5,
    title: "Interactive shell mode not implemented",
    description:
      "Spec requires 'ruflo-audit shell --client acme' interactive mode with explain command. " +
      "No shell command exists in the CLI.",
    priority: "P3",
    status: "missing",
    packages: ["cli"],
    suggestedFix: "Add a shell.ts command using readline or inquirer for interactive mode.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-009",
    specSection: 5,
    title: "CLI 'fix' and 'monitor' commands missing",
    description:
      "Spec defines 'ruflo-audit fix --auto', 'ruflo-audit fix --id FIND-042', " +
      "'ruflo-audit monitor start', 'ruflo-audit monitor alerts'. " +
      "No fix or monitor commands are registered in the CLI.",
    priority: "P2",
    status: "missing",
    packages: ["cli"],
    suggestedFix: "Register fix and monitor command modules hitting remediation and drift APIs.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 6: Notifications
  // ==========================================================================
  {
    id: "GAP-010",
    specSection: 6,
    title: "Notification channels are all stubs",
    description:
      "Email, Slack, SMS, webhook dispatch methods exist in NotificationDispatcher " +
      "but only log to console. No SendGrid, Twilio, or actual HTTP webhook calls.",
    priority: "P1",
    status: "stub",
    packages: ["api"],
    suggestedFix:
      "This is acceptable for MVP, but at minimum the webhook channel should make " +
      "a real HTTP POST (it is the simplest to implement and most useful for integrations).",
    fixedInThisPass: false,
  },
  {
    id: "GAP-011",
    specSection: 6,
    title: "Alert rule engine evaluation never fires automatically",
    description:
      "AlertService stores rules and can test-dispatch, but there is no background " +
      "process that evaluates rules against real events (scan completion, score drops, " +
      "drift detection). Rules are only tested manually via POST /api/alerts/:id/test.",
    priority: "P1",
    status: "partial",
    packages: ["api"],
    suggestedFix:
      "Add evaluateRules() method to AlertService, call it from scan-worker on completion " +
      "and from drift-service on new drift events.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-012",
    specSection: 6,
    title: "Alert fatigue prevention only partially implemented",
    description:
      "Quiet hours are fully implemented with timezone math. Smart grouping, escalation " +
      "chains, and weekly digest mode are not implemented.",
    priority: "P3",
    status: "partial",
    packages: ["api"],
    suggestedFix: "Add grouping logic and escalation chain config to AlertService.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 7: Security, Multi-Tenancy & Deployment
  // ==========================================================================
  {
    id: "GAP-013",
    specSection: 7,
    title: "No rate limiting configured",
    description:
      "Spec requires rate limiting at the API Gateway layer. No @fastify/rate-limit " +
      "plugin is registered. The API is completely unprotected against abuse.",
    priority: "P0",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Register @fastify/rate-limit with tiered limits per endpoint category.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-014",
    specSection: 7,
    title: "CORS not enterprise-hardened",
    description:
      "CORS allows all origins in non-production (origin: true). In production it's " +
      "hardcoded to a single origin 'https://app.blackfyre.com'. Spec mentions enterprise " +
      "clients may have custom domains, and the allowed origins should be configurable. " +
      "Also missing: credentials, allowed methods/headers restrictions.",
    priority: "P0",
    status: "partial",
    packages: ["api"],
    suggestedFix:
      "Make CORS origin configurable via env var, add credentials/methods/headers config.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-015",
    specSection: 7,
    title: "Health check is too basic",
    description:
      "Spec describes a system with PostgreSQL, Redis, and BullMQ. Health endpoint only " +
      "returns { status: 'ok' } without checking any dependency. Enterprise deployments " +
      "need a /health/ready and /health/live split with dependency checks.",
    priority: "P0",
    status: "partial",
    packages: ["api"],
    suggestedFix:
      "Add /health/ready (checks DB + Redis) and /health/live (always 200) endpoints.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-016",
    specSection: 7,
    title: "Missing auth endpoints: SSO and MFA verify",
    description:
      "Spec requires POST /api/auth/sso (SSO callback) and POST /api/auth/mfa/verify. " +
      "Neither endpoint exists. Only login, refresh, and api-key are implemented.",
    priority: "P1",
    status: "missing",
    packages: ["api"],
    suggestedFix:
      "Add stub SSO callback and MFA verification endpoints to auth routes.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-017",
    specSection: 7,
    title: "Encryption at rest not configured",
    description:
      "Spec mentions per-tenant encrypted S3 buckets with separate KMS keys. " +
      "No S3 or KMS configuration exists. Evidence storage paths are generated but " +
      "no actual file upload/download logic exists.",
    priority: "P2",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add S3 client configuration with server-side encryption.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 8: API Endpoints
  // ==========================================================================
  {
    id: "GAP-018",
    specSection: 8,
    title: "Missing spec endpoints: monitoring, notification channels, on-prem agent",
    description:
      "Spec defines these endpoint groups that have no routes:\n" +
      "- GET/POST /api/monitoring/status|alerts|start|stop (monitoring)\n" +
      "- GET/POST /api/notifications/rules|channels (notifications -- alerts exist but under /api/alerts, not /api/notifications)\n" +
      "- POST /api/agent/findings, GET /api/agent/commands, POST /api/agent/heartbeat, POST /api/agent/sync (on-prem)\n" +
      "- POST /api/reports/schedule (scheduled reports)\n" +
      "- POST /api/findings/:id/fix (trigger auto-fix)\n" +
      "- GET /api/scans/:id/findings (findings for a specific scan -- exists as query param instead)\n" +
      "- GET /api/admin/learning, GET /api/admin/agents",
    priority: "P1",
    status: "missing",
    packages: ["api"],
    suggestedFix:
      "Most of these have service-layer equivalents. Add route stubs that delegate to existing services.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-019",
    specSection: 8,
    title: "Alert routes mounted at /api/alerts instead of /api/notifications/rules",
    description:
      "Spec defines notification rules at /api/notifications/rules and channels at " +
      "/api/notifications/channels. Implementation uses /api/alerts. " +
      "Either the routes need aliasing or the spec path convention needs adoption.",
    priority: "P2",
    status: "partial",
    packages: ["api"],
    suggestedFix: "Add /api/notifications/* aliases that proxy to the existing alert routes.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-020",
    specSection: 8,
    title: "Error response format partially matches spec",
    description:
      "Spec error shape includes 'code', 'message', 'details', 'requestId', 'timestamp'. " +
      "Implementation includes all of these in the error handler. However, 429 (rate limit) " +
      "responses are not generated since rate limiting is missing.",
    priority: "P0",
    status: "partial",
    packages: ["api"],
    suggestedFix: "Addressed by adding rate limiting (GAP-013).",
    fixedInThisPass: true,
  },

  // ==========================================================================
  // SECTION 9: Data Model
  // ==========================================================================
  {
    id: "GAP-021",
    specSection: 9,
    title: "compliance_scores and learning_patterns tables missing from SQL migration",
    description:
      "Both tables are defined in schema.ts (Drizzle ORM) and used by services, but " +
      "the 001_initial_schema.sql migration does not include CREATE TABLE statements for " +
      "compliance_scores or learning_patterns. Deploying the migration alone would break " +
      "all compliance scoring and learning features.",
    priority: "P0",
    status: "partial",
    packages: ["api"],
    suggestedFix: "Add a 002_compliance_learning_tables.sql migration.",
    fixedInThisPass: true,
  },

  // ==========================================================================
  // SECTION 10: Error Handling
  // ==========================================================================
  {
    id: "GAP-022",
    specSection: 10,
    title: "Circuit breaker pattern not implemented",
    description:
      "Spec requires circuit breaker pattern for third-party API dependencies " +
      "(AWS, Okta, NVD, SendGrid, Twilio) with closed/open/half-open states. " +
      "No circuit breaker logic exists anywhere in the codebase.",
    priority: "P2",
    status: "missing",
    packages: ["api"],
    suggestedFix:
      "Implement a generic CircuitBreaker class and wrap external API calls in agents.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-023",
    specSection: 10,
    title: "Retry with exponential backoff not implemented",
    description:
      "Spec requires BullMQ retry with exponential backoff (3 attempts) for queue failures " +
      "and webhook delivery retry (5 attempts over 30 min). Neither is configured. " +
      "BullMQ worker has no retry configuration.",
    priority: "P1",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add retry options to BullMQ worker configuration and webhook dispatcher.",
    fixedInThisPass: true,
  },

  // ==========================================================================
  // SECTION 11: Performance
  // ==========================================================================
  {
    id: "GAP-024",
    specSection: 11,
    title: "No API response time benchmarks or monitoring",
    description:
      "Spec defines <200ms p95 for CRUD, <500ms for scan trigger. No response time " +
      "tracking, no performance tests, no request duration logging.",
    priority: "P3",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add a Fastify onResponse hook that logs request duration.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-025",
    specSection: 11,
    title: "Scan timeout hard limit not enforced",
    description:
      "Spec requires 4-hour hard scan timeout. BullMQ worker has no job timeout configured. " +
      "A stuck scan would run indefinitely.",
    priority: "P1",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add timeout option to BullMQ worker job processing.",
    fixedInThisPass: true,
  },

  // ==========================================================================
  // SECTION 12: Onboarding
  // ==========================================================================
  {
    id: "GAP-026",
    specSection: 12,
    title: "Onboarding wizard not in the portal",
    description:
      "Spec describes an 8-step onboarding workflow. The API has POST /api/clients/:id/onboard " +
      "which transitions from pending to configuring, but no guided wizard exists in the portal.",
    priority: "P2",
    status: "partial",
    packages: ["portal"],
    suggestedFix: "Build a multi-step onboarding wizard component in the portal.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 13: Evidence Integrity
  // ==========================================================================
  {
    id: "GAP-027",
    specSection: 13,
    title: "SHA-256 evidence hash is of the storage path, not the content",
    description:
      "EvidenceService.create() generates sha256_hash by hashing the storage path string, " +
      "not the actual evidence content. This means tamper detection is meaningless -- " +
      "the hash would pass validation even if file contents were changed.",
    priority: "P0",
    status: "partial",
    packages: ["api"],
    suggestedFix:
      "Hash the actual evidence content (file bytes) before storing. For API-collected " +
      "evidence, hash the JSON response body.",
    fixedInThisPass: true,
  },
  {
    id: "GAP-028",
    specSection: 13,
    title: "Chain of custody logging not implemented",
    description:
      "Spec requires 'every access to evidence is logged (who downloaded, when, from where)'. " +
      "No audit logging exists for evidence downloads.",
    priority: "P2",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add an evidence_access_log table and middleware that logs downloads.",
    fixedInThisPass: false,
  },
  {
    id: "GAP-029",
    specSection: 13,
    title: "Evidence package ZIP generation not implemented",
    description:
      "Spec describes a structured ZIP with manifest.json and per-control directories. " +
      "The ReportGeneratorService.generateEvidencePackage() returns a JSON structure " +
      "but does not produce an actual ZIP file.",
    priority: "P2",
    status: "stub",
    packages: ["api"],
    suggestedFix: "Use archiver or jszip to generate a real ZIP with the specified structure.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 14: On-Prem Deployment
  // ==========================================================================
  {
    id: "GAP-030",
    specSection: 14,
    title: "On-prem agent API endpoints not implemented",
    description:
      "Spec defines 4 on-prem agent endpoints: POST /api/agent/findings, " +
      "GET /api/agent/commands, POST /api/agent/heartbeat, POST /api/agent/sync. " +
      "None of these exist.",
    priority: "P2",
    status: "missing",
    packages: ["api"],
    suggestedFix: "Add agent routes with mTLS/agent-token auth for on-prem deployment.",
    fixedInThisPass: false,
  },

  // ==========================================================================
  // SECTION 15: Timezone Handling
  // ==========================================================================
  {
    id: "GAP-031",
    specSection: 15,
    title: "Per-user timezone preference not in data model",
    description:
      "Spec requires per-user timezone preference for portal display. " +
      "The users table has no timezone column. Quiet hours on alert rules " +
      "support timezone, but user preferences do not.",
    priority: "P3",
    status: "missing",
    packages: ["shared", "api"],
    suggestedFix: "Add timezone column to users table, expose in settings API.",
    fixedInThisPass: false,
  },
];

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export function getGapsByPriority(priority: GapPriority): EnterpriseGap[] {
  return ENTERPRISE_GAPS.filter((g) => g.priority === priority);
}

export function getFixedGaps(): EnterpriseGap[] {
  return ENTERPRISE_GAPS.filter((g) => g.fixedInThisPass);
}

export function getGapSummary(): {
  total: number;
  byPriority: Record<GapPriority, number>;
  fixed: number;
  remaining: number;
} {
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const g of ENTERPRISE_GAPS) {
    byPriority[g.priority]++;
  }
  const fixed = ENTERPRISE_GAPS.filter((g) => g.fixedInThisPass).length;
  return {
    total: ENTERPRISE_GAPS.length,
    byPriority,
    fixed,
    remaining: ENTERPRISE_GAPS.length - fixed,
  };
}
