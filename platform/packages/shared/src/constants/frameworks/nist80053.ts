/* ------------------------------------------------------------------ */
/*  NIST 800-53 Rev 5 — Security & Privacy Controls                    */
/* ------------------------------------------------------------------ */

export interface NIST80053Enhancement {
  id: string;
  title: string;
  description: string;
}

export interface NIST80053CrossMapping {
  framework: string;
  controlId: string;
  strength: "exact" | "strong" | "partial" | "weak";
}

export interface NIST80053Control {
  id: string;
  title: string;
  family: string;
  familyCode: string;
  description: string;
  baselines: { low: boolean; moderate: boolean; high: boolean };
  enhancements: NIST80053Enhancement[];
  crossMappings: NIST80053CrossMapping[];
}

export const NIST_CONTROL_FAMILIES: Array<{ code: string; name: string; controlCount: number }> = [
  { code: "AC", name: "Access Control", controlCount: 25 },
  { code: "AT", name: "Awareness and Training", controlCount: 6 },
  { code: "AU", name: "Audit and Accountability", controlCount: 16 },
  { code: "CA", name: "Assessment, Authorization, and Monitoring", controlCount: 9 },
  { code: "CM", name: "Configuration Management", controlCount: 14 },
  { code: "CP", name: "Contingency Planning", controlCount: 13 },
  { code: "IA", name: "Identification and Authentication", controlCount: 12 },
  { code: "IR", name: "Incident Response", controlCount: 10 },
  { code: "MA", name: "Maintenance", controlCount: 6 },
  { code: "MP", name: "Media Protection", controlCount: 8 },
  { code: "PE", name: "Physical and Environmental Protection", controlCount: 20 },
  { code: "PL", name: "Planning", controlCount: 4 },
  { code: "PM", name: "Program Management", controlCount: 16 },
  { code: "PS", name: "Personnel Security", controlCount: 9 },
  { code: "RA", name: "Risk Assessment", controlCount: 10 },
  { code: "SA", name: "System and Services Acquisition", controlCount: 23 },
  { code: "SC", name: "System and Communications Protection", controlCount: 44 },
  { code: "SI", name: "System and Information Integrity", controlCount: 23 },
  { code: "SR", name: "Supply Chain Risk Management", controlCount: 12 },
  { code: "PT", name: "PII Processing and Transparency", controlCount: 8 },
];

export const NIST_800_53_CONTROLS: NIST80053Control[] = [
  // AC — Access Control
  { id: "AC-1", title: "Policy and Procedures", family: "Access Control", familyCode: "AC", description: "Develop, document, and disseminate access control policy and procedures", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC6.1", strength: "strong" }, { framework: "iso27001", controlId: "A.9.1", strength: "strong" }, { framework: "hipaa", controlId: "164.312(a)", strength: "strong" }] },
  { id: "AC-2", title: "Account Management", family: "Access Control", familyCode: "AC", description: "Define and manage information system accounts including establishing, activating, modifying, reviewing, disabling, and removing accounts", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "AC-2(1)", title: "Automated System Account Management", description: "Employ automated mechanisms to support management of system accounts" }, { id: "AC-2(2)", title: "Automated Temporary and Emergency Account Management", description: "Automatically disable temporary and emergency accounts" }, { id: "AC-2(3)", title: "Disable Accounts", description: "Disable accounts when not required within time period" }, { id: "AC-2(4)", title: "Automated Audit Actions", description: "Automatically audit account creation, modification, enabling, disabling, and removal" }], crossMappings: [{ framework: "soc2", controlId: "CC6.2", strength: "exact" }, { framework: "iso27001", controlId: "A.9.2", strength: "exact" }] },
  { id: "AC-3", title: "Access Enforcement", family: "Access Control", familyCode: "AC", description: "Enforce approved authorizations for logical access to information and system resources", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "AC-3(7)", title: "Role-Based Access Control", description: "Enforce role-based access control policy" }], crossMappings: [{ framework: "soc2", controlId: "CC6.3", strength: "exact" }, { framework: "pcidss", controlId: "Req.8", strength: "strong" }] },
  { id: "AC-4", title: "Information Flow Enforcement", family: "Access Control", familyCode: "AC", description: "Enforce approved authorizations for controlling information flow", baselines: { low: false, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "pcidss", controlId: "Req.1", strength: "strong" }] },
  { id: "AC-5", title: "Separation of Duties", family: "Access Control", familyCode: "AC", description: "Separate duties of individuals to reduce risk of malevolent activity", baselines: { low: false, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC6.1", strength: "partial" }] },
  { id: "AC-6", title: "Least Privilege", family: "Access Control", familyCode: "AC", description: "Employ the principle of least privilege allowing only authorized accesses", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "AC-6(1)", title: "Authorize Access to Security Functions", description: "Authorize access to security-relevant functions explicitly" }, { id: "AC-6(2)", title: "Non-Privileged Access for Nonsecurity Functions", description: "Require users to use non-privileged accounts for nonsecurity functions" }], crossMappings: [{ framework: "soc2", controlId: "CC6.1", strength: "exact" }, { framework: "iso27001", controlId: "A.9.1", strength: "strong" }] },
  { id: "AC-7", title: "Unsuccessful Logon Attempts", family: "Access Control", familyCode: "AC", description: "Enforce a limit of consecutive invalid logon attempts", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "pcidss", controlId: "Req.8", strength: "strong" }] },
  { id: "AC-8", title: "System Use Notification", family: "Access Control", familyCode: "AC", description: "Display system use notification message before granting access", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [] },

  // AT — Awareness and Training
  { id: "AT-1", title: "Policy and Procedures", family: "Awareness and Training", familyCode: "AT", description: "Develop security awareness and training policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso27001", controlId: "A.9.1", strength: "weak" }] },
  { id: "AT-2", title: "Literacy Training and Awareness", family: "Awareness and Training", familyCode: "AT", description: "Provide security and privacy literacy training", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "AT-2(1)", title: "Practical Exercises", description: "Include practical exercises in security training" }, { id: "AT-2(2)", title: "Insider Threat", description: "Include insider threat awareness in training" }], crossMappings: [{ framework: "soc2", controlId: "CC1.1", strength: "partial" }] },
  { id: "AT-3", title: "Role-Based Training", family: "Awareness and Training", familyCode: "AT", description: "Provide role-based security and privacy training", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso42001", controlId: "7.2", strength: "strong" }] },

  // AU — Audit and Accountability
  { id: "AU-1", title: "Policy and Procedures", family: "Audit and Accountability", familyCode: "AU", description: "Develop audit and accountability policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "hipaa", controlId: "164.312(b)", strength: "strong" }] },
  { id: "AU-2", title: "Event Logging", family: "Audit and Accountability", familyCode: "AU", description: "Identify events that the system is capable of logging", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC7.1", strength: "exact" }, { framework: "iso27001", controlId: "A.12.4", strength: "exact" }, { framework: "hipaa", controlId: "164.312(b)", strength: "strong" }] },
  { id: "AU-3", title: "Content of Audit Records", family: "Audit and Accountability", familyCode: "AU", description: "Ensure audit records contain sufficient information", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "AU-3(1)", title: "Additional Audit Information", description: "Generate audit records with additional detailed information" }], crossMappings: [{ framework: "pcidss", controlId: "Req.1", strength: "partial" }] },
  { id: "AU-6", title: "Audit Record Review, Analysis, and Reporting", family: "Audit and Accountability", familyCode: "AU", description: "Review and analyze audit records for indications of inappropriate activity", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "AU-6(1)", title: "Automated Process Integration", description: "Integrate audit review with other monitoring processes" }], crossMappings: [{ framework: "soc2", controlId: "CC7.2", strength: "strong" }] },
  { id: "AU-12", title: "Audit Record Generation", family: "Audit and Accountability", familyCode: "AU", description: "Provide audit record generation capability", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC7.1", strength: "strong" }] },

  // CA — Assessment, Authorization, and Monitoring
  { id: "CA-1", title: "Policy and Procedures", family: "Assessment, Authorization, and Monitoring", familyCode: "CA", description: "Develop assessment, authorization, and monitoring policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [] },
  { id: "CA-2", title: "Control Assessments", family: "Assessment, Authorization, and Monitoring", familyCode: "CA", description: "Assess security and privacy controls at defined frequency", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "CA-2(1)", title: "Independent Assessors", description: "Employ independent assessors" }], crossMappings: [{ framework: "iso42001", controlId: "9.2", strength: "strong" }] },
  { id: "CA-7", title: "Continuous Monitoring", family: "Assessment, Authorization, and Monitoring", familyCode: "CA", description: "Develop and implement a continuous monitoring strategy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC7.1", strength: "strong" }] },

  // CM — Configuration Management
  { id: "CM-1", title: "Policy and Procedures", family: "Configuration Management", familyCode: "CM", description: "Develop configuration management policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC8.1", strength: "strong" }] },
  { id: "CM-2", title: "Baseline Configuration", family: "Configuration Management", familyCode: "CM", description: "Develop, document, and maintain baseline configuration of the system", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "CM-2(1)", title: "Reviews and Updates", description: "Review and update baseline configuration per defined frequency" }], crossMappings: [{ framework: "soc2", controlId: "CC7.2", strength: "strong" }] },
  { id: "CM-6", title: "Configuration Settings", family: "Configuration Management", familyCode: "CM", description: "Establish and document mandatory configuration settings", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [] },
  { id: "CM-7", title: "Least Functionality", family: "Configuration Management", familyCode: "CM", description: "Configure the system to provide only mission-essential capabilities", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [] },
  { id: "CM-8", title: "System Component Inventory", family: "Configuration Management", familyCode: "CM", description: "Develop and document an inventory of system components", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "CM-8(1)", title: "Updates During Installation and Removal", description: "Update inventory as part of component installations and removals" }], crossMappings: [{ framework: "iso42001", controlId: "4.1", strength: "partial" }] },

  // IA — Identification and Authentication
  { id: "IA-1", title: "Policy and Procedures", family: "Identification and Authentication", familyCode: "IA", description: "Develop identification and authentication policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "pcidss", controlId: "Req.8", strength: "strong" }] },
  { id: "IA-2", title: "Identification and Authentication (Organizational Users)", family: "Identification and Authentication", familyCode: "IA", description: "Uniquely identify and authenticate organizational users", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "IA-2(1)", title: "Multi-Factor Authentication to Privileged Accounts", description: "Implement MFA for access to privileged accounts" }, { id: "IA-2(2)", title: "Multi-Factor Authentication to Non-Privileged Accounts", description: "Implement MFA for access to non-privileged accounts" }], crossMappings: [{ framework: "soc2", controlId: "CC6.1", strength: "exact" }, { framework: "hipaa", controlId: "164.312(a)", strength: "strong" }, { framework: "pcidss", controlId: "Req.8", strength: "exact" }] },
  { id: "IA-5", title: "Authenticator Management", family: "Identification and Authentication", familyCode: "IA", description: "Manage system authenticators including passwords, tokens, PKI certificates", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "IA-5(1)", title: "Password-Based Authentication", description: "Enforce password complexity and rotation requirements" }], crossMappings: [{ framework: "pcidss", controlId: "Req.8", strength: "strong" }] },

  // IR — Incident Response
  { id: "IR-1", title: "Policy and Procedures", family: "Incident Response", familyCode: "IR", description: "Develop incident response policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "gdpr", controlId: "Art.33", strength: "strong" }] },
  { id: "IR-4", title: "Incident Handling", family: "Incident Response", familyCode: "IR", description: "Implement incident handling capability including preparation, detection, analysis, containment, eradication, and recovery", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "IR-4(1)", title: "Automated Incident Handling Processes", description: "Employ automated mechanisms to support incident handling" }], crossMappings: [{ framework: "gdpr", controlId: "Art.33", strength: "strong" }] },
  { id: "IR-5", title: "Incident Monitoring", family: "Incident Response", familyCode: "IR", description: "Track and document incidents", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "soc2", controlId: "CC7.1", strength: "partial" }] },
  { id: "IR-6", title: "Incident Reporting", family: "Incident Response", familyCode: "IR", description: "Require personnel to report suspected incidents", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "gdpr", controlId: "Art.33", strength: "exact" }, { framework: "dpdpa", controlId: "DPDPA-S8", strength: "strong" }] },

  // RA — Risk Assessment
  { id: "RA-1", title: "Policy and Procedures", family: "Risk Assessment", familyCode: "RA", description: "Develop risk assessment policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso42001", controlId: "6.1", strength: "strong" }] },
  { id: "RA-3", title: "Risk Assessment", family: "Risk Assessment", familyCode: "RA", description: "Conduct risk assessment including identifying threats, vulnerabilities, likelihood, and impact", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso42001", controlId: "8.2", strength: "strong" }, { framework: "iso27001", controlId: "A.18.1", strength: "partial" }] },
  { id: "RA-5", title: "Vulnerability Monitoring and Scanning", family: "Risk Assessment", familyCode: "RA", description: "Monitor and scan for vulnerabilities and remediate identified vulnerabilities", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "RA-5(2)", title: "Update Vulnerabilities to Be Scanned", description: "Update vulnerability scanning capabilities per defined frequency" }], crossMappings: [{ framework: "soc2", controlId: "CC7.1", strength: "strong" }] },

  // SC — System and Communications Protection
  { id: "SC-1", title: "Policy and Procedures", family: "System and Communications Protection", familyCode: "SC", description: "Develop system and communications protection policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso27001", controlId: "A.10.1", strength: "partial" }] },
  { id: "SC-7", title: "Boundary Protection", family: "System and Communications Protection", familyCode: "SC", description: "Monitor and control communications at external managed interfaces", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "SC-7(3)", title: "Access Points", description: "Limit number of external network connections" }], crossMappings: [{ framework: "pcidss", controlId: "Req.1", strength: "exact" }] },
  { id: "SC-8", title: "Transmission Confidentiality and Integrity", family: "System and Communications Protection", familyCode: "SC", description: "Protect confidentiality and integrity of transmitted information", baselines: { low: false, moderate: true, high: true }, enhancements: [{ id: "SC-8(1)", title: "Cryptographic Protection", description: "Implement cryptographic mechanisms for transmission protection" }], crossMappings: [{ framework: "hipaa", controlId: "164.312(e)", strength: "exact" }, { framework: "iso27001", controlId: "A.10.1", strength: "strong" }] },
  { id: "SC-12", title: "Cryptographic Key Establishment and Management", family: "System and Communications Protection", familyCode: "SC", description: "Establish and manage cryptographic keys", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso27001", controlId: "A.10.1", strength: "exact" }, { framework: "pcidss", controlId: "Req.3", strength: "strong" }] },
  { id: "SC-13", title: "Cryptographic Protection", family: "System and Communications Protection", familyCode: "SC", description: "Implement FIPS-validated or NSA-approved cryptography", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso27001", controlId: "A.10.1", strength: "exact" }] },
  { id: "SC-28", title: "Protection of Information at Rest", family: "System and Communications Protection", familyCode: "SC", description: "Protect confidentiality and integrity of information at rest", baselines: { low: false, moderate: true, high: true }, enhancements: [{ id: "SC-28(1)", title: "Cryptographic Protection", description: "Implement cryptographic mechanisms for at-rest protection" }], crossMappings: [{ framework: "hipaa", controlId: "164.312(a)", strength: "strong" }, { framework: "pcidss", controlId: "Req.3", strength: "exact" }] },

  // SI — System and Information Integrity
  { id: "SI-1", title: "Policy and Procedures", family: "System and Information Integrity", familyCode: "SI", description: "Develop system and information integrity policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "hipaa", controlId: "164.312(c)", strength: "strong" }] },
  { id: "SI-2", title: "Flaw Remediation", family: "System and Information Integrity", familyCode: "SI", description: "Identify, report, and correct system flaws", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "SI-2(2)", title: "Automated Flaw Remediation Status", description: "Determine flaw remediation status through automated means" }], crossMappings: [] },
  { id: "SI-3", title: "Malicious Code Protection", family: "System and Information Integrity", familyCode: "SI", description: "Implement malicious code protection mechanisms", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [] },
  { id: "SI-4", title: "System Monitoring", family: "System and Information Integrity", familyCode: "SI", description: "Monitor the system to detect attacks, indicators of compromise, and unauthorized connections", baselines: { low: true, moderate: true, high: true }, enhancements: [{ id: "SI-4(4)", title: "Inbound and Outbound Communications Traffic", description: "Monitor inbound and outbound communications traffic" }], crossMappings: [{ framework: "soc2", controlId: "CC7.1", strength: "exact" }, { framework: "soc2", controlId: "CC7.2", strength: "exact" }] },
  { id: "SI-5", title: "Security Alerts, Advisories, and Directives", family: "System and Information Integrity", familyCode: "SI", description: "Receive and disseminate security alerts, advisories, and directives", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [] },

  // SR — Supply Chain Risk Management
  { id: "SR-1", title: "Policy and Procedures", family: "Supply Chain Risk Management", familyCode: "SR", description: "Develop supply chain risk management policy", baselines: { low: false, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "iso42001", controlId: "A.9", strength: "partial" }] },
  { id: "SR-3", title: "Supply Chain Controls and Processes", family: "Supply Chain Risk Management", familyCode: "SR", description: "Establish controls to limit supply chain risks", baselines: { low: false, moderate: true, high: true }, enhancements: [], crossMappings: [] },

  // PT — PII Processing and Transparency
  { id: "PT-1", title: "Policy and Procedures", family: "PII Processing and Transparency", familyCode: "PT", description: "Develop PII processing and transparency policy", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "gdpr", controlId: "Art.25", strength: "strong" }, { framework: "dpdpa", controlId: "DPDPA-S4", strength: "strong" }] },
  { id: "PT-2", title: "Authority to Process PII", family: "PII Processing and Transparency", familyCode: "PT", description: "Determine and document the legal authority to process PII", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "gdpr", controlId: "Art.25", strength: "exact" }, { framework: "dpdpa", controlId: "DPDPA-S4", strength: "exact" }] },
  { id: "PT-3", title: "PII Processing Purposes", family: "PII Processing and Transparency", familyCode: "PT", description: "Identify and document purposes for processing PII", baselines: { low: true, moderate: true, high: true }, enhancements: [], crossMappings: [{ framework: "gdpr", controlId: "Art.25", strength: "exact" }] },
];

/** Select controls based on impact level baseline. */
export function selectNISTBaseline(impactLevel: "low" | "moderate" | "high"): NIST80053Control[] {
  return NIST_800_53_CONTROLS.filter((c) => c.baselines[impactLevel]);
}
