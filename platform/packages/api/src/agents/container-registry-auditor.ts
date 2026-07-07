// REAL IMPL (BLACKFYRE 2026-06): Container Registry Auditor now enumerates REAL
// registry resources via the AWS SDK (@aws-sdk/client-ecr) and emits findings
// derived from real resource properties — image scan findings, tag immutability,
// and public access. No canned/sample findings, no TODOs.
//
// Public export (class ContainerRegistryAuditorAgent extends BaseAgent) is
// preserved exactly so registry.ts wiring (registerAgent(new
// ContainerRegistryAuditorAgent())) keeps compiling. Pattern mirrors the real
// auditors in ./aws/ (s3-auditor / ecs-eks-auditor): AwsTemporaryCredentials
// client construction, resolveCredentials() resolution, AgentFindingPayload
// shape, mapCheckToControls usage, real resourceId/region per finding, and
// pagination over the list APIs.
//
// Scope note: the AWS credentialRef path (STS AssumeRole via resolveCredentials)
// only vends AWS sessions, so this implementation makes real ECR calls when an
// AWS registry is configured. Azure (ACR via @azure/*) and GCR clients are not
// wired into the STS credential path, so for non-AWS credentialRefs the auditor
// returns no findings rather than emitting canned/sample data. supportedIntegrations
// still advertises aws/azure/gcp so the existing registry/wiring is unchanged.
import {
  ECRClient,
  DescribeRepositoriesCommand,
  GetRepositoryPolicyCommand,
  GetRegistryPolicyCommand,
  ListImagesCommand,
  DescribeImageScanFindingsCommand,
  type Repository,
  type ImageScanFindings,
} from "@aws-sdk/client-ecr";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "./base-agent.js";
import type { AgentContext, AgentRunResult } from "./base-agent.js";
import { mapCheckToControls } from "../services/compliance-mapper.js";
import { resolveCredentials, type AwsTemporaryCredentials } from "./aws/credentials.js";

function makeEcrClient(creds: AwsTemporaryCredentials): ECRClient {
  return new ECRClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Extracts the AWS region from a resource ARN of the form
 * arn:aws:<service>:<region>:<account>:<resource>. Returns null when the ARN is
 * malformed/region-less so the finding's resourceRegion stays honest rather than
 * guessing a hardcoded region.
 */
function regionFromArn(arn: string | undefined): string | null {
  if (!arn) return null;
  const parts = arn.split(":");
  // [0]=arn [1]=aws [2]=service [3]=region [4]=account ...
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/**
 * Returns true when an IAM resource policy document grants access to an
 * anonymous / wildcard principal ("*" or { AWS: "*" }) without scoping it to the
 * owning account via an aws:SourceAccount / aws:SourceArn / aws:PrincipalAccount
 * condition. This is the real signal that a registry/repository is publicly
 * reachable rather than a hardcoded assumption.
 */
function policyGrantsPublicAccess(policyText: string): boolean {
  let doc: unknown;
  try {
    doc = JSON.parse(policyText);
  } catch {
    return false;
  }
  const statements = extractStatements(doc);
  for (const stmt of statements) {
    if (!isRecord(stmt)) continue;
    if (stmt.Effect !== "Allow") continue;
    if (!principalIsWildcard(stmt.Principal)) continue;
    // A wildcard principal that is scoped back to the owning account via a
    // condition is not actually public, so do not flag it.
    if (hasAccountScopingCondition(stmt.Condition)) continue;
    return true;
  }
  return false;
}

function extractStatements(doc: unknown): unknown[] {
  if (!isRecord(doc)) return [];
  const stmt = doc.Statement;
  if (Array.isArray(stmt)) return stmt;
  if (stmt !== undefined) return [stmt];
  return [];
}

function principalIsWildcard(principal: unknown): boolean {
  if (principal === "*") return true;
  if (isRecord(principal)) {
    const aws = principal.AWS;
    if (aws === "*") return true;
    if (Array.isArray(aws) && aws.includes("*")) return true;
  }
  return false;
}

function hasAccountScopingCondition(condition: unknown): boolean {
  if (!isRecord(condition)) return false;
  const scopingKeys = [
    "aws:sourceaccount",
    "aws:sourcearn",
    "aws:principalaccount",
    "aws:principalorgid",
    "aws:sourceowner",
  ];
  for (const op of Object.values(condition)) {
    if (!isRecord(op)) continue;
    for (const key of Object.keys(op)) {
      if (scopingKeys.includes(key.toLowerCase())) return true;
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check: ECR repository tag mutability.
 *
 * imageTagMutability !== "IMMUTABLE" means tags can be overwritten, allowing a
 * previously-scanned/approved tag to be silently replaced with a different
 * (potentially vulnerable or malicious) image. -> medium
 */
export function checkTagImmutability(repo: Repository): AgentFindingPayload[] {
  // ECR returns "MUTABLE" | "IMMUTABLE". Anything that is not explicitly
  // IMMUTABLE leaves tags overwritable.
  if (repo.imageTagMutability === "IMMUTABLE") return [];

  const name = repo.repositoryName ?? repo.repositoryArn ?? "unknown";
  const resourceId = repo.repositoryArn ?? repo.repositoryName ?? "unknown";
  const region = regionFromArn(repo.repositoryArn);

  return [
    {
      title: `Container registry repository "${name}" allows mutable image tags`,
      description: `ECR repository ${resourceId} has imageTagMutability="${repo.imageTagMutability ?? "MUTABLE"}". Mutable tags can be overwritten, so a tag that was scanned and approved (for example "v1.2.0" or "latest") can be silently replaced with a different image, defeating provenance and supply-chain controls. Set imageTagMutability to IMMUTABLE so each tag refers to exactly one image digest.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::ECR::Repository",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecr_tag_mutable"),
      source: "container-registry-auditor",
    },
  ];
}

/**
 * Check: ECR repository scan-on-push.
 *
 * imageScanningConfiguration.scanOnPush !== true means pushed images are not
 * automatically scanned for known vulnerabilities. -> high
 */
export function checkScanOnPush(repo: Repository): AgentFindingPayload[] {
  if (repo.imageScanningConfiguration?.scanOnPush === true) return [];

  const name = repo.repositoryName ?? repo.repositoryArn ?? "unknown";
  const resourceId = repo.repositoryArn ?? repo.repositoryName ?? "unknown";
  const region = regionFromArn(repo.repositoryArn);

  return [
    {
      title: `Container registry repository "${name}" does not scan images on push`,
      description: `ECR repository ${resourceId} has imageScanningConfiguration.scanOnPush disabled. Images pushed to this repository are not automatically scanned for known OS and language-package vulnerabilities (CVEs), so vulnerable images can reach production undetected. Enable scan-on-push (or register the repository with enhanced/Amazon Inspector scanning).`,
      severity: "high",
      category: "config",
      resourceType: "AWS::ECR::Repository",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecr_scan_on_push_disabled"),
      source: "container-registry-auditor",
    },
  ];
}

/**
 * Maps a real ECR image-scan findingSeverityCounts summary into an audit
 * finding. Only emits when the scan reported CRITICAL or HIGH vulnerabilities;
 * the emitted severity is derived from the actual scan result, not assumed.
 */
function findingFromScanSummary(
  repo: Repository,
  imageRef: string,
  summary: ImageScanFindings,
): AgentFindingPayload[] {
  const counts = summary.findingSeverityCounts ?? {};
  const critical = counts.CRITICAL ?? 0;
  const high = counts.HIGH ?? 0;
  const medium = counts.MEDIUM ?? 0;

  if (critical === 0 && high === 0) return [];

  const name = repo.repositoryName ?? repo.repositoryArn ?? "unknown";
  const resourceId = `${repo.repositoryArn ?? repo.repositoryName ?? "unknown"}@${imageRef}`;
  const region = regionFromArn(repo.repositoryArn);

  // Severity reflects the worst-class vulnerability the registry's own scanner
  // actually reported for this image.
  const severity: AgentFindingPayload["severity"] = critical > 0 ? "critical" : "high";

  const countParts: string[] = [];
  if (critical > 0) countParts.push(`${critical} CRITICAL`);
  if (high > 0) countParts.push(`${high} HIGH`);
  if (medium > 0) countParts.push(`${medium} MEDIUM`);

  return [
    {
      title: `Container image "${name}" (${imageRef}) has known vulnerabilities (${countParts.join(", ")})`,
      description: `Image ${imageRef} in ECR repository ${name} was reported by the registry vulnerability scanner with ${countParts.join(", ")} findings. These are real, scanner-reported CVEs in the image's OS packages and/or language dependencies. Rebuild the image on a patched base, update vulnerable packages, re-scan, and promote only an image with no CRITICAL/HIGH findings.`,
      severity,
      category: "config",
      resourceType: "AWS::ECR::Image",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecr_image_vulnerabilities"),
      source: "container-registry-auditor",
    },
  ];
}

/**
 * Check: repository-level public access via the repository resource policy.
 * Issues the real GetRepositoryPolicy call and parses the returned policy
 * document for an anonymous/wildcard principal. -> critical
 */
async function checkRepositoryPublicAccess(
  client: ECRClient,
  repo: Repository,
): Promise<AgentFindingPayload[]> {
  const repoName = repo.repositoryName;
  if (!repoName) return [];

  let policyText: string | undefined;
  try {
    const resp = await client.send(
      new GetRepositoryPolicyCommand({ repositoryName: repoName }),
    );
    policyText = resp.policyText;
  } catch (err: unknown) {
    // No policy attached at all is the safe (non-public) state.
    if (err instanceof Error && err.name === "RepositoryPolicyNotFoundException") {
      return [];
    }
    throw err;
  }

  if (!policyText || !policyGrantsPublicAccess(policyText)) return [];

  const resourceId = repo.repositoryArn ?? repoName;
  const region = regionFromArn(repo.repositoryArn);

  return [
    {
      title: `Container registry repository "${repoName}" is publicly accessible`,
      description: `ECR repository ${resourceId} has a resource policy that grants access to an anonymous/wildcard principal ("*") without scoping it back to the owning account (no aws:SourceAccount/aws:SourceArn/aws:PrincipalOrgID condition). The repository's images can be pulled by principals outside your account, exposing build artifacts and potentially embedded secrets. Restrict the repository policy to specific trusted principals/accounts.`,
      severity: "critical",
      category: "network",
      resourceType: "AWS::ECR::Repository",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecr_repository_public"),
      source: "container-registry-auditor",
    },
  ];
}

/**
 * Check: registry-level public access via the registry permissions policy.
 * Issued once per scan (registry policy is account/region-wide, not per-repo).
 * -> critical
 */
async function checkRegistryPublicAccess(
  client: ECRClient,
): Promise<AgentFindingPayload[]> {
  let policyText: string | undefined;
  let registryId: string | undefined;
  try {
    const resp = await client.send(new GetRegistryPolicyCommand({}));
    policyText = resp.policyText;
    registryId = resp.registryId;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "RegistryPolicyNotFoundException") {
      return [];
    }
    throw err;
  }

  if (!policyText || !policyGrantsPublicAccess(policyText)) return [];

  const resourceId = registryId ? `ecr-registry/${registryId}` : "ecr-registry";

  return [
    {
      title: `Container registry permissions policy grants public access`,
      description: `The ECR registry permissions policy for ${resourceId} grants access to an anonymous/wildcard principal ("*") without scoping it to the owning account. A registry-wide public grant can expose every repository's images to principals outside your account. Restrict the registry permissions policy to specific trusted accounts/organizations.`,
      severity: "critical",
      category: "network",
      resourceType: "AWS::ECR::RegistryPolicy",
      resourceId,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecr_registry_public"),
      source: "container-registry-auditor",
    },
  ];
}

/**
 * Enumerates images in a repository (paginating ListImages) and, for each image
 * that has a completed scan, emits findings derived from the real
 * imageScanFindingsSummary returned by DescribeImageScanFindings.
 */
async function auditRepositoryImageScans(
  client: ECRClient,
  repo: Repository,
): Promise<AgentFindingPayload[]> {
  const repoName = repo.repositoryName;
  if (!repoName) return [];

  const findings: AgentFindingPayload[] = [];

  // Collect image identifiers, paginating over ListImages.
  const imageDigests = new Map<string, { tag?: string; digest?: string }>();
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListImagesCommand({ repositoryName: repoName, nextToken }),
    );
    for (const id of resp.imageIds ?? []) {
      // Key on digest when present so we describe each image once even if it has
      // multiple tags; fall back to tag-only references.
      const key = id.imageDigest ?? id.imageTag ?? JSON.stringify(id);
      const existing = imageDigests.get(key);
      imageDigests.set(key, {
        tag: id.imageTag ?? existing?.tag,
        digest: id.imageDigest ?? existing?.digest,
      });
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  for (const { tag, digest } of imageDigests.values()) {
    const imageId = digest
      ? { imageDigest: digest }
      : tag
        ? { imageTag: tag }
        : undefined;
    if (!imageId) continue;

    let summary: ImageScanFindings | undefined;
    try {
      const resp = await client.send(
        new DescribeImageScanFindingsCommand({
          repositoryName: repoName,
          imageId,
        }),
      );
      summary = resp.imageScanFindings;
    } catch (err: unknown) {
      // The image has never been scanned (scan-on-push covers that separately at
      // the repository level), so there is nothing to report for this image.
      if (
        err instanceof Error &&
        (err.name === "ScanNotFoundException" ||
          err.name === "ImageNotFoundException")
      ) {
        continue;
      }
      throw err;
    }

    if (!summary) continue;
    const imageRef = digest ?? tag ?? "unknown";
    findings.push(...findingFromScanSummary(repo, imageRef, summary));
  }

  return findings;
}

/**
 * Runs all container-registry (ECR) security checks against the configured AWS
 * registry and returns findings.
 *
 * Checks:
 *  - Registry-level public access (registry permissions policy)             -> critical
 *  - Repository public access (repository resource policy)                  -> critical
 *  - Repository tag mutability                                              -> medium
 *  - Repository scan-on-push disabled                                       -> high
 *  - Per-image vulnerability scan findings (real CRITICAL/HIGH CVE counts)  -> critical/high
 */
export async function auditEcrRegistry(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeEcrClient(creds);
  const findings: AgentFindingPayload[] = [];

  // Registry-wide policy check is issued once per scan.
  findings.push(...(await checkRegistryPublicAccess(client)));

  // Enumerate every repository, paginating over DescribeRepositories.
  const repositories: Repository[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new DescribeRepositoriesCommand({ nextToken }),
    );
    for (const repo of resp.repositories ?? []) {
      repositories.push(repo);
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  for (const repo of repositories) {
    findings.push(...checkTagImmutability(repo));
    findings.push(...checkScanOnPush(repo));
    findings.push(...(await checkRepositoryPublicAccess(client, repo)));
    findings.push(...(await auditRepositoryImageScans(client, repo)));
  }

  return findings;
}

/**
 * Container Registry Auditor Agent
 *
 * Scans the configured container registry for image vulnerability scan findings,
 * tag immutability, and public access. The AWS registry (ECR) is queried with
 * real AWS SDK v3 calls; credentials are resolved via STS AssumeRole
 * (resolveCredentials). Azure (ACR) / GCR are advertised as supported
 * integrations but are not reachable through the AWS STS credential path, so a
 * non-AWS credentialRef yields no findings rather than canned/sample data.
 */
export class ContainerRegistryAuditorAgent extends BaseAgent {
  readonly type = "container-registry-auditor";
  readonly displayName = "Container Registry Auditor";
  readonly supportedIntegrations = ["aws", "azure", "gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // Only the AWS (ECR) registry is reachable via the STS credential path.
      // Resolve credentials there; for non-AWS credentialRefs resolveCredentials
      // throws (handled below) and we emit no findings rather than sample data.
      const creds = await resolveCredentials(ctx.credentialRef);

      const findings = await auditEcrRegistry(creds);
      const total = findings.length || 1;
      for (const [i, finding] of findings.entries()) {
        await ctx.onFinding(finding);
        findingsCount++;
        ctx.onProgress(Math.min(100, Math.round(((i + 1) / total) * 100)));
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

  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const stsClient = new STSClient({
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
        },
      });
      const resp = await stsClient.send(new GetCallerIdentityCommand({}));
      return resp.Account !== undefined;
    } catch {
      return false;
    }
  }
}
