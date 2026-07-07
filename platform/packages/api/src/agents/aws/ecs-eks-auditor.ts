// REAL IMPL (BLACKFYRE 2026-06): ECS/EKS/ECR auditor now enumerates real AWS
// resources via @aws-sdk/client-ecs, @aws-sdk/client-eks and @aws-sdk/client-ecr
// and emits findings derived from real resource properties. No canned/sample
// findings, no TODOs. Public export (class AwsEcsEksAuditorAgent extends
// BaseAgent) is preserved so registry.ts wiring keeps compiling. Pattern mirrors
// CloudAuditorAwsAgent / s3-auditor / ec2-vpc-auditor: resolveCredentials(),
// AwsTemporaryCredentials client construction, AgentFindingPayload shape,
// mapCheckToControls usage, pagination over list APIs, real STS testConnection.
import {
  ECSClient,
  ListTaskDefinitionsCommand,
  DescribeTaskDefinitionCommand,
  type TaskDefinition,
  type ContainerDefinition,
} from "@aws-sdk/client-ecs";
import {
  ECRClient,
  DescribeRepositoriesCommand,
  type Repository,
} from "@aws-sdk/client-ecr";
import {
  EKSClient,
  ListClustersCommand,
  DescribeClusterCommand,
  type Cluster,
} from "@aws-sdk/client-eks";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials, type AwsTemporaryCredentials } from "./credentials.js";

// Environment-variable name fragments that strongly indicate a plaintext secret
// shipped in an ECS container definition's `environment` block. Real secrets
// belong in the `secrets` block (Secrets Manager / SSM ParameterStore), not in
// plaintext env vars baked into the task definition.
const SECRET_NAME_HINTS = [
  "PASSWORD",
  "PASSWD",
  "SECRET",
  "TOKEN",
  "API_KEY",
  "APIKEY",
  "ACCESS_KEY",
  "PRIVATE_KEY",
  "CREDENTIAL",
  "CREDENTIALS",
  "AUTH",
  "SESSION_KEY",
  "ENCRYPTION_KEY",
  "DB_PASS",
  "CONNECTION_STRING",
];

function makeEcsClient(creds: AwsTemporaryCredentials): ECSClient {
  return new ECSClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

function makeEcrClient(creds: AwsTemporaryCredentials): ECRClient {
  return new ECRClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

function makeEksClient(creds: AwsTemporaryCredentials): EKSClient {
  return new EKSClient({
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
 * Runs all ECS task-definition security checks and returns findings.
 *
 * Check: Privileged container in a task definition -> critical
 * Check: Plaintext secret-like env var in a container definition -> critical
 */
export async function auditEcsTaskDefinitions(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeEcsClient(creds);
  const findings: AgentFindingPayload[] = [];

  // Enumerate ACTIVE task-definition ARNs, paginating over the list API.
  const taskDefArns: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListTaskDefinitionsCommand({
        status: "ACTIVE",
        nextToken,
      }),
    );
    for (const arn of resp.taskDefinitionArns ?? []) {
      taskDefArns.push(arn);
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  for (const arn of taskDefArns) {
    const resp = await client.send(
      new DescribeTaskDefinitionCommand({ taskDefinition: arn }),
    );
    const td = resp.taskDefinition;
    if (!td) continue;
    findings.push(...checkTaskDefinition(td, arn));
  }

  return findings;
}

function checkTaskDefinition(
  td: TaskDefinition,
  arn: string,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const region = regionFromArn(td.taskDefinitionArn ?? arn);
  const family = td.family ?? "unknown";
  const resourceId = td.taskDefinitionArn ?? arn;

  for (const container of td.containerDefinitions ?? []) {
    findings.push(...checkPrivilegedContainer(container, family, resourceId, region));
    findings.push(...checkPlaintextSecrets(container, family, resourceId, region));
  }

  return findings;
}

function checkPrivilegedContainer(
  container: ContainerDefinition,
  family: string,
  resourceId: string,
  region: string | null,
): AgentFindingPayload[] {
  if (container.privileged !== true) return [];

  const containerName = container.name ?? "unnamed";
  return [
    {
      title: `ECS task definition "${family}" runs container "${containerName}" in privileged mode`,
      description: `Container "${containerName}" in ECS task definition ${resourceId} has privileged=true, granting it full access to the host's devices and kernel capabilities. A compromise of this container escalates to host-level control. Remove the privileged flag and grant only the specific Linux capabilities the workload requires.`,
      severity: "critical",
      category: "config",
      resourceType: "AWS::ECS::TaskDefinition",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecs_task_privileged_container"),
      source: "aws-ecs-eks-auditor",
    },
  ];
}

function checkPlaintextSecrets(
  container: ContainerDefinition,
  family: string,
  resourceId: string,
  region: string | null,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const containerName = container.name ?? "unnamed";

  for (const env of container.environment ?? []) {
    const name = env.name;
    if (!name) continue;
    const upper = name.toUpperCase();
    const looksSecret = SECRET_NAME_HINTS.some((hint) => upper.includes(hint));
    // Only flag when there is an actual plaintext value present. Empty-string
    // env vars are not a secret-exposure finding.
    if (looksSecret && env.value !== undefined && env.value !== "") {
      findings.push({
        title: `ECS task definition "${family}" exposes a plaintext secret in env var "${name}"`,
        description: `Container "${containerName}" in ECS task definition ${resourceId} declares environment variable "${name}" with a plaintext value. Sensitive values are visible in the task definition, the console, and ECS API responses. Move it to the container "secrets" block backed by AWS Secrets Manager or SSM Parameter Store (valueFrom) instead of a plaintext "environment" entry.`,
        severity: "critical",
        category: "encryption",
        resourceType: "AWS::ECS::TaskDefinition",
        resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("ecs_task_plaintext_secret"),
        source: "aws-ecs-eks-auditor",
      });
    }
  }

  return findings;
}

/**
 * Runs all ECR repository security checks and returns findings.
 *
 * Check: Repository without scan-on-push image scanning -> high
 */
export async function auditEcrRepositories(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeEcrClient(creds);
  const findings: AgentFindingPayload[] = [];

  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new DescribeRepositoriesCommand({ nextToken }),
    );
    for (const repo of resp.repositories ?? []) {
      findings.push(...checkRepositoryScanOnPush(repo));
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  return findings;
}

function checkRepositoryScanOnPush(repo: Repository): AgentFindingPayload[] {
  const scanOnPush = repo.imageScanningConfiguration?.scanOnPush === true;
  if (scanOnPush) return [];

  const name = repo.repositoryName ?? repo.repositoryArn ?? "unknown";
  const resourceId = repo.repositoryArn ?? repo.repositoryName ?? "unknown";
  const region = regionFromArn(repo.repositoryArn);

  return [
    {
      title: `ECR repository "${name}" does not scan images on push`,
      description: `ECR repository ${resourceId} has imageScanningConfiguration.scanOnPush disabled. Images pushed to this repository are not automatically scanned for known OS and language-package vulnerabilities, so vulnerable images can reach production undetected. Enable scan-on-push (or register the repository with enhanced/Inspector scanning).`,
      severity: "high",
      category: "config",
      resourceType: "AWS::ECR::Repository",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("ecr_scan_on_push_disabled"),
      source: "aws-ecs-eks-auditor",
    },
  ];
}

// EKS control-plane log types that should be enabled for audit/forensics.
const REQUIRED_EKS_LOG_TYPES = ["api", "audit", "authenticator"];

/**
 * Runs all EKS cluster security checks and returns findings.
 *
 * Check: Control-plane logging disabled / incomplete -> medium
 * Check: API endpoint publicly accessible -> high (critical if open to 0.0.0.0/0)
 */
export async function auditEksClusters(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeEksClient(creds);
  const findings: AgentFindingPayload[] = [];

  const clusterNames: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(new ListClustersCommand({ nextToken }));
    for (const name of resp.clusters ?? []) {
      clusterNames.push(name);
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  for (const name of clusterNames) {
    const resp = await client.send(new DescribeClusterCommand({ name }));
    const cluster = resp.cluster;
    if (!cluster) continue;
    findings.push(...checkClusterLogging(cluster, name));
    findings.push(...checkClusterEndpointAccess(cluster, name));
  }

  return findings;
}

function checkClusterLogging(
  cluster: Cluster,
  name: string,
): AgentFindingPayload[] {
  // Collect every log type that is currently ENABLED across the clusterLogging
  // LogSetup entries (each entry carries enabled + types[]).
  const enabledTypes = new Set<string>();
  for (const setup of cluster.logging?.clusterLogging ?? []) {
    if (setup.enabled !== true) continue;
    for (const t of setup.types ?? []) {
      enabledTypes.add(String(t));
    }
  }

  const missing = REQUIRED_EKS_LOG_TYPES.filter((t) => !enabledTypes.has(t));
  if (missing.length === 0) return [];

  const resourceId = cluster.arn ?? cluster.name ?? name;
  const region = regionFromArn(cluster.arn);
  const clusterName = cluster.name ?? name;

  return [
    {
      title: `EKS cluster "${clusterName}" has incomplete control-plane logging`,
      description: `EKS cluster ${resourceId} is missing control-plane log type(s): ${missing.join(", ")}. Without API, audit, and authenticator logs exported to CloudWatch, intrusions and unauthorized RBAC/authentication activity against the Kubernetes API server are not auditable. Enable the missing control-plane log types.`,
      severity: "medium",
      category: "logging",
      resourceType: "AWS::EKS::Cluster",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("eks_control_plane_logging_disabled"),
      source: "aws-ecs-eks-auditor",
    },
  ];
}

function checkClusterEndpointAccess(
  cluster: Cluster,
  name: string,
): AgentFindingPayload[] {
  const vpc = cluster.resourcesVpcConfig;
  if (!vpc || vpc.endpointPublicAccess !== true) return [];

  const resourceId = cluster.arn ?? cluster.name ?? name;
  const region = regionFromArn(cluster.arn);
  const clusterName = cluster.name ?? name;
  const cidrs = vpc.publicAccessCidrs ?? [];
  const openToWorld = cidrs.length === 0 || cidrs.includes("0.0.0.0/0");

  // When the public endpoint is reachable from the entire internet (no CIDR
  // restriction), the Kubernetes API server — and therefore the RBAC
  // authorization surface — is exposed to anonymous network reach. That is the
  // network precondition that makes RBAC misconfiguration directly exploitable,
  // so it is escalated to critical.
  const severity: AgentFindingPayload["severity"] = openToWorld
    ? "critical"
    : "high";
  const cidrDesc = openToWorld
    ? "from 0.0.0.0/0 (the entire internet)"
    : `from public CIDRs ${cidrs.join(", ")}`;

  return [
    {
      title: `EKS cluster "${clusterName}" API endpoint is publicly accessible`,
      description: `EKS cluster ${resourceId} has resourcesVpcConfig.endpointPublicAccess enabled and is reachable ${cidrDesc}. The Kubernetes API server, which enforces RBAC, is exposed to the public internet. Restrict publicAccessCidrs to known administrative ranges or disable the public endpoint and use private access, and review RBAC bindings (especially cluster-admin grants and system:anonymous/unauthenticated access).`,
      severity,
      category: "network",
      resourceType: "AWS::EKS::Cluster",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("eks_endpoint_public_access"),
      source: "aws-ecs-eks-auditor",
    },
  ];
}

/**
 * AWS ECS/EKS/ECR Auditor Agent
 *
 * Scans: ECS task definitions (privileged containers, plaintext secrets),
 * ECR repositories (scan-on-push), EKS clusters (control-plane logging,
 * public endpoint / RBAC exposure).
 *
 * Uses real AWS SDK v3 calls. Credentials are resolved once via STS AssumeRole
 * (resolveCredentials) and shared across the ECS/ECR/EKS sub-auditors.
 */
export class AwsEcsEksAuditorAgent extends BaseAgent {
  readonly type = "aws-ecs-eks-auditor";
  readonly displayName = "AWS ECS/EKS Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // Resolve scoped read-only credentials once, share across sub-auditors.
      const creds = await resolveCredentials(ctx.credentialRef);

      // Phase 1: ECS task definitions (0-40%)
      findingsCount += await this.emit(() => auditEcsTaskDefinitions(creds), ctx);
      ctx.onProgress(40);

      // Phase 2: ECR repositories (40-70%)
      findingsCount += await this.emit(() => auditEcrRepositories(creds), ctx);
      ctx.onProgress(70);

      // Phase 3: EKS clusters (70-100%)
      findingsCount += await this.emit(() => auditEksClusters(creds), ctx);
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

  /**
   * Runs a sub-auditor and emits each finding through the context. Returns the
   * number of findings emitted.
   */
  private async emit(
    auditFn: () => Promise<AgentFindingPayload[]>,
    ctx: AgentContext,
  ): Promise<number> {
    const findings = await auditFn();
    for (const finding of findings) {
      await ctx.onFinding(finding);
    }
    return findings.length;
  }
}
