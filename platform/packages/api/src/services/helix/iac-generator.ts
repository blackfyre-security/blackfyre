/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type IaCFormat = "terraform" | "cloudformation" | "arm_bicep" | "kubernetes" | "ansible";

export interface IaCFix {
  format: IaCFormat;
  code: string;
  applyCommand: string;
  validationCommand: string;
  rollbackCommand: string;
  description: string;
}

export interface IaCValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  IaC Fix Templates                                                  */
/* ------------------------------------------------------------------ */

const TERRAFORM_TEMPLATES: Record<string, (resourceId: string) => IaCFix> = {
  "s3-encryption": (resourceId) => ({
    format: "terraform",
    code: `resource "aws_s3_bucket_server_side_encryption_configuration" "${resourceId}_enc" {
  bucket = "${resourceId}"
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}`,
    applyCommand: "terraform plan -target=aws_s3_bucket_server_side_encryption_configuration && terraform apply",
    validationCommand: "terraform validate && terraform plan",
    rollbackCommand: "terraform destroy -target=aws_s3_bucket_server_side_encryption_configuration",
    description: "Enable S3 bucket encryption with AWS KMS",
  }),

  "s3-public-access": (resourceId) => ({
    format: "terraform",
    code: `resource "aws_s3_bucket_public_access_block" "${resourceId}_block" {
  bucket                  = "${resourceId}"
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`,
    applyCommand: "terraform apply -target=aws_s3_bucket_public_access_block",
    validationCommand: "terraform validate",
    rollbackCommand: "terraform destroy -target=aws_s3_bucket_public_access_block",
    description: "Block all public access to S3 bucket",
  }),

  "cloudtrail-multiregion": (resourceId) => ({
    format: "terraform",
    code: `resource "aws_cloudtrail" "${resourceId}" {
  name                          = "organization-trail"
  s3_bucket_name                = aws_s3_bucket.trail_logs.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }
}`,
    applyCommand: "terraform apply -target=aws_cloudtrail",
    validationCommand: "terraform validate && terraform plan",
    rollbackCommand: "terraform destroy -target=aws_cloudtrail",
    description: "Enable multi-region CloudTrail with log file validation",
  }),

  "security-group-restrict": (resourceId) => ({
    format: "terraform",
    code: `resource "aws_security_group_rule" "${resourceId}_restrict" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/8"]  # Replace with your CIDR
  security_group_id = "${resourceId}"
}`,
    applyCommand: "terraform apply -target=aws_security_group_rule",
    validationCommand: "terraform validate",
    rollbackCommand: "terraform destroy -target=aws_security_group_rule",
    description: "Restrict security group to private CIDR range",
  }),

  "kms-rotation": (resourceId) => ({
    format: "terraform",
    code: `resource "aws_kms_key" "${resourceId}" {
  description         = "KMS key with rotation"
  enable_key_rotation = true
  rotation_period_in_days = 90
}`,
    applyCommand: "terraform apply -target=aws_kms_key",
    validationCommand: "terraform validate",
    rollbackCommand: "terraform state rm aws_kms_key (manual key management)",
    description: "Enable automatic KMS key rotation",
  }),
};

const CLOUDFORMATION_TEMPLATES: Record<string, (resourceId: string) => IaCFix> = {
  "s3-encryption": (resourceId) => ({
    format: "cloudformation",
    code: `Resources:
  ${resourceId}Encryption:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: ${resourceId}
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: aws:kms
            BucketKeyEnabled: true`,
    applyCommand: "aws cloudformation deploy --template-file template.yaml --stack-name s3-encryption",
    validationCommand: "aws cloudformation validate-template --template-body file://template.yaml",
    rollbackCommand: "aws cloudformation delete-stack --stack-name s3-encryption",
    description: "Enable S3 encryption via CloudFormation",
  }),
};

const KUBERNETES_TEMPLATES: Record<string, (resourceId: string) => IaCFix> = {
  "network-policy": (resourceId) => ({
    format: "kubernetes",
    code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${resourceId}-restrict
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: ${resourceId}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              purpose: production
      ports:
        - protocol: TCP
          port: 443`,
    applyCommand: "kubectl apply -f network-policy.yaml",
    validationCommand: "kubectl apply --dry-run=client -f network-policy.yaml",
    rollbackCommand: "kubectl delete -f network-policy.yaml",
    description: "Apply Kubernetes NetworkPolicy to restrict pod traffic",
  }),

  "pod-security": (resourceId) => ({
    format: "kubernetes",
    code: `apiVersion: v1
kind: Pod
metadata:
  name: ${resourceId}
spec:
  securityContext:
    runAsNonRoot: true
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]`,
    applyCommand: "kubectl apply -f pod-security.yaml",
    validationCommand: "kubectl apply --dry-run=server -f pod-security.yaml",
    rollbackCommand: "kubectl delete -f pod-security.yaml",
    description: "Apply pod security standards (restricted profile)",
  }),
};

/* ------------------------------------------------------------------ */
/*  IaC Generator Service                                              */
/* ------------------------------------------------------------------ */

export class IaCGenerator {
  /**
   * Generate an IaC fix for a finding.
   */
  async generateFix(
    findingCategory: string,
    severity: string,
    provider: string,
    format: IaCFormat,
    resourceId?: string,
  ): Promise<IaCFix | null> {
    const rid = resourceId ?? "resource";
    const templateKey = this.getTemplateKey(findingCategory, provider);

    if (format === "terraform") {
      const template = TERRAFORM_TEMPLATES[templateKey];
      return template ? template(rid) : this.generateGenericFix(findingCategory, provider, format, rid);
    }

    if (format === "cloudformation") {
      const template = CLOUDFORMATION_TEMPLATES[templateKey];
      return template ? template(rid) : this.generateGenericFix(findingCategory, provider, format, rid);
    }

    if (format === "kubernetes") {
      const template = KUBERNETES_TEMPLATES[templateKey];
      return template ? template(rid) : this.generateGenericFix(findingCategory, provider, format, rid);
    }

    return this.generateGenericFix(findingCategory, provider, format, rid);
  }

  /**
   * Validate IaC syntax (basic validation).
   */
  async validateSyntax(code: string, format: IaCFormat): Promise<IaCValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!code || code.trim().length === 0) {
      errors.push("Code is empty");
      return { valid: false, errors, warnings };
    }

    if (format === "terraform") {
      if (!code.includes("resource") && !code.includes("data") && !code.includes("module")) {
        warnings.push("No Terraform resource, data, or module block found");
      }
      if (code.includes("0.0.0.0/0")) {
        warnings.push("Code contains 0.0.0.0/0 — ensure this is intentional");
      }
    }

    if (format === "kubernetes") {
      if (!code.includes("apiVersion")) {
        errors.push("Missing apiVersion field");
      }
      if (!code.includes("kind")) {
        errors.push("Missing kind field");
      }
    }

    if (format === "cloudformation") {
      if (!code.includes("Resources")) {
        errors.push("Missing Resources section");
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get supported formats for a cloud provider.
   */
  getSupportedFormats(provider: string): IaCFormat[] {
    const base: IaCFormat[] = ["terraform", "ansible"];
    if (provider === "aws") return [...base, "cloudformation"];
    if (provider === "azure") return [...base, "arm_bicep"];
    if (provider === "gcp") return [...base];
    return ["terraform", "kubernetes", "ansible"];
  }

  private getTemplateKey(category: string, provider: string): string {
    const mapping: Record<string, Record<string, string>> = {
      encryption: { aws: "s3-encryption", default: "s3-encryption" },
      storage: { aws: "s3-public-access", default: "s3-public-access" },
      logging: { aws: "cloudtrail-multiregion", default: "cloudtrail-multiregion" },
      network: { aws: "security-group-restrict", default: "security-group-restrict" },
      config: { aws: "kms-rotation", default: "kms-rotation" },
    };

    return mapping[category]?.[provider] ?? mapping[category]?.default ?? category;
  }

  private generateGenericFix(category: string, provider: string, format: IaCFormat, resourceId: string): IaCFix {
    return {
      format,
      code: `# Auto-generated ${format} fix for ${category} on ${provider}\n# Resource: ${resourceId}\n# TODO: Customize this template for your environment`,
      applyCommand: `# Apply ${format} fix manually`,
      validationCommand: `# Validate ${format} syntax`,
      rollbackCommand: `# Rollback ${format} changes`,
      description: `Generic ${format} fix template for ${category} findings on ${provider}`,
    };
  }
}
