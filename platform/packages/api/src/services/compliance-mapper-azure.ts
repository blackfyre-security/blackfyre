/**
 * Azure Compliance Mapper — Maps Azure check types to compliance control mappings
 * across all 6 frameworks (SOC2, ISO27001, HIPAA, GDPR, PCI-DSS, DPDPA) plus
 * NIST 800-53.
 *
 * 48 Azure security checks across IAM (4), Storage (4), Compute (3),
 * Network (4), Key Vault (3), AKS (3), App Service (4), SQL (4),
 * Defender for Cloud (6), Azure Monitor (10), and Azure Policy (3) categories.
 *
 * REAL IMPL (BLACKFYRE 2026-06): added the 30 Wave-1 check types emitted by the
 * new azure/{aks,app-service,sql,defender,monitor,policy}-auditor.ts agents.
 */

import { m, type ControlMappingEntry } from "./compliance-mapper-aws.js";

// ---------------------------------------------------------------------------
// IAM check types (4)
// ---------------------------------------------------------------------------

const azure_rbac_owner_count: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(2)", "Data Protection by Default", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
];

const azure_rbac_custom_no_scope: ControlMappingEntry[] = [
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

const azure_classic_admin: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "CM-8", "System Component Inventory", 2),
];

const azure_guest_users_with_roles: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.2", "User Authentication", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.5", "Secure Authentication", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("hipaa", "164.312(d)", "Person or Entity Authentication", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "IA-2", "Identification and Authentication", 3),
];

// ---------------------------------------------------------------------------
// Storage check types (4)
// ---------------------------------------------------------------------------

const azure_storage_no_https: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "4.1", "Transmission Encryption", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-8", "Transmission Confidentiality", 2),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
];

const azure_storage_public_blob: ControlMappingEntry[] = [
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

const azure_storage_no_encryption: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const azure_storage_no_soft_delete: ControlMappingEntry[] = [
  m("soc2", "A1.2", "Recovery Procedures", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(c)(1)", "Integrity", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "CP-9", "System Backup", 2),
];

// ---------------------------------------------------------------------------
// Compute check types (3)
// ---------------------------------------------------------------------------

const azure_vm_unencrypted_disk: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const azure_vm_no_managed_disk: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.8.6", "Capacity Management", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.3", "Security Vulnerabilities Identification", 3),
  m("dpdpa", "DPDPA-S8-4", "Data Continuity and Backup", 2),
  m("nist80053", "CM-8", "System Component Inventory", 2),
  m("nist80053", "RA-5", "Vulnerability Monitoring", 3),
];

const azure_vm_public_ip: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "CM-6", "Configuration Settings", 2),
];

// ---------------------------------------------------------------------------
// Network check types (4)
// ---------------------------------------------------------------------------

const azure_nsg_ssh_from_any: ControlMappingEntry[] = [
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

const azure_nsg_rdp_from_any: ControlMappingEntry[] = [
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

const azure_nsg_all_inbound: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
];

const azure_nsg_no_flow_logs: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.1", "Audit Trail Implementation", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// ---------------------------------------------------------------------------
// Key Vault check types (3)
// ---------------------------------------------------------------------------

const azure_kv_no_soft_delete: ControlMappingEntry[] = [
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

const azure_kv_no_purge_protection: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "A1.1", "System Availability", 2),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

const azure_kv_rbac_not_enabled: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.25(1)", "Data Protection by Design", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
];

// ---------------------------------------------------------------------------
// AKS check types (3) — REAL IMPL (BLACKFYRE 2026-06): emitted by
// agents/azure/aks-auditor.ts (Kubernetes RBAC, network policy, AAD integration).
// ---------------------------------------------------------------------------

// Kubernetes RBAC disabled — in-cluster authorization is the access-control
// mechanism for the cluster API, so this maps like the other access-control
// checks (azure_kv_rbac_not_enabled / azure_rbac_*).
const azure_aks_rbac_not_enabled: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.3", "Access Restriction", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-3", "Access Enforcement", 3),
  m("nist80053", "AC-6", "Least Privilege", 2),
];

// No network policy — pod-to-pod segmentation; maps like the NSG network checks.
const azure_aks_no_network_policy: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("iso27001", "A.8.22", "Segregation of Networks", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("pcidss", "1.2", "Network Security Configuration", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "SC-32", "System Partitioning", 2),
];

// No Azure AD integration — central authentication; maps like the guest-user /
// authentication checks (azure_guest_users_with_roles / azure_sql_no_aad_admin).
const azure_aks_aad_not_integrated: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.2", "User Authentication", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.5", "Secure Authentication", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("hipaa", "164.312(d)", "Person or Entity Authentication", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "IA-2", "Identification and Authentication", 3),
];

// ---------------------------------------------------------------------------
// App Service check types (4) — REAL IMPL (BLACKFYRE 2026-06): emitted by
// agents/azure/app-service-auditor.ts (HTTPS-only, TLS floor, managed identity,
// remote debugging).
// ---------------------------------------------------------------------------

// HTTPS not enforced — transmission protection; maps like azure_storage_no_https.
const azure_app_service_no_https: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "4.1", "Transmission Encryption", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-8", "Transmission Confidentiality", 2),
  m("nist80053", "SC-23", "Session Authenticity", 2),
];

// TLS below 1.2 — weak transport crypto; maps like the transmission/crypto checks.
const azure_app_service_weak_tls: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
  m("hipaa", "164.312(e)(2)(ii)", "Encryption", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "4.1", "Transmission Encryption", 3),
  m("pcidss", "4.2.1", "Strong Cryptography for Transmission", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-8", "Transmission Confidentiality", 2),
  m("nist80053", "SC-13", "Cryptographic Protection", 3),
];

// No managed identity — secrets/credential management; maps like the IAM /
// credential-management checks.
const azure_app_service_no_managed_identity: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.3", "Credential Management", 3),
  m("iso27001", "A.5.16", "Identity Management", 3),
  m("iso27001", "A.5.17", "Authentication Information", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "8.6", "Application and System Account Management", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 2),
  m("nist80053", "IA-5", "Authenticator Management", 3),
  m("nist80053", "AC-3", "Access Enforcement", 2),
];

// Remote debugging enabled — insecure config / extra management surface; maps
// like the configuration-setting checks (azure_vm_public_ip / azure_nsg_*).
const azure_app_service_remote_debugging: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.8", "Unauthorized Software Prevention", 2),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("iso27001", "A.8.31", "Separation of Development and Production", 2),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "6.4.1", "Separate Development and Production Environments", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 2),
  m("nist80053", "CM-6", "Configuration Settings", 3),
  m("nist80053", "CM-7", "Least Functionality", 2),
];

// ---------------------------------------------------------------------------
// SQL check types (4) — REAL IMPL (BLACKFYRE 2026-06): emitted by
// agents/azure/sql-auditor.ts (server auditing, AAD admin, firewall, TDE).
// ---------------------------------------------------------------------------

// Server auditing disabled — audit trail; maps like the logging checks
// (azure_nsg_no_flow_logs / azure_monitor_*).
const azure_sql_auditing_not_enabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Security Event Monitoring", 2),
  m("iso27001", "A.8.15", "Logging", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Events", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 3),
  m("nist80053", "AU-2", "Event Logging", 3),
  m("nist80053", "AU-12", "Audit Record Generation", 2),
];

// No Azure AD admin — central authentication; maps like azure_aks_aad_not_integrated.
const azure_sql_no_aad_admin: ControlMappingEntry[] = [
  m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
  m("soc2", "CC6.2", "User Authentication", 3),
  m("iso27001", "A.5.15", "Access Control Policy", 3),
  m("iso27001", "A.8.5", "Secure Authentication", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("hipaa", "164.312(d)", "Person or Entity Authentication", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "7.1", "Access Restriction to System Components", 3),
  m("pcidss", "8.3.1", "Multi-Factor Authentication", 2),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "AC-2", "Account Management", 3),
  m("nist80053", "IA-2", "Identification and Authentication", 3),
];

// Firewall allows all — exposed network boundary; maps like azure_nsg_all_inbound.
const azure_sql_firewall_allow_all: ControlMappingEntry[] = [
  m("soc2", "CC6.6", "Network Security Boundaries", 3),
  m("iso27001", "A.8.20", "Networks Security", 3),
  m("hipaa", "164.312(a)(1)", "Access Control", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "1.1", "Network Security Controls", 3),
  m("pcidss", "1.2", "Network Security Configuration", 3),
  m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  m("nist80053", "SC-7", "Boundary Protection", 3),
  m("nist80053", "AC-4", "Information Flow Enforcement", 2),
];

// TDE disabled — encryption at rest; maps like azure_storage_no_encryption /
// azure_vm_unencrypted_disk.
const azure_sql_tde_not_enabled: ControlMappingEntry[] = [
  m("soc2", "CC6.7", "Data Transmission Protection", 3),
  m("iso27001", "A.8.24", "Use of Cryptography", 3),
  m("hipaa", "164.312(a)(2)(iv)", "Encryption and Decryption", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "3.5", "Primary Account Number Protection", 3),
  m("dpdpa", "DPDPA-S8-1", "Encryption of Personal Data", 3),
  m("nist80053", "SC-28", "Protection of Information at Rest", 3),
  m("nist80053", "SC-12", "Cryptographic Key Management", 2),
];

// ---------------------------------------------------------------------------
// Defender for Cloud check types (6) — REAL IMPL (BLACKFYRE 2026-06): emitted by
// agents/azure/defender-auditor.ts (pricing plans, auto-provisioning, security
// contacts). These are threat-detection / monitoring posture controls.
// ---------------------------------------------------------------------------

// Defender wholly disabled (default plan on Free tier) — no threat protection.
const azure_defender_not_enabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Security Event Monitoring", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 3),
  m("iso27001", "A.8.7", "Protection Against Malware", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 3),
  m("hipaa", "164.308(a)(6)(ii)", "Response and Reporting", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "11.5", "Intrusion Detection", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 3),
  m("nist80053", "SI-4", "System Monitoring", 3),
  m("nist80053", "RA-5", "Vulnerability Monitoring", 2),
];

// An individual Defender plan on Free tier — that resource class is unprotected.
const azure_defender_plan_free_tier: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("soc2", "CC7.2", "Security Event Monitoring", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 3),
  m("iso27001", "A.8.8", "Management of Technical Vulnerabilities", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 3),
  m("gdpr", "Art.32(1)", "Security of Processing", 3),
  m("pcidss", "11.5", "Intrusion Detection", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "SI-4", "System Monitoring", 3),
  m("nist80053", "RA-5", "Vulnerability Monitoring", 2),
];

// Auto-provisioning off — new VMs not onboarded for monitoring telemetry.
const azure_defender_auto_provisioning_off: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "10.7", "Detection of Failures in Critical Controls", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
  m("nist80053", "CM-8", "System Component Inventory", 2),
];

// Security contact has no email — alerts have no recipient.
const azure_defender_security_contact_no_email: ControlMappingEntry[] = [
  m("soc2", "CC7.3", "Security Incident Evaluation", 2),
  m("soc2", "CC7.4", "Incident Response Program", 2),
  m("iso27001", "A.5.24", "Incident Management Planning", 2),
  m("iso27001", "A.6.8", "Information Security Event Reporting", 2),
  m("hipaa", "164.308(a)(6)(ii)", "Response and Reporting", 3),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 2),
  m("pcidss", "12.10.1", "Incident Response Plan", 2),
  m("dpdpa", "DPDPA-S8-5", "Breach Notification Readiness", 2),
  m("nist80053", "IR-6", "Incident Reporting", 3),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// Security contact not set to receive alert notifications — alerts not delivered.
const azure_defender_alert_notifications_off: ControlMappingEntry[] = [
  m("soc2", "CC7.3", "Security Incident Evaluation", 2),
  m("soc2", "CC7.4", "Incident Response Program", 2),
  m("iso27001", "A.5.24", "Incident Management Planning", 2),
  m("iso27001", "A.6.8", "Information Security Event Reporting", 2),
  m("hipaa", "164.308(a)(6)(ii)", "Response and Reporting", 2),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 2),
  m("pcidss", "12.10.5", "Security Alert Monitoring", 2),
  m("dpdpa", "DPDPA-S8-5", "Breach Notification Readiness", 2),
  m("nist80053", "IR-6", "Incident Reporting", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// No security contact at all — alerts go nowhere.
const azure_defender_no_security_contact: ControlMappingEntry[] = [
  m("soc2", "CC7.3", "Security Incident Evaluation", 3),
  m("soc2", "CC7.4", "Incident Response Program", 3),
  m("iso27001", "A.5.24", "Incident Management Planning", 3),
  m("iso27001", "A.6.8", "Information Security Event Reporting", 2),
  m("hipaa", "164.308(a)(6)(i)", "Security Incident Procedures", 3),
  m("hipaa", "164.308(a)(6)(ii)", "Response and Reporting", 3),
  m("gdpr", "Art.33", "Notification of a Personal Data Breach", 3),
  m("pcidss", "12.10.1", "Incident Response Plan", 3),
  m("dpdpa", "DPDPA-S8-5", "Breach Notification Readiness", 3),
  m("nist80053", "IR-6", "Incident Reporting", 3),
  m("nist80053", "IR-4", "Incident Handling", 2),
];

// ---------------------------------------------------------------------------
// Azure Monitor check types (10) — REAL IMPL (BLACKFYRE 2026-06): emitted by
// agents/azure/monitor-auditor.ts (Activity Log diagnostic settings, log
// profiles, activity log alerts). These are logging / monitoring controls and
// map like the other logging checks (azure_nsg_no_flow_logs / azure_storage_no_soft_delete).
// ---------------------------------------------------------------------------

// No subscription diagnostic setting — Activity Log not exported anywhere.
const azure_monitor_activity_log_no_diagnostic_setting: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 3),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Events", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 3),
  m("nist80053", "AU-2", "Event Logging", 3),
  m("nist80053", "AU-6", "Audit Record Review, Analysis, and Reporting", 2),
];

// Diagnostic setting with no destination — collects nothing.
const azure_monitor_diagnostic_setting_no_destination: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 3),
  m("iso27001", "A.8.15", "Logging", 3),
  m("hipaa", "164.312(b)", "Audit Controls", 3),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Events", 3),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 3),
  m("nist80053", "AU-2", "Event Logging", 3),
  m("nist80053", "AU-9", "Protection of Audit Information", 2),
];

// Diagnostic setting not linked to Log Analytics — not queryable/correlatable.
const azure_monitor_diagnostic_setting_no_log_analytics: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 2),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.6", "Audit Log Review", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-6", "Audit Record Review, Analysis, and Reporting", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
];

// All log categories disabled — setting forwards no content.
const azure_monitor_diagnostic_setting_no_categories_enabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 2),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.2", "Audit Log Events", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
  m("nist80053", "AU-12", "Audit Record Generation", 2),
];

// Log profile retention disabled — no guaranteed Activity Log retention.
const azure_monitor_log_profile_retention_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.15", "Logging", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 2),
  m("hipaa", "164.316(b)(2)(i)", "Retention Period", 2),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.5.1", "Audit Log Retention", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-11", "Audit Record Retention", 2),
  m("nist80053", "AU-4", "Audit Log Storage Capacity", 1),
];

// Log profile retention below 365 days — short retention.
const azure_monitor_log_profile_short_retention: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 1),
  m("iso27001", "A.8.15", "Logging", 1),
  m("hipaa", "164.316(b)(2)(i)", "Retention Period", 2),
  m("gdpr", "Art.30", "Records of Processing Activities", 1),
  m("pcidss", "10.5.1", "Audit Log Retention", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 1),
  m("nist80053", "AU-11", "Audit Record Retention", 2),
];

// Log profile omits the "global" pseudo-region — misses global control-plane events.
const azure_monitor_log_profile_missing_global: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 1),
  m("iso27001", "A.8.15", "Logging", 1),
  m("hipaa", "164.312(b)", "Audit Controls", 1),
  m("gdpr", "Art.30", "Records of Processing Activities", 1),
  m("pcidss", "10.2", "Audit Log Events", 1),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 1),
  m("nist80053", "AU-2", "Event Logging", 1),
];

// No log profile at all — no managed Activity Log retention/streaming.
const azure_monitor_no_log_profile: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.8.15", "Logging", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.312(b)", "Audit Controls", 2),
  m("gdpr", "Art.30", "Records of Processing Activities", 2),
  m("pcidss", "10.5.1", "Audit Log Retention", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "AU-11", "Audit Record Retention", 2),
  m("nist80053", "AU-2", "Event Logging", 2),
];

// Activity Log alert rule disabled — configured but inert.
const azure_monitor_activity_log_alert_disabled: ControlMappingEntry[] = [
  m("soc2", "CC7.2", "Security Event Monitoring", 1),
  m("iso27001", "A.8.16", "Monitoring Activities", 1),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 1),
  m("gdpr", "Art.32(1)", "Security of Processing", 1),
  m("pcidss", "10.7", "Detection of Failures in Critical Controls", 1),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 1),
  m("nist80053", "SI-4", "System Monitoring", 1),
  m("nist80053", "AU-6", "Audit Record Review, Analysis, and Reporting", 1),
];

// No Activity Log alerts at all — control-plane changes trigger no notifications.
const azure_monitor_no_activity_log_alerts: ControlMappingEntry[] = [
  m("soc2", "CC7.2", "Security Event Monitoring", 2),
  m("soc2", "CC7.3", "Security Incident Evaluation", 2),
  m("iso27001", "A.8.16", "Monitoring Activities", 2),
  m("hipaa", "164.308(a)(1)(ii)(D)", "Information System Activity Review", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "10.7", "Detection of Failures in Critical Controls", 2),
  m("dpdpa", "DPDPA-S8-3", "Audit Logging and Monitoring", 2),
  m("nist80053", "SI-4", "System Monitoring", 2),
  m("nist80053", "AU-6", "Audit Record Review, Analysis, and Reporting", 2),
];

// ---------------------------------------------------------------------------
// Azure Policy check types (3) — REAL IMPL (BLACKFYRE 2026-06): emitted by
// agents/azure/policy-auditor.ts (governance gap + per-assignment / per-resource
// non-compliance). These are configuration-governance controls.
// ---------------------------------------------------------------------------

// No policy assignments — subscription not governed by Azure Policy.
const azure_policy_no_assignments: ControlMappingEntry[] = [
  m("soc2", "CC1.4", "Commitment to Competence and Governance", 2),
  m("soc2", "CC4.1", "Monitoring of Controls", 2),
  m("iso27001", "A.5.36", "Compliance with Policies, Rules and Standards", 2),
  m("iso27001", "A.8.9", "Configuration Management", 2),
  m("hipaa", "164.308(a)(1)(i)", "Security Management Process", 2),
  m("gdpr", "Art.24", "Responsibility of the Controller", 2),
  m("pcidss", "2.2", "System Configuration Standards", 2),
  m("dpdpa", "DPDPA-S8-6", "Governance and Policy Enforcement", 2),
  m("nist80053", "CM-2", "Baseline Configuration", 2),
  m("nist80053", "CA-2", "Control Assessments", 2),
];

// Policy assignment with non-compliant resources — controls failing at scale.
const azure_policy_assignment_non_compliant: ControlMappingEntry[] = [
  m("soc2", "CC4.1", "Monitoring of Controls", 3),
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("iso27001", "A.5.36", "Compliance with Policies, Rules and Standards", 3),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("hipaa", "164.308(a)(1)(i)", "Security Management Process", 2),
  m("gdpr", "Art.24", "Responsibility of the Controller", 2),
  m("pcidss", "2.2", "System Configuration Standards", 3),
  m("dpdpa", "DPDPA-S8-6", "Governance and Policy Enforcement", 3),
  m("nist80053", "CM-6", "Configuration Settings", 3),
  m("nist80053", "CA-7", "Continuous Monitoring", 2),
];

// Individual resource non-compliant with policy — a specific control failure.
const azure_policy_resource_non_compliant: ControlMappingEntry[] = [
  m("soc2", "CC7.1", "Monitoring and Detection", 2),
  m("soc2", "CC8.1", "Change Management", 2),
  m("iso27001", "A.8.9", "Configuration Management", 3),
  m("iso27001", "A.5.36", "Compliance with Policies, Rules and Standards", 2),
  m("hipaa", "164.308(a)(1)(i)", "Security Management Process", 2),
  m("gdpr", "Art.32(1)", "Security of Processing", 2),
  m("pcidss", "2.2", "System Configuration Standards", 2),
  m("dpdpa", "DPDPA-S8-6", "Governance and Policy Enforcement", 2),
  m("nist80053", "CM-6", "Configuration Settings", 3),
  m("nist80053", "CM-2", "Baseline Configuration", 2),
];

// ---------------------------------------------------------------------------
// Master lookup table
// ---------------------------------------------------------------------------

export const AZURE_COMPLIANCE_MAP: Record<string, ControlMappingEntry[]> = {
  // IAM (4)
  azure_rbac_owner_count,
  azure_rbac_custom_no_scope,
  azure_classic_admin,
  azure_guest_users_with_roles,
  // Storage (4)
  azure_storage_no_https,
  azure_storage_public_blob,
  azure_storage_no_encryption,
  azure_storage_no_soft_delete,
  // Compute (3)
  azure_vm_unencrypted_disk,
  azure_vm_no_managed_disk,
  azure_vm_public_ip,
  // Network (4)
  azure_nsg_ssh_from_any,
  azure_nsg_rdp_from_any,
  azure_nsg_all_inbound,
  azure_nsg_no_flow_logs,
  // Key Vault (3)
  azure_kv_no_soft_delete,
  azure_kv_no_purge_protection,
  azure_kv_rbac_not_enabled,
  // AKS (3) — REAL IMPL (BLACKFYRE 2026-06)
  azure_aks_rbac_not_enabled,
  azure_aks_no_network_policy,
  azure_aks_aad_not_integrated,
  // App Service (4) — REAL IMPL (BLACKFYRE 2026-06)
  azure_app_service_no_https,
  azure_app_service_weak_tls,
  azure_app_service_no_managed_identity,
  azure_app_service_remote_debugging,
  // SQL (4) — REAL IMPL (BLACKFYRE 2026-06)
  azure_sql_auditing_not_enabled,
  azure_sql_no_aad_admin,
  azure_sql_firewall_allow_all,
  azure_sql_tde_not_enabled,
  // Defender for Cloud (6) — REAL IMPL (BLACKFYRE 2026-06)
  azure_defender_not_enabled,
  azure_defender_plan_free_tier,
  azure_defender_auto_provisioning_off,
  azure_defender_security_contact_no_email,
  azure_defender_alert_notifications_off,
  azure_defender_no_security_contact,
  // Azure Monitor (10) — REAL IMPL (BLACKFYRE 2026-06)
  azure_monitor_activity_log_no_diagnostic_setting,
  azure_monitor_diagnostic_setting_no_destination,
  azure_monitor_diagnostic_setting_no_log_analytics,
  azure_monitor_diagnostic_setting_no_categories_enabled,
  azure_monitor_log_profile_retention_disabled,
  azure_monitor_log_profile_short_retention,
  azure_monitor_log_profile_missing_global,
  azure_monitor_no_log_profile,
  azure_monitor_activity_log_alert_disabled,
  azure_monitor_no_activity_log_alerts,
  // Azure Policy (3) — REAL IMPL (BLACKFYRE 2026-06)
  azure_policy_no_assignments,
  azure_policy_assignment_non_compliant,
  azure_policy_resource_non_compliant,
};

/** All 48 known Azure check type identifiers. */
export const KNOWN_AZURE_CHECK_TYPES: string[] = Object.keys(AZURE_COMPLIANCE_MAP);
