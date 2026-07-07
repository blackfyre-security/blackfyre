import type { Db } from "../../db/connection.js";
import { evidence, integrations } from "../../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { createHash } from "crypto";
import type { FastifyBaseLogger } from "fastify";

// REAL IMPL (BLACKFYRE 2026-06): collectCloudEvidence/collectConfigSnapshot used to
// fabricate artifacts (hardcoded "example-bucket"/"admin-role"/canned JSON) and
// return them WITHOUT ever persisting, so the "evidence ledger" never actually held
// any cloud evidence. They now:
//   1. Load the tenant's integration (provider + credentialRef) by integrationId.
//   2. Resolve real cloud credentials with the SAME Wave-1 resolvers the auditors use
//      (STS AssumeRole for AWS, ClientSecretCredential/DefaultAzureCredential for Azure,
//      GoogleAuth service-account for GCP).
//   3. Pull the relevant artifacts via the cloud SDK (IAM/S3/CloudTrail/KMS config for a
//      control; storage accounts / buckets / key vaults for a full snapshot).
//   4. Compute a SHA-256 over the ACTUAL collected artifact bytes (not metadata).
//   5. Persist the artifact + hash into the tenant-scoped, RLS-enforced
//      cloud_evidence_artifacts table (migration 036) via parameterized SQL.
// needsLiveEnv: live cloud credentials (AWS role ARN / Azure SP / GCP SA key) are
// required to actually pull artifacts; without them we surface the real resolution
// error rather than inventing posture.
import { resolveCredentials, type AwsTemporaryCredentials } from "../../agents/aws/credentials.js";
import { resolveAzureCredentials } from "../../agents/azure/credentials.js";
import { resolveGcpCredentials } from "../../agents/gcp/credentials.js";

import {
  IAMClient,
  GetAccountSummaryCommand,
  GetAccountPasswordPolicyCommand,
  ListUsersCommand,
} from "@aws-sdk/client-iam";
import {
  S3Client,
  ListBucketsCommand,
  GetBucketEncryptionCommand,
  GetPublicAccessBlockCommand,
  GetBucketVersioningCommand,
} from "@aws-sdk/client-s3";
import { CloudTrailClient, DescribeTrailsCommand } from "@aws-sdk/client-cloudtrail";
import { KMSClient, ListKeysCommand } from "@aws-sdk/client-kms";
import { StorageManagementClient } from "@azure/arm-storage";
import { Storage } from "@google-cloud/storage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CollectionSchedule {
  tenantId: string;
  frameworks: string[];
  schedules: Array<{
    controlId: string;
    framework: string;
    frequency: "daily" | "weekly" | "monthly";
    lastCollected?: Date;
    nextCollection: Date;
  }>;
}

export interface CollectedEvidence {
  tenantId: string;
  integrationId: string;
  controlId: string;
  framework: string;
  artifactType: string;
  content: string;
  sha256Hash: string;
  collectedAt: Date;
}

export interface ConfigSnapshot {
  tenantId: string;
  integrationId: string;
  snapshotAt: Date;
  resources: Array<{
    resourceType: string;
    resourceId: string;
    configuration: Record<string, unknown>;
  }>;
}

export interface EvidenceReport {
  tenantId: string;
  framework: string;
  dateRange: { from: Date; to: Date };
  artifacts: Array<{
    controlId: string;
    evidenceType: string;
    collectedAt: Date;
    sha256Hash: string;
    description: string;
  }>;
  traceabilityMatrix: Array<{
    controlId: string;
    controlTitle: string;
    evidenceCount: number;
    status: "sufficient" | "partial" | "missing";
  }>;
  generatedAt: Date;
}

/** Minimal structural logger so this service can emit structured pino logs without
 * forcing every caller to pass one. */
interface CollectorLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

/* ------------------------------------------------------------------ */
/*  Evidence Frequency Rules                                           */
/* ------------------------------------------------------------------ */

const CONTROL_FREQUENCY: Record<string, "daily" | "weekly" | "monthly"> = {
  // Critical controls — daily
  "CC6.1": "daily", "CC7.1": "daily", "164.312(a)": "daily",
  "A.9.1": "daily", "Req.8": "daily",
  // Standard controls — weekly
  "CC6.2": "weekly", "CC6.3": "weekly", "CC8.1": "weekly",
  "A.10.1": "weekly", "A.12.4": "weekly", "Art.32": "weekly",
  "Req.1": "weekly", "Req.3": "weekly",
  // Low-risk controls — monthly
  "CC1.1": "monthly", "A.18.1": "monthly", "Art.25": "monthly",
};

const COLLECTOR_ACTOR = "system:evidence-collector";

/* ------------------------------------------------------------------ */
/*  Evidence Collector Service                                         */
/* ------------------------------------------------------------------ */

export class EvidenceCollectorService {
  private readonly log?: CollectorLogger;

  // REAL IMPL (BLACKFYRE 2026-06): OPTIONAL, defaulted logger param keeps the public
  // `new EvidenceCollectorService(db)` signature stable while enabling structured,
  // secret-free pino logging of every collection (provider/integration ids only —
  // never credentials or artifact secrets).
  constructor(private db: Db, log?: FastifyBaseLogger | CollectorLogger) {
    this.log = log as CollectorLogger | undefined;
  }

  /**
   * Schedule evidence collection for a tenant's frameworks.
   */
  async scheduleCollection(tenantId: string, frameworks: string[]): Promise<CollectionSchedule> {
    const schedules: CollectionSchedule["schedules"] = [];
    const now = new Date();

    for (const framework of frameworks) {
      const controlIds = Object.keys(CONTROL_FREQUENCY);
      for (const controlId of controlIds) {
        const frequency = CONTROL_FREQUENCY[controlId] ?? "weekly";
        const nextMs = frequency === "daily" ? 86400000 : frequency === "weekly" ? 604800000 : 2592000000;

        schedules.push({
          controlId,
          framework,
          frequency,
          nextCollection: new Date(now.getTime() + nextMs),
        });
      }
    }

    return { tenantId, frameworks, schedules };
  }

  /**
   * Collect cloud evidence for a specific control.
   *
   * REAL IMPL (BLACKFYRE 2026-06): pulls the artifacts relevant to `controlId` from the
   * live cloud account behind `integrationId`, hashes the real bytes, and persists the
   * artifact to cloud_evidence_artifacts. Public signature is unchanged.
   */
  async collectCloudEvidence(
    tenantId: string,
    integrationId: string,
    controlId: string,
    framework: string,
  ): Promise<CollectedEvidence> {
    const integration = await this.loadIntegration(tenantId, integrationId);

    // REAL IMPL (BLACKFYRE 2026-06): pull real artifacts for the control via the cloud SDK
    // using the resolved tenant credentials. On any resolution/SDK failure we record the
    // structured error (no secrets) and surface it — never canned success.
    const artifacts = await this.fetchControlArtifacts(
      integration.type,
      integration.credentialRef,
      controlId,
    );

    const payload = {
      controlId,
      framework,
      integrationId,
      provider: integration.type,
      collectedAt: new Date().toISOString(),
      // The collected artifacts named for this control. The SHA-256 below is computed
      // over the serialization of THIS object (real bytes), so it is tamper-evident.
      artifacts,
    };

    const content = JSON.stringify(payload);
    const sha256Hash = createHash("sha256").update(content).digest("hex");
    const collectedAt = new Date();

    await this.persistArtifact({
      tenantId,
      integrationId,
      controlId,
      framework,
      artifactType: "config_snapshot",
      artifactKind: "cloud_evidence",
      provider: integration.type,
      content,
      sha256Hash,
      resourceCount: Array.isArray(artifacts) ? artifacts.length : 0,
      collectedAt,
    });

    this.log?.info(
      {
        event: "evidence.cloud.collected",
        tenantId,
        integrationId,
        provider: integration.type,
        controlId,
        framework,
        artifactCount: Array.isArray(artifacts) ? artifacts.length : 0,
        sha256Hash,
      },
      "collected real cloud evidence for control",
    );

    return {
      tenantId,
      integrationId,
      controlId,
      framework,
      artifactType: "config_snapshot",
      content,
      sha256Hash,
      collectedAt,
    };
  }

  /**
   * Collect a point-in-time snapshot of ALL cloud configuration.
   *
   * REAL IMPL (BLACKFYRE 2026-06): enumerates real resources (S3/IAM/CloudTrail/KMS for
   * AWS, storage accounts for Azure, GCS buckets for GCP) via the cloud SDK, hashes the
   * real enumeration, and persists it. Public signature is unchanged.
   */
  async collectConfigSnapshot(tenantId: string, integrationId: string): Promise<ConfigSnapshot> {
    const integration = await this.loadIntegration(tenantId, integrationId);

    const resources = await this.fetchAllResources(integration.type, integration.credentialRef);
    const snapshotAt = new Date();

    // Hash the REAL enumerated resources so the snapshot is content-tamper-evident.
    const content = JSON.stringify({
      tenantId,
      integrationId,
      provider: integration.type,
      snapshotAt: snapshotAt.toISOString(),
      resources,
    });
    const sha256Hash = createHash("sha256").update(content).digest("hex");

    await this.persistArtifact({
      tenantId,
      integrationId,
      controlId: null,
      framework: null,
      artifactType: "config_snapshot",
      artifactKind: "config_snapshot",
      provider: integration.type,
      content,
      sha256Hash,
      resourceCount: resources.length,
      collectedAt: snapshotAt,
    });

    this.log?.info(
      {
        event: "evidence.snapshot.collected",
        tenantId,
        integrationId,
        provider: integration.type,
        resourceCount: resources.length,
        sha256Hash,
      },
      "collected real cloud configuration snapshot",
    );

    return {
      tenantId,
      integrationId,
      snapshotAt,
      resources,
    };
  }

  /**
   * Generate an auditor-ready evidence report for a framework.
   */
  async generateEvidenceReport(
    tenantId: string,
    framework: string,
    dateRange: { from: Date; to: Date },
  ): Promise<EvidenceReport> {
    const evidenceRecords = await this.db
      .select()
      .from(evidence)
      .where(and(eq(evidence.tenantId, tenantId)))
      .orderBy(desc(evidence.collectedAt))
      .limit(100);

    const artifacts = evidenceRecords.map((e) => ({
      controlId: e.framework ?? "unknown",
      evidenceType: e.type,
      collectedAt: e.collectedAt,
      sha256Hash: e.sha256Hash,
      description: `Evidence artifact collected by ${e.collectedBy}`,
    }));

    // Build traceability matrix
    const controlIds = Object.keys(CONTROL_FREQUENCY);
    const traceabilityMatrix = controlIds.map((controlId) => {
      const matchingEvidence = artifacts.filter((a) => a.controlId === controlId);
      return {
        controlId,
        controlTitle: controlId,
        evidenceCount: matchingEvidence.length,
        status: (matchingEvidence.length >= 2 ? "sufficient" : matchingEvidence.length === 1 ? "partial" : "missing") as "sufficient" | "partial" | "missing",
      };
    });

    return {
      tenantId,
      framework,
      dateRange,
      artifacts,
      traceabilityMatrix,
      generatedAt: new Date(),
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Integration + persistence helpers                                */
  /* ---------------------------------------------------------------- */

  /**
   * Load the integration (provider type + credentialRef) for this tenant.
   * The credentialRef is an opaque pointer (role ARN / JSON config) resolved by the
   * provider-specific resolver below; it is NEVER logged.
   */
  private async loadIntegration(
    tenantId: string,
    integrationId: string,
  ): Promise<{ type: string; credentialRef: string }> {
    const [row] = await this.db
      .select({ type: integrations.type, credentialRef: integrations.credentialRef })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.tenantId, tenantId)))
      .limit(1);

    if (!row) {
      throw new Error(`Integration ${integrationId} not found for tenant ${tenantId}`);
    }
    return { type: row.type as string, credentialRef: row.credentialRef };
  }

  /**
   * Persist a collected artifact into cloud_evidence_artifacts under RLS.
   * Binds app.current_tenant for this unit of work (the collector may run on the
   * owner pool, where FORCE RLS still applies) and writes via parameterized SQL.
   */
  private async persistArtifact(a: {
    tenantId: string;
    integrationId: string;
    controlId: string | null;
    framework: string | null;
    artifactType: string;
    artifactKind: string;
    provider: string;
    content: string;
    sha256Hash: string;
    resourceCount: number;
    collectedAt: Date;
  }): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_tenant', ${a.tenantId}, true)`);
        await tx.execute(sql`
          INSERT INTO cloud_evidence_artifacts
            (tenant_id, integration_id, control_id, framework, artifact_type,
             artifact_kind, provider, content, sha256_hash, resource_count,
             collected_by, collected_at)
          VALUES
            (${a.tenantId}::uuid, ${a.integrationId}::uuid, ${a.controlId}, ${a.framework},
             ${a.artifactType}, ${a.artifactKind}, ${a.provider}, ${a.content},
             ${a.sha256Hash}, ${a.resourceCount}, ${COLLECTOR_ACTOR},
             ${a.collectedAt.toISOString()}::timestamptz)
        `);
      });
    } catch (err) {
      // Persistence must not silently swallow — record the failure with no secrets.
      this.log?.error(
        {
          event: "evidence.persist.failed",
          tenantId: a.tenantId,
          integrationId: a.integrationId,
          provider: a.provider,
          reason: err instanceof Error ? err.message : "unknown",
        },
        "failed to persist collected cloud evidence artifact",
      );
      throw err;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Real cloud SDK collection (per provider)                         */
  /* ---------------------------------------------------------------- */

  /**
   * REAL IMPL (BLACKFYRE 2026-06): fetch the artifacts relevant to a specific control
   * from the live cloud account. Returns an array of { artifactType, resourceId,
   * configuration } captured from real SDK responses.
   */
  private async fetchControlArtifacts(
    provider: string,
    credentialRef: string,
    controlId: string,
  ): Promise<Array<{ artifactType: string; resourceId: string; configuration: Record<string, unknown> }>> {
    // Map a control to the cloud artifact domains it needs as evidence.
    const domains = this.artifactDomainsForControl(controlId);

    switch (provider) {
      case "aws": {
        const creds = await resolveCredentials(credentialRef, this.log);
        return this.fetchAwsControlArtifacts(creds, domains);
      }
      case "azure": {
        const resources = await this.fetchAzureResources(credentialRef);
        return resources.map((r) => ({
          artifactType: r.resourceType,
          resourceId: r.resourceId,
          configuration: r.configuration,
        }));
      }
      case "gcp": {
        const resources = await this.fetchGcpResources(credentialRef);
        return resources.map((r) => ({
          artifactType: r.resourceType,
          resourceId: r.resourceId,
          configuration: r.configuration,
        }));
      }
      default:
        throw new Error(`Evidence collection not supported for integration type "${provider}"`);
    }
  }

  /** Maps a control id to the AWS artifact domains it should be backed by. */
  private artifactDomainsForControl(controlId: string): Set<string> {
    const map: Record<string, string[]> = {
      "CC6.1": ["iam"],
      "CC6.2": ["iam"],
      "CC6.3": ["iam"],
      "CC7.1": ["cloudtrail"],
      "CC8.1": ["cloudtrail"],
      "A.9.1": ["iam"],
      "A.10.1": ["kms", "s3"],
      "A.12.4": ["cloudtrail"],
      "164.312(a)": ["iam", "kms"],
      "Req.8": ["iam"],
      "Req.3": ["kms", "s3"],
      "Req.1": ["s3"],
      "Art.32": ["kms", "s3"],
    };
    return new Set(map[controlId] ?? ["iam", "s3", "cloudtrail", "kms"]);
  }

  /** REAL IMPL (BLACKFYRE 2026-06): fetch AWS control artifacts via the SDK. */
  private async fetchAwsControlArtifacts(
    creds: AwsTemporaryCredentials,
    domains: Set<string>,
  ): Promise<Array<{ artifactType: string; resourceId: string; configuration: Record<string, unknown> }>> {
    const clientConfig = {
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    };
    const out: Array<{ artifactType: string; resourceId: string; configuration: Record<string, unknown> }> = [];

    if (domains.has("iam")) {
      const iam = new IAMClient(clientConfig);
      const summary = await iam.send(new GetAccountSummaryCommand({}));
      out.push({
        artifactType: "iam_account_summary",
        resourceId: "iam:account-summary",
        configuration: { summaryMap: summary.SummaryMap ?? {} },
      });
      try {
        const policy = await iam.send(new GetAccountPasswordPolicyCommand({}));
        out.push({
          artifactType: "iam_password_policy",
          resourceId: "iam:password-policy",
          configuration: { passwordPolicy: (policy.PasswordPolicy ?? {}) as Record<string, unknown> },
        });
      } catch (err) {
        // NoSuchEntity means there is genuinely no password policy — that IS the evidence.
        if (err instanceof Error && err.name === "NoSuchEntityException") {
          out.push({
            artifactType: "iam_password_policy",
            resourceId: "iam:password-policy",
            configuration: { passwordPolicy: null, note: "no account password policy configured" },
          });
        } else {
          throw err;
        }
      }
      const users = await iam.send(new ListUsersCommand({ MaxItems: 200 }));
      out.push({
        artifactType: "iam_users",
        resourceId: "iam:users",
        configuration: {
          userCount: (users.Users ?? []).length,
          users: (users.Users ?? []).map((u) => ({ userName: u.UserName, arn: u.Arn, createDate: u.CreateDate })),
        },
      });
    }

    if (domains.has("s3")) {
      const s3 = new S3Client(clientConfig);
      const buckets = await s3.send(new ListBucketsCommand({}));
      for (const bucket of buckets.Buckets ?? []) {
        const name = bucket.Name;
        if (!name) continue;
        const config: Record<string, unknown> = {};
        config.encryption = await this.safeS3(s3, name, "encryption");
        config.publicAccessBlock = await this.safeS3(s3, name, "publicAccessBlock");
        config.versioning = await this.safeS3(s3, name, "versioning");
        out.push({ artifactType: "s3_bucket_config", resourceId: name, configuration: config });
      }
    }

    if (domains.has("cloudtrail")) {
      const ct = new CloudTrailClient(clientConfig);
      const trails = await ct.send(new DescribeTrailsCommand({}));
      out.push({
        artifactType: "cloudtrail_trails",
        resourceId: "cloudtrail:trails",
        configuration: {
          trailCount: (trails.trailList ?? []).length,
          trails: (trails.trailList ?? []).map((t) => ({
            name: t.Name,
            isMultiRegionTrail: t.IsMultiRegionTrail,
            logFileValidationEnabled: t.LogFileValidationEnabled,
            kmsKeyId: t.KmsKeyId ?? null,
            isOrganizationTrail: t.IsOrganizationTrail,
          })),
        },
      });
    }

    if (domains.has("kms")) {
      const kms = new KMSClient(clientConfig);
      const keys = await kms.send(new ListKeysCommand({ Limit: 1000 }));
      out.push({
        artifactType: "kms_keys",
        resourceId: "kms:keys",
        configuration: {
          keyCount: (keys.Keys ?? []).length,
          keyIds: (keys.Keys ?? []).map((k) => k.KeyId),
        },
      });
    }

    return out;
  }

  /** Best-effort per-bucket S3 config read; "absent" SDK errors are recorded as the evidence. */
  private async safeS3(
    s3: S3Client,
    bucket: string,
    kind: "encryption" | "publicAccessBlock" | "versioning",
  ): Promise<Record<string, unknown>> {
    try {
      if (kind === "encryption") {
        const r = await s3.send(new GetBucketEncryptionCommand({ Bucket: bucket }));
        return { rules: r.ServerSideEncryptionConfiguration?.Rules ?? [] };
      }
      if (kind === "publicAccessBlock") {
        const r = await s3.send(new GetPublicAccessBlockCommand({ Bucket: bucket }));
        return { config: r.PublicAccessBlockConfiguration ?? null };
      }
      const r = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }));
      return { status: r.Status ?? "unset" };
    } catch (err) {
      return { absent: true, reason: err instanceof Error ? err.name : "unknown" };
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): enumerate ALL resources for a full config snapshot.
   */
  private async fetchAllResources(
    provider: string,
    credentialRef: string,
  ): Promise<ConfigSnapshot["resources"]> {
    switch (provider) {
      case "aws": {
        const creds = await resolveCredentials(credentialRef, this.log);
        const artifacts = await this.fetchAwsControlArtifacts(
          creds,
          new Set(["iam", "s3", "cloudtrail", "kms"]),
        );
        return artifacts.map((a) => ({
          resourceType: a.artifactType,
          resourceId: a.resourceId,
          configuration: a.configuration,
        }));
      }
      case "azure":
        return this.fetchAzureResources(credentialRef);
      case "gcp":
        return this.fetchGcpResources(credentialRef);
      default:
        throw new Error(`Config snapshot not supported for integration type "${provider}"`);
    }
  }

  /** REAL IMPL (BLACKFYRE 2026-06): Azure storage-account configuration via ARM SDK. */
  private async fetchAzureResources(credentialRef: string): Promise<ConfigSnapshot["resources"]> {
    const creds = await resolveAzureCredentials(credentialRef);
    const storage = new StorageManagementClient(creds.credential, creds.subscriptionId);
    const resources: ConfigSnapshot["resources"] = [];

    for await (const account of storage.storageAccounts.list()) {
      resources.push({
        resourceType: "azure_storage_account",
        resourceId: account.id ?? account.name ?? "unknown",
        configuration: {
          name: account.name,
          location: account.location,
          enableHttpsTrafficOnly: account.enableHttpsTrafficOnly,
          allowBlobPublicAccess: account.allowBlobPublicAccess,
          minimumTlsVersion: account.minimumTlsVersion,
          encryption: account.encryption ? { keySource: account.encryption.keySource } : null,
        },
      });
    }

    return resources;
  }

  /** REAL IMPL (BLACKFYRE 2026-06): GCP Cloud Storage bucket configuration via SDK. */
  private async fetchGcpResources(credentialRef: string): Promise<ConfigSnapshot["resources"]> {
    const creds = await resolveGcpCredentials(credentialRef);
    const authClient = await creds.auth.getClient();
    const storage = new Storage({ authClient: authClient as never, projectId: creds.projectId });
    const resources: ConfigSnapshot["resources"] = [];

    const [buckets] = await storage.getBuckets();
    for (const bucket of buckets) {
      const [metadata] = await bucket.getMetadata();
      resources.push({
        resourceType: "gcs_bucket",
        resourceId: bucket.name,
        configuration: {
          location: metadata.location,
          storageClass: metadata.storageClass,
          uniformBucketLevelAccess:
            metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled ?? false,
          encryptionKey: metadata.encryption?.defaultKmsKeyName ?? null,
          versioningEnabled: metadata.versioning?.enabled ?? false,
        },
      });
    }

    return resources;
  }
}
