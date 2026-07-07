import { vpc } from "./network.js";
import { Image } from "@pulumi/docker-build";
import { resolve } from "node:path";

// SST esbuilds infra/*.ts into .sst/platform/sst.config.XXX.mjs, so import.meta.url
// resolves to the bundle location (wrong). process.cwd() is reliably the platform/ root.
const containersDir = resolve(process.cwd(), "infra/containers");

/**
 * Prowler + IaC Scanner Infrastructure
 *
 * SST v4's high-level container Lambda support is Python-specific and requires a
 * pyproject.toml-rooted directory structure. Our scanners ship custom Dockerfiles,
 * so we drop to raw Pulumi resources:
 *   - aws.ecr.Repository — image registry per scanner
 *   - @pulumi/docker-build Image — builds + pushes the Dockerfile
 *   - aws.lambda.Function (packageType: "Image") — runs the container as Lambda
 *   - aws.iam.Role + policy attachments — exec + VPC + scoped permissions
 *
 * Both scanners write outputs to the ScanArtifactsBucket S3 bucket (7-day lifecycle).
 */

const region = "ap-south-1";

// S3 bucket for scan artifacts (Prowler OCSF output, SARIF files, cloned repos)
export const scanArtifacts = new sst.aws.Bucket("ScanArtifactsBucket", {});

// Lifecycle: auto-delete artifacts after 7 days
new aws.s3.BucketLifecycleConfigurationV2("ScanArtifactsLifecycle", {
  bucket: scanArtifacts.name,
  rules: [{
    id: "expire-artifacts",
    status: "Enabled",
    expiration: { days: 7 },
  }],
});

// SSE default
new aws.s3.BucketServerSideEncryptionConfigurationV2("ScanArtifactsEncryption", {
  bucket: scanArtifacts.name,
  rules: [{
    applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" },
  }],
});

// Block public access
new aws.s3.BucketPublicAccessBlock("ScanArtifactsPublicBlock", {
  bucket: scanArtifacts.name,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// ─── Helper: build a container Lambda from a directory with a Dockerfile ───

interface ContainerLambdaOpts {
  memorySize: number;
  timeoutSec: number;
  environment?: Record<string, string>;
  extraStatements?: any[];
}

function buildContainerLambda(name: string, contextPath: string, opts: ContainerLambdaOpts) {
  // Per-scanner ECR repository — name MUST be lowercase per AWS ECR regex
  const repoName = `blackfyre-${$app.stage}-${name.toLowerCase()}`;
  const repo = new aws.ecr.Repository(`${name}Repo`, {
    name: repoName,
    forceDelete: true,
    imageScanningConfiguration: { scanOnPush: true },
    encryptionConfigurations: [{ encryptionType: "AES256" }],
  });

  // ECR auth token for the build/push step
  const auth = aws.ecr.getAuthorizationTokenOutput({});

  // Build the Docker image and push to ECR
  // contextPath is resolved to an absolute path; the SST runtime's CWD is .sst/platform/
  // so relative paths break unless anchored from import.meta.url.
  const absoluteContext = resolve(containersDir, contextPath);
  const image = new Image(`${name}Image`, {
    context: { location: absoluteContext },
    dockerfile: { location: resolve(absoluteContext, "Dockerfile") },
    push: true,
    platforms: ["linux/amd64"], // Lambda runtimes are amd64
    tags: [$interpolate`${repo.repositoryUrl}:latest`],
    registries: [{
      address: repo.repositoryUrl,
      username: auth.userName,
      password: auth.password,
    }],
  });

  // IAM execution role
  const role = new aws.iam.Role(`${name}Role`, {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
        Action: "sts:AssumeRole",
      }],
    }),
  });

  // CloudWatch logs + VPC ENI lifecycle
  new aws.iam.RolePolicyAttachment(`${name}BasicExec`, {
    role: role.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });
  new aws.iam.RolePolicyAttachment(`${name}VpcExec`, {
    role: role.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
  });

  // Scanner-specific permissions
  if (opts.extraStatements && opts.extraStatements.length > 0) {
    new aws.iam.RolePolicy(`${name}ExtraPolicy`, {
      role: role.name,
      policy: $jsonStringify({
        Version: "2012-10-17",
        Statement: opts.extraStatements,
      }),
    });
  }

  // The Lambda function itself, packaged as container image.
  // Use tag-based URI (not image.ref's manifest digest) — docker-build pushes an
  // OCI manifest index which Lambda doesn't accept; the :latest tag points at the
  // single-platform amd64 manifest underneath.
  const fn = new aws.lambda.Function(name, {
    packageType: "Image",
    imageUri: $interpolate`${repo.repositoryUrl}:latest`,
    architectures: ["x86_64"],
    role: role.arn,
    memorySize: opts.memorySize,
    timeout: opts.timeoutSec,
    environment: opts.environment
      ? { variables: opts.environment }
      : undefined,
    vpcConfig: {
      subnetIds: vpc.privateSubnets,
      securityGroupIds: [vpc.securityGroup],
    },
  }, { dependsOn: [image] });

  // These scanners are raw aws.lambda.Function (not sst.aws.Function), so they
  // don't get SST's managed log group. Lambda would otherwise auto-create
  // /aws/lambda/<fn> with NEVER-EXPIRE retention. Pre-create the log group with
  // 14-day retention so it can't grow unbounded.
  new aws.cloudwatch.LogGroup(`${name}LogGroup`, {
    name: $interpolate`/aws/lambda/${fn.name}`,
    retentionInDays: 14,
  });

  return fn;
}

// ─── Prowler scanner: deep cloud security scanning ───
export const prowlerScanner = buildContainerLambda("ProwlerScanner", "prowler-scanner", {
  memorySize: 2048,
  timeoutSec: 900, // 15 minutes
  // AWS_REGION is reserved by Lambda runtime, can't be set; available implicitly
  environment: {},
  extraStatements: [
    {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): the follow-up review flagged
      // Prowler's blast radius alongside the IaC scanner's secretsmanager scope.
      // Cross-account sts:AssumeRole on arn:aws:iam::*:role/blackfyre-* is the
      // INTENDED minimal audit surface: Prowler must hop into the customer-side
      // blackfyre-* audit role to read their cloud config, and the customer's own
      // role/trust policy bounds what it can do there. We deliberately do NOT
      // narrow the account part of the ARN (customer account IDs are dynamic) but
      // the role-name prefix (blackfyre-*) prevents assuming arbitrary roles.
      Effect: "Allow",
      Action: ["sts:AssumeRole"],
      Resource: ["arn:aws:iam::*:role/blackfyre-*"],
    },
    {
      Effect: "Allow",
      Action: ["s3:PutObject", "s3:GetObject"],
      Resource: [$interpolate`${scanArtifacts.arn}/*`],
    },
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Prowler is INTENTIONALLY granted
    // NO secretsmanager:GetSecretValue. The IaC scanner's grant was scoped to
    // blackfyre/<stage>/scanner/* because it needs scanner secrets; Prowler needs
    // none (it authenticates purely via the cross-account assumed role above), so
    // the correct remediation here is the absence of any secrets grant rather than
    // a scoped one. Do not add a blackfyre/* secretsmanager statement to Prowler.
  ],
});

// ─── IaC scanner: Checkov / Semgrep / Bandit on customer code ───
export const iacScanner = buildContainerLambda("IacScanner", "iac-scanner", {
  memorySize: 1024,
  timeoutSec: 600, // 10 minutes
  // AWS_REGION is reserved by Lambda runtime, can't be set; available implicitly
  environment: {},
  extraStatements: [
    {
      Effect: "Allow",
      Action: ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      Resource: [
        $interpolate`${scanArtifacts.arn}`,
        $interpolate`${scanArtifacts.arn}/*`,
      ],
    },
    {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): scanner role granted
      // secretsmanager:GetSecretValue over ALL blackfyre/* secrets (db master
      // password, JWT/encryption keys, payment + OAuth secrets). The IaC scanner // gitleaks:allow
      // runs Checkov/Semgrep/Bandit on UNTRUSTED customer code — the single
      // largest untrusted-input surface — so an RCE there would have exfiltrated
      // every platform secret. Scope the resource ARNs to only the dedicated
      // scanner secrets namespace (blackfyre/<stage>/scanner/*). If the scanner
      // needs another secret later, add its explicit ARN here — never widen back
      // to blackfyre/*.
      Effect: "Allow",
      Action: ["secretsmanager:GetSecretValue"],
      Resource: [
        $interpolate`arn:aws:secretsmanager:${region}:*:secret:blackfyre/${$app.stage}/scanner/*`,
      ],
    },
  ],
});

export const scanners = {
  prowlerScanner,
  iacScanner,
  scanArtifacts,
};
