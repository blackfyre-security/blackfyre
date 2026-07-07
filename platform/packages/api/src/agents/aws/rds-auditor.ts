// REAL IMPL (BLACKFYRE 2026-06): RDS auditor no longer emits canned/sample
// findings. It enumerates ACTUAL RDS DB instances via the AWS SDK v3
// (@aws-sdk/client-rds DescribeDBInstances, paginated over Marker) using
// STS-vended scoped read-only credentials, and derives every finding from the
// real instance properties (StorageEncrypted, PubliclyAccessible,
// BackupRetentionPeriod, MultiAZ, Engine/EngineVersion). resourceId/region come
// from the live instance (DBInstanceArn / region parsed from ARN). The public
// export (class AwsRdsAuditorAgent extends BaseAgent) is unchanged so the
// registry wiring keeps compiling.
import {
  RDSClient,
  DescribeDBInstancesCommand,
  type DBInstance,
} from "@aws-sdk/client-rds";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): Major engine versions that AWS has end-of-life'd
// (extended support ended / no longer patched). An instance whose major version
// is at or below these floors is flagged as running a deprecated engine. Real
// EngineVersion strings look like "8.0.32", "13.4", "11.00.7493.4.v1", etc., so
// we compare on the leading numeric component(s) of the actual reported version.
const DEPRECATED_ENGINE_FLOORS: Record<string, number> = {
  mysql: 5.7, // MySQL 5.7 and earlier are EOL
  "aurora-mysql": 2.0, // Aurora MySQL v1/v2 (MySQL 5.6/5.7 compatible) are EOL
  mariadb: 10.4, // MariaDB 10.4 and earlier are EOL
  postgres: 11, // PostgreSQL 11 and earlier are EOL
  "aurora-postgresql": 11, // Aurora PostgreSQL 11 and earlier are EOL
  oracle: 12.1, // Oracle 12.1 and earlier are EOL
  sqlserver: 13, // SQL Server 2016 (13.x) and earlier are EOL
};

function makeClient(creds: AwsTemporaryCredentials): RDSClient {
  return new RDSClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Parses the AWS region out of an RDS ARN.
 * Format: arn:aws:rds:<region>:<account>:db:<name>
 */
function regionFromArn(arn: string | undefined): string | null {
  if (!arn) return null;
  const parts = arn.split(":");
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/**
 * Normalizes a real RDS engine identifier to one of our deprecation-floor keys.
 * e.g. "sqlserver-ee" / "sqlserver-se" -> "sqlserver", "oracle-ee" -> "oracle".
 */
function normalizeEngine(engine: string): string {
  const e = engine.toLowerCase();
  if (e.startsWith("sqlserver")) return "sqlserver";
  if (e.startsWith("oracle")) return "oracle";
  return e;
}

/**
 * Extracts the comparable leading numeric version (major[.minor]) from a real
 * EngineVersion string. "8.0.32" -> 8.0, "13.4" -> 13.4, "11.00.7493" -> 11.
 */
function leadingVersion(engineVersion: string): number {
  const match = engineVersion.match(/^(\d+)(?:\.(\d+))?/);
  if (!match) return Number.NaN;
  const major = match[1];
  const minor = match[2];
  return Number(minor !== undefined ? `${major}.${minor}` : major);
}

function isDeprecatedEngineVersion(
  engine: string | undefined,
  engineVersion: string | undefined,
): boolean {
  if (!engine || !engineVersion) return false;
  const floor = DEPRECATED_ENGINE_FLOORS[normalizeEngine(engine)];
  if (floor === undefined) return false;
  const version = leadingVersion(engineVersion);
  if (Number.isNaN(version)) return false;
  return version <= floor;
}

/** A stable identifier for the instance, preferring the ARN. */
function instanceId(db: DBInstance): string {
  return db.DBInstanceArn ?? db.DBInstanceIdentifier ?? "unknown";
}

/**
 * Runs all RDS security checks against the live account and returns findings.
 *
 * Paginates DescribeDBInstances (Marker), and for each real instance evaluates:
 *  - StorageEncrypted (encryption at rest)
 *  - PubliclyAccessible (internet exposure)
 *  - BackupRetentionPeriod > 0 (automated backups)
 *  - MultiAZ (availability)
 *  - EngineVersion vs deprecated floor (patching/lifecycle)
 */
export async function auditRDS(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  let marker: string | undefined;
  do {
    const resp = await client.send(
      new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 }),
    );

    for (const db of resp.DBInstances ?? []) {
      findings.push(...evaluateInstance(db));
    }

    marker = resp.Marker;
  } while (marker);

  return findings;
}

/**
 * Evaluates a single real DB instance against all RDS checks.
 * Every finding's resourceId/region is taken from the actual instance.
 */
function evaluateInstance(db: DBInstance): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const id = instanceId(db);
  const region = regionFromArn(db.DBInstanceArn);
  const name = db.DBInstanceIdentifier ?? id;

  // Check 1: Encryption at rest disabled -> critical
  if (db.StorageEncrypted !== true) {
    findings.push({
      title: `RDS instance "${name}" does not have storage encryption at rest`,
      description: `RDS DB instance ${name} (engine ${db.Engine ?? "?"}) has StorageEncrypted disabled. Data stored on disk and in automated backups/snapshots is unprotected. Enable encryption at rest (KMS) by restoring from an encrypted snapshot.`,
      severity: "critical",
      category: "encryption",
      resourceType: "AWS::RDS::DBInstance",
      resourceId: id,
      resourceRegion: region,
      remediationTier: "approval",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("s3_no_encryption"),
      source: "aws-rds-auditor",
    });
  }

  // Check 2: Publicly accessible -> critical
  if (db.PubliclyAccessible === true) {
    findings.push({
      title: `RDS instance "${name}" is publicly accessible`,
      description: `RDS DB instance ${name} has PubliclyAccessible enabled, assigning it a public endpoint reachable from the internet. Disable public accessibility and place the database in private subnets behind a security group.`,
      severity: "critical",
      category: "network",
      resourceType: "AWS::RDS::DBInstance",
      resourceId: id,
      resourceRegion: region,
      remediationTier: "approval",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("s3_public_access"),
      source: "aws-rds-auditor",
    });
  }

  // Check 3: Automated backups disabled (retention period == 0) -> high
  if ((db.BackupRetentionPeriod ?? 0) <= 0) {
    findings.push({
      title: `RDS instance "${name}" has automated backups disabled`,
      description: `RDS DB instance ${name} has a BackupRetentionPeriod of ${db.BackupRetentionPeriod ?? 0} days, which disables automated backups. Without backups, point-in-time recovery is impossible and data loss risk is high. Set a retention period of at least 7 days.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::RDS::DBInstance",
      resourceId: id,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("s3_no_versioning"),
      source: "aws-rds-auditor",
    });
  }

  // Check 4: Multi-AZ not enabled -> medium
  if (db.MultiAZ !== true) {
    findings.push({
      title: `RDS instance "${name}" is not configured for Multi-AZ`,
      description: `RDS DB instance ${name} is not deployed in a Multi-AZ configuration. A single-AZ instance has no automatic failover and is unavailable during an AZ outage or maintenance. Enable Multi-AZ for production workloads.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::RDS::DBInstance",
      resourceId: id,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("s3_no_versioning"),
      source: "aws-rds-auditor",
    });
  }

  // Check 5: Deprecated/outdated engine version -> medium
  if (isDeprecatedEngineVersion(db.Engine, db.EngineVersion)) {
    findings.push({
      title: `RDS instance "${name}" runs a deprecated engine version`,
      description: `RDS DB instance ${name} runs ${db.Engine ?? "?"} ${db.EngineVersion ?? "?"}, which is at or below the end-of-life floor for that engine and no longer receives security patches. Upgrade to a supported major version.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::RDS::DBInstance",
      resourceId: id,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("kms_rotation_disabled"),
      source: "aws-rds-auditor",
    });
  }

  return findings;
}

/**
 * AWS RDS Auditor Agent.
 *
 * REAL IMPL (BLACKFYRE 2026-06): public class signature unchanged (registry
 * still does `new AwsRdsAuditorAgent()` then run/testConnection). Internally it
 * now resolves real STS credentials, enumerates real DB instances, and streams
 * real findings through the agent context.
 */
export class AwsRdsAuditorAgent extends BaseAgent {
  readonly type = "aws-rds-auditor";
  readonly displayName = "AWS RDS Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveCredentials(ctx.credentialRef);
      const findings = await auditRDS(creds);

      for (const finding of findings) {
        await ctx.onFinding(finding);
        findingsCount++;
      }

      ctx.onProgress(100);
      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      return this.createResult(
        startedAt,
        findingsCount,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  // REAL IMPL (BLACKFYRE 2026-06): testConnection now validates real RDS API
  // access (resolve creds -> DescribeDBInstances) instead of returning a
  // hardcoded true. An empty account is still a successful connection; only a
  // resolution/authorization/API failure returns false.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeClient(creds);
      await client.send(new DescribeDBInstancesCommand({ MaxRecords: 20 }));
      return true;
    } catch {
      return false;
    }
  }
}
