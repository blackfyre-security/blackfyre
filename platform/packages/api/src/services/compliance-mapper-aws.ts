/**
 * AWS Compliance Mapper — Maps AWS check types to compliance control mappings
 * across all 6 frameworks (SOC2, ISO27001, HIPAA, GDPR, PCI-DSS, DPDPA).
 *
 * Extracted from the original compliance-mapper.ts to keep per-cloud files
 * under 500 lines per CLAUDE.md rule.
 */

export interface ControlMappingEntry {
  framework: "soc2" | "iso27001" | "hipaa" | "gdpr" | "pcidss" | "dpdpa" | "nist80053";
  controlId: string;
  controlName: string;
  status: "pass" | "partial" | "fail" | "na";
  weight: number;
}

type Framework = ControlMappingEntry["framework"];

/** Helper to build a mapping entry concisely. */
export function m(framework: Framework, controlId: string, controlName: string, weight: number): ControlMappingEntry {
  return { framework, controlId, controlName, status: "fail", weight };
}

// ---------------------------------------------------------------------------
// IAM check types (5)
// ---------------------------------------------------------------------------

const iam_user_no_mfa: ControlMappingEntry[] = [
  m("soc2", "CC6.2", "User Authentication", 3),
  m("iso27001", "A.8.5", "Secure Authentication", 3),
  m("hipaa", "164.312(d)", "Person or Entity Authentication", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "IA-2", "Identification and Authentication", 3),
  m("nist80053", "IA-5", "Authenticator Management", 2),
];

const iam_console_and_access_keys: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(1)", "Data Protection by Design", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "IA-5", "Authenticator Management", 2),
];

const iam_root_access_keys: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.2", "User Authentication", 3),
  m("iso27001", "A.8.5", "Secure Authentication", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("hipaa", "164.312(d)", "Person or Entity Authentication", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
  m("nist80053", "IA-2", "Identification and Authentication", 3),
];

const iam_weak_password_policy: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.5", "Secure Authentication", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.2.1", "Unique Identification", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "IA-5", "Authenticator Management", 2),
  m("nist80053", "IA-2", "Identification and Authentication", 3),
];

const iam_wildcard_policy: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
];

// ---------------------------------------------------------------------------
// S3 check types (4)
// ---------------------------------------------------------------------------

const s3_public_access: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
];

const s3_no_encryption: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("pcidss", "4.1", "Transmission Encryption", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const s3_no_versioning: ControlMappingEntry[] = [
  m("soc2", "A1.2", "Recovery Procedures", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(c)(1)", "Integrity", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "CP-9", "System Backup", 2),
];

const s3_no_logging: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Content", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "AU-6", "Audit Record Review", 2),
];

// ---------------------------------------------------------------------------
// EC2/VPC check types (3)
// ---------------------------------------------------------------------------

const ec2_sg_open_ssh: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("pcidss", "1.2", "Network Security Configuration", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

const ec2_sg_unrestricted_egress: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("iso27001", "A.8.21", "Web Services Security", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "SC-8", "Transmission Confidentiality", 2),
];

const ec2_unencrypted_ebs: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

// ---------------------------------------------------------------------------
// CloudTrail check types (4)
// ---------------------------------------------------------------------------

const cloudtrail_no_trails: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Incident Response", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("pcidss", "10.2", "Audit Log Content", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

const cloudtrail_not_multiregion: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "CA-7", "Continuous Monitoring", 2),
];

const cloudtrail_no_log_validation: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("hipaa", "164.312(c)(1)", "Integrity", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "10.2", "Audit Log Content", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-6", "Audit Record Review", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

const cloudtrail_not_logging: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Incident Response", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("pcidss", "10.2", "Audit Log Content", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("dpdpa", "DPDPA-S8-5", "Breach Detection and Response", 3),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// ---------------------------------------------------------------------------
// KMS check types (2)
// ---------------------------------------------------------------------------

const kms_key_pending_deletion: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "A1.1", "System Availability", 2),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
  m("nist80053", "CP-9", "System Backup", 2),
];

const kms_rotation_disabled: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
  m("nist80053", "SI-2", "Flaw Remediation", 3),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): Lambda check types (4)
// New SDK-backed Lambda auditor checks. Mapped to the same control families the
// analogous IAM/encryption/network checks above already use.
// ---------------------------------------------------------------------------

const lambda_deprecated_runtime: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.8", "Management of Technical Vulnerabilities", 3),
  m("hipaa", "164.308(a)(5)(ii)(B)", "Protection from Malicious Software", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.3.3", "Security Patch Installation", 3),
  m("dpdpa", "DPDPA-S8-6", "Patch and Vulnerability Management", 2),
  m("nist80053", "SI-2", "Flaw Remediation", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

const lambda_excessive_timeout: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 1),
  m("iso27001", "A.8.9", "Configuration Management", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 1),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "6.3", "Secure System Development", 1),
  m("dpdpa", "DPDPA-S8-6", "Patch and Vulnerability Management", 1),
  m("nist80053", "CM-6", "Configuration Settings", 2),
  m("nist80053", "SA-8", "Security Engineering Principles", 1),
];

const lambda_no_vpc: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("iso27001", "A.8.22", "Segregation of Networks", 2),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.2", "Network Security Configuration", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 2),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

const lambda_env_secrets: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("iso27001", "A.5.17", "Authentication Information", 3),
  m("hipaa", "164.312(a)(2)(iv)", "Encryption and Decryption", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 3),
  m("nist80053", "IA-5", "Authenticator Management", 3),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): ECS / ECR / EKS check types (5)
// Container workload checks from the ECS/ECR/EKS auditor. Privileged container
// and plaintext-secret checks map to access/crypto controls; image scanning to
// vulnerability management; EKS logging/endpoint to logging + network controls.
// ---------------------------------------------------------------------------

const ecs_task_privileged_container: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "2.2", "System Component Configuration", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-6", "Least Privilege", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

const ecs_task_plaintext_secret: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("iso27001", "A.5.17", "Authentication Information", 3),
  m("hipaa", "164.312(a)(2)(iv)", "Encryption and Decryption", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 3),
  m("nist80053", "IA-5", "Authenticator Management", 3),
];

const ecr_scan_on_push_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.8", "Management of Technical Vulnerabilities", 3),
  m("hipaa", "164.308(a)(5)(ii)(B)", "Protection from Malicious Software", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.3.1", "Security Vulnerability Identification", 3),
  m("pcidss", "11.3", "Vulnerability Scanning", 2),
  m("dpdpa", "DPDPA-S8-6", "Patch and Vulnerability Management", 3),
  m("nist80053", "RA-5", "Vulnerability Monitoring and Scanning", 3),
  m("nist80053", "SI-2", "Flaw Remediation", 2),
];

const eks_control_plane_logging_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Incident Response", 2),
  m("iso27001", "A.8.15", "Logging", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Content", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 3),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

const eks_endpoint_public_access: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.2", "Network Security Configuration", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): SQS / SNS check types (4)
// Messaging checks. Encryption maps to cryptography/at-rest controls, public
// access to access/boundary controls, missing DLQ to availability/recovery.
// ---------------------------------------------------------------------------

const sqs_queue_no_encryption: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(2)(iv)", "Encryption and Decryption", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const sqs_queue_no_dlq: ControlMappingEntry[] = [
  m("soc2", "A1.2", "Recovery Procedures", 2),
  m("soc2", "CC7.1", "Monitoring and Detection", 1),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("iso27001", "A.5.30", "ICT Readiness for Business Continuity", 2),
  m("hipaa", "164.312(c)(1)", "Integrity", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 1),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "CP-9", "System Backup", 2),
  m("nist80053", "SI-4", "System Monitoring", 1),
];

const sns_topic_no_encryption: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(2)(iv)", "Encryption and Decryption", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const sns_topic_public_access: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): Secrets Manager check types (3)
// Secret hygiene checks. Broad principal maps to access controls, rotation
// gaps to credential management + cryptographic key rotation controls.
// ---------------------------------------------------------------------------

const secretsmanager_policy_broad_principal: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "AC-6", "Least Privilege", 3),
];

const secretsmanager_rotation_disabled: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.5.17", "Authentication Information", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 2),
  m("hipaa", "164.308(a)(5)(ii)(D)", "Password Management", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.3.9", "Password Change Frequency", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 2),
  m("nist80053", "IA-5", "Authenticator Management", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const secretsmanager_rotation_interval_too_long: ControlMappingEntry[] = [
  m("soc2", "CC6.3", "Credential Management", 2),
  m("iso27001", "A.5.17", "Authentication Information", 2),
  m("hipaa", "164.308(a)(5)(ii)(D)", "Password Management", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "8.3.9", "Password Change Frequency", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 1),
  m("nist80053", "IA-5", "Authenticator Management", 2),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): GuardDuty check types (5)
// Threat-detection coverage checks. All map to monitoring/detection and
// incident-response controls; specific protections add malicious-software /
// breach-detection coverage.
// ---------------------------------------------------------------------------

const guardduty_not_enabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Incident Response", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 3),
  m("iso27001", "A.5.7", "Threat Intelligence", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 3),
  m("hipaa", "164.308(a)(6)(ii)", "Response and Reporting", 3),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 3),
  m("pcidss", "11.5", "Intrusion Detection", 3),
  m("dpdpa", "DPDPA-S8-5", "Breach Detection and Response", 3),
  m("nist80053", "SI-4", "System Monitoring", 3),
  m("nist80053", "IR-4", "Incident Handling", 2),
];

const guardduty_detector_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Incident Response", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 3),
  m("iso27001", "A.5.7", "Threat Intelligence", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 3),
  m("hipaa", "164.308(a)(6)(ii)", "Response and Reporting", 3),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 3),
  m("pcidss", "11.5", "Intrusion Detection", 3),
  m("dpdpa", "DPDPA-S8-5", "Breach Detection and Response", 3),
  m("nist80053", "SI-4", "System Monitoring", 3),
  m("nist80053", "IR-4", "Incident Handling", 2),
];

const guardduty_s3_protection_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("iso27001", "A.5.7", "Threat Intelligence", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 2),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 2),
  m("pcidss", "11.5", "Intrusion Detection", 2),
  m("dpdpa", "DPDPA-S8-5", "Breach Detection and Response", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
  m("nist80053", "RA-5", "Vulnerability Monitoring and Scanning", 1),
];

const guardduty_eks_protection_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("iso27001", "A.5.7", "Threat Intelligence", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 2),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 2),
  m("pcidss", "11.5", "Intrusion Detection", 2),
  m("dpdpa", "DPDPA-S8-5", "Breach Detection and Response", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
  m("nist80053", "RA-5", "Vulnerability Monitoring and Scanning", 1),
];

const guardduty_malware_protection_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.7", "Protection Against Malware", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.308(a)(5)(ii)(B)", "Protection from Malicious Software", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "5.2", "Anti-Malware Deployment", 3),
  m("dpdpa", "DPDPA-S8-5", "Breach Detection and Response", 2),
  m("nist80053", "SI-3", "Malicious Code Protection", 3),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): WAF check types (3)
// WAFv2 web ACL checks. Managed-rule and rate-based gaps map to boundary +
// web-service protection; logging gaps to logging/monitoring controls.
// ---------------------------------------------------------------------------

const waf_no_managed_rules: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("iso27001", "A.8.21", "Web Services Security", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.4.2", "Web Application Firewall", 3),
  m("pcidss", "1.1", "Network Security Controls", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 2),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "SI-3", "Malicious Code Protection", 2),
];

const waf_no_rate_based_rule: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 2),
  m("soc2", "A1.1", "System Availability", 2),
  m("iso27001", "A.8.20", "Networks Security", 2),
  m("iso27001", "A.8.21", "Web Services Security", 2),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 1),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "6.4.2", "Web Application Firewall", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 1),
  m("nist80053", "SC-5", "Denial-of-Service Protection", 3),
  m("nist80053", "SC-7", "Boundary Protection", 2),
];

const waf_logging_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Content", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 3),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): AWS Config check types (5)
// Config recorder / delivery-channel / rule checks. Recorder + delivery-channel
// gaps map to logging/monitoring + change-management; non-compliant rules to
// continuous monitoring + configuration-management controls.
// ---------------------------------------------------------------------------

const config_delivery_channel_missing: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "CM-8", "System Component Inventory", 2),
];

const config_recorder_missing: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC8.1", "Change Management", 2),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "CA-7", "Continuous Monitoring", 3),
  m("nist80053", "CM-8", "System Component Inventory", 2),
];

const config_recorder_not_recording: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC8.1", "Change Management", 2),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "CA-7", "Continuous Monitoring", 3),
  m("nist80053", "AU-2", "Event Logging", 2),
];

const config_recorder_incomplete_coverage: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("soc2", "CC8.1", "Change Management", 2),
  m("iso27001", "A.8.9", "Configuration Management", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 2),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 1),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 1),
  m("nist80053", "CA-7", "Continuous Monitoring", 2),
  m("nist80053", "CM-8", "System Component Inventory", 2),
];

const config_rule_non_compliant: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("soc2", "CC8.1", "Change Management", 2),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("iso27001", "A.5.36", "Compliance with Policies for Information Security", 2),
  m("hipaa", "164.308(a)(8)", "Evaluation", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "2.2", "System Component Configuration", 2),
  m("dpdpa", "DPDPA-S8-6", "Patch and Vulnerability Management", 1),
  m("nist80053", "CM-6", "Configuration Settings", 3),
  m("nist80053", "CA-7", "Continuous Monitoring", 2),
];

// ---------------------------------------------------------------------------
// Master lookup table
// ---------------------------------------------------------------------------

export const AWS_COMPLIANCE_MAP: Record<string, ControlMappingEntry[]> = {
  // IAM (5)
  iam_user_no_mfa,
  iam_console_and_access_keys,
  iam_root_access_keys,
  iam_weak_password_policy,
  iam_wildcard_policy,
  // S3 (4)
  s3_public_access,
  s3_no_encryption,
  s3_no_versioning,
  s3_no_logging,
  // EC2/VPC (3)
  ec2_sg_open_ssh,
  ec2_sg_unrestricted_egress,
  ec2_unencrypted_ebs,
  // CloudTrail (4)
  cloudtrail_no_trails,
  cloudtrail_not_multiregion,
  cloudtrail_no_log_validation,
  cloudtrail_not_logging,
  // KMS (2)
  kms_key_pending_deletion,
  kms_rotation_disabled,
  // REAL IMPL (BLACKFYRE 2026-06): Lambda (4)
  lambda_deprecated_runtime,
  lambda_excessive_timeout,
  lambda_no_vpc,
  lambda_env_secrets,
  // REAL IMPL (BLACKFYRE 2026-06): ECS/ECR/EKS (5)
  ecs_task_privileged_container,
  ecs_task_plaintext_secret,
  ecr_scan_on_push_disabled,
  eks_control_plane_logging_disabled,
  eks_endpoint_public_access,
  // REAL IMPL (BLACKFYRE 2026-06): SQS/SNS (4)
  sqs_queue_no_encryption,
  sqs_queue_no_dlq,
  sns_topic_no_encryption,
  sns_topic_public_access,
  // REAL IMPL (BLACKFYRE 2026-06): Secrets Manager (3)
  secretsmanager_policy_broad_principal,
  secretsmanager_rotation_disabled,
  secretsmanager_rotation_interval_too_long,
  // REAL IMPL (BLACKFYRE 2026-06): GuardDuty (5)
  guardduty_not_enabled,
  guardduty_detector_disabled,
  guardduty_s3_protection_disabled,
  guardduty_eks_protection_disabled,
  guardduty_malware_protection_disabled,
  // REAL IMPL (BLACKFYRE 2026-06): WAF (3)
  waf_no_managed_rules,
  waf_no_rate_based_rule,
  waf_logging_disabled,
  // REAL IMPL (BLACKFYRE 2026-06): AWS Config (5)
  config_delivery_channel_missing,
  config_recorder_missing,
  config_recorder_not_recording,
  config_recorder_incomplete_coverage,
  config_rule_non_compliant,
};

// REAL IMPL (BLACKFYRE 2026-06): grew from 18 to 47 AWS check types after wiring
// the RDS/Lambda/ECS-ECR-EKS/SQS-SNS/Secrets-Manager/GuardDuty/WAF/Config auditors.
// (RDS reuses the existing s3_*/kms_* check types, so it adds no new keys here.)
/** All 47 known AWS check type identifiers. */
export const KNOWN_AWS_CHECK_TYPES: string[] = Object.keys(AWS_COMPLIANCE_MAP);
