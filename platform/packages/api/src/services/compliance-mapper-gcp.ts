/**
 * GCP Compliance Mapper — Maps GCP check types to compliance control mappings
 * across all 6 frameworks (SOC2, ISO27001, HIPAA, GDPR, PCI-DSS, DPDPA).
 *
 * 27 GCP security checks across IAM (4), Storage (4), Compute (4),
 * Network/Logging (3), KMS (3), Cloud SQL (4), GKE (4), and Security
 * Command Center (1) categories.
 *
 * REAL IMPL (BLACKFYRE 2026-06): Cloud SQL, GKE, and Security Command Center
 * check types added for the Wave 1 auditors (cloud-sql-auditor.ts,
 * gke-auditor.ts, security-command-center-auditor.ts).
 */

import { m, type ControlMappingEntry } from "./compliance-mapper-aws.js";

// ---------------------------------------------------------------------------
// IAM check types (4)
// ---------------------------------------------------------------------------

const gcp_sa_key_not_rotated: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "IA-5", "Authenticator Management", 2),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const gcp_sa_admin_key: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
];

const gcp_iam_primitive_role: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
];

const gcp_iam_allUsers_binding: ControlMappingEntry[] = [
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

// ---------------------------------------------------------------------------
// Storage check types (4)
// ---------------------------------------------------------------------------

const gcp_bucket_public_access: ControlMappingEntry[] = [
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

const gcp_bucket_no_uniform_access: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(1)", "Data Protection by Design", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

const gcp_bucket_no_versioning: ControlMappingEntry[] = [
  m("soc2", "A1.2", "Recovery Procedures", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(c)(1)", "Integrity", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "CP-9", "System Backup", 2),
];

const gcp_bucket_no_cmek: ControlMappingEntry[] = [
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
// Compute check types (4)
// ---------------------------------------------------------------------------

const gcp_fw_ssh_from_any: ControlMappingEntry[] = [
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

const gcp_fw_rdp_from_any: ControlMappingEntry[] = [
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

const gcp_vm_serial_port: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.6", "Capacity Management", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.3", "Security Vulnerabilities Identification", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
  m("nist80053", "RA-5", "Vulnerability Monitoring", 3),
];

const gcp_disk_not_encrypted_cmek: ControlMappingEntry[] = [
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
// Network/Logging check types (3)
// ---------------------------------------------------------------------------

const gcp_vpc_no_flow_logs: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

const gcp_no_audit_log_config: ControlMappingEntry[] = [
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
  m("nist80053", "AU-6", "Audit Record Review", 2),
  m("nist80053", "CA-7", "Continuous Monitoring", 2),
];

const gcp_fw_all_ingress: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
];

// ---------------------------------------------------------------------------
// KMS check types (3)
// ---------------------------------------------------------------------------

const gcp_kms_no_rotation: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const gcp_kms_public_iam: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const gcp_kms_destroyed_key: ControlMappingEntry[] = [
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

// ---------------------------------------------------------------------------
// Cloud SQL check types (4)
// REAL IMPL (BLACKFYRE 2026-06): control mappings for the new Cloud SQL auditor
// (agents/gcp/cloud-sql-auditor.ts). SSL-in-transit mirrors the encryption-style
// entries (gcp_bucket_no_cmek / gcp_disk_not_encrypted_cmek) but targets data in
// transit (CC6.7 + SC-8); 0.0.0.0/0 authorized network and public IP mirror the
// network-exposure entries (gcp_iam_allUsers_binding / gcp_fw_all_ingress); and
// disabled automated backups mirror the availability/backup entries
// (gcp_bucket_no_versioning / gcp_kms_destroyed_key).
// ---------------------------------------------------------------------------

const gcp_sql_ssl_not_required: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "4.1", "Strong Cryptography in Transit", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-8", "Transmission Confidentiality and Integrity", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const gcp_sql_authorized_network_any: ControlMappingEntry[] = [
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

const gcp_sql_public_ip: ControlMappingEntry[] = [
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

const gcp_sql_backups_disabled: ControlMappingEntry[] = [
  m("soc2", "A1.2", "Recovery Procedures", 2),
  m("iso27001", "A.8.13", "Information Backup", 2),
  m("hipaa", "164.308(a)(7)(ii)(A)", "Data Backup Plan", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "CP-9", "System Backup", 2),
];

// ---------------------------------------------------------------------------
// GKE check types (4)
// REAL IMPL (BLACKFYRE 2026-06): control mappings for the new GKE auditor
// (agents/gcp/gke-auditor.ts). Legacy ABAC (RBAC bypass) mirrors the access-
// control / least-privilege entries (gcp_iam_primitive_role); no network policy
// (pod lateral movement) and non-private cluster (public node exposure) mirror
// the network-boundary entries (gcp_fw_all_ingress / gcp_iam_allUsers_binding);
// and disabled Shielded GKE Nodes (node integrity / secure boot) mirrors the
// configuration-hardening entries (gcp_vm_serial_port) plus system integrity.
// ---------------------------------------------------------------------------

const gcp_gke_legacy_abac_enabled: ControlMappingEntry[] = [
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

const gcp_gke_no_network_policy: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("iso27001", "A.8.22", "Segregation of Networks", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("pcidss", "1.2", "Network Security Configuration", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "AC-4", "Information Flow Enforcement", 2),
];

const gcp_gke_not_private_cluster: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

const gcp_gke_shielded_nodes_disabled: ControlMappingEntry[] = [
  m("soc2", "CC6.8", "Unauthorized Software Prevention", 3),
  m("iso27001", "A.8.7", "Protection Against Malware", 2),
  m("hipaa", "164.312(c)(1)", "Integrity", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.3", "Security Vulnerabilities Identification", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SI-7", "Software, Firmware, and Information Integrity", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

// ---------------------------------------------------------------------------
// Security Command Center check types (1)
// REAL IMPL (BLACKFYRE 2026-06): control mapping for the new Security Command
// Center auditor (agents/gcp/security-command-center-auditor.ts). An active SCC
// detector finding is a monitoring/detection signal, so this mirrors the
// monitoring entries (gcp_no_audit_log_config) — continuous monitoring,
// incident response, and vulnerability monitoring controls.
// ---------------------------------------------------------------------------

const gcp_scc_active_finding: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Incident Response", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 3),
  m("iso27001", "A.5.7", "Threat Intelligence", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.3", "Security Vulnerabilities Identification", 3),
  m("pcidss", "10.6", "Audit Log Review", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "SI-4", "System Monitoring", 3),
  m("nist80053", "RA-5", "Vulnerability Monitoring", 3),
  m("nist80053", "CA-7", "Continuous Monitoring", 2),
];

// ---------------------------------------------------------------------------
// Master lookup table
// ---------------------------------------------------------------------------

export const GCP_COMPLIANCE_MAP: Record<string, ControlMappingEntry[]> = {
  // IAM (4)
  gcp_sa_key_not_rotated,
  gcp_sa_admin_key,
  gcp_iam_primitive_role,
  gcp_iam_allUsers_binding,
  // Storage (4)
  gcp_bucket_public_access,
  gcp_bucket_no_uniform_access,
  gcp_bucket_no_versioning,
  gcp_bucket_no_cmek,
  // Compute (4)
  gcp_fw_ssh_from_any,
  gcp_fw_rdp_from_any,
  gcp_vm_serial_port,
  gcp_disk_not_encrypted_cmek,
  // Network/Logging (3)
  gcp_vpc_no_flow_logs,
  gcp_no_audit_log_config,
  gcp_fw_all_ingress,
  // KMS (3)
  gcp_kms_no_rotation,
  gcp_kms_public_iam,
  gcp_kms_destroyed_key,
  // REAL IMPL (BLACKFYRE 2026-06): Wave 1 auditor check types.
  // Cloud SQL (4)
  gcp_sql_ssl_not_required,
  gcp_sql_authorized_network_any,
  gcp_sql_public_ip,
  gcp_sql_backups_disabled,
  // GKE (4)
  gcp_gke_legacy_abac_enabled,
  gcp_gke_no_network_policy,
  gcp_gke_not_private_cluster,
  gcp_gke_shielded_nodes_disabled,
  // Security Command Center (1)
  gcp_scc_active_finding,
};

/** All known GCP check type identifiers. */
export const KNOWN_GCP_CHECK_TYPES: string[] = Object.keys(GCP_COMPLIANCE_MAP);
