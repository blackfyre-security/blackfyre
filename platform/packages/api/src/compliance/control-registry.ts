import type { ControlDefinition, FrameworkRegistry } from "@blackfyre/shared";
import { iso27001_2022 } from "./frameworks/iso27001-full.js";
import { hipaa as hipaaFull } from "./frameworks/hipaa-full.js";
import { gdpr_part1 } from "./frameworks/gdpr-part1.js";
import { gdpr_part2 } from "./frameworks/gdpr-part2.js";
import { nist80053_part1 } from "./frameworks/nist-part1.js";
import { nist80053_part2 } from "./frameworks/nist-part2.js";
import { nist80053_part3 } from "./frameworks/nist-part3.js";

function project<T extends { controlId: string; controlName: string; description: string; weight: 1 | 2 | 3; category: string }>(items: T[]): ControlDefinition[] {
  return items.map(({ controlId, controlName, description, weight, category }) => ({
    controlId,
    controlName,
    description,
    weight,
    category,
  }));
}

const soc2Controls: ControlDefinition[] = [
  // Access Control (CC6) — critical
  { controlId: "CC6.1", controlName: "Logical and Physical Access Controls", description: "Entity implements logical access security software, infrastructure, and architectures", weight: 3, category: "Access Control" },
  { controlId: "CC6.2", controlName: "User Authentication", description: "Prior to issuing system credentials, registered authorized users are identified", weight: 3, category: "Access Control" },
  { controlId: "CC6.3", controlName: "Credential Management", description: "Processes for creating, changing, and deleting credentials", weight: 3, category: "Access Control" },
  { controlId: "CC6.6", controlName: "Network Security Boundaries", description: "Security measures to protect against threats outside system boundaries", weight: 3, category: "Access Control" },
  { controlId: "CC6.7", controlName: "Data Transmission Protection", description: "Encryption of data in transit", weight: 3, category: "Access Control" },
  { controlId: "CC6.8", controlName: "Malicious Software Prevention", description: "Controls to prevent or detect malicious software", weight: 2, category: "Access Control" },
  // Change Management (CC8) — important
  { controlId: "CC8.1", controlName: "Change Authorization", description: "Changes to infrastructure and software are authorized", weight: 2, category: "Change Management" },
  // Risk Assessment (CC3) — important
  { controlId: "CC3.1", controlName: "Risk Assessment Process", description: "Entity specifies objectives to identify and assess risks", weight: 2, category: "Risk Assessment" },
  { controlId: "CC3.2", controlName: "Risk Identification", description: "Entity identifies risks to objectives", weight: 2, category: "Risk Assessment" },
  // Monitoring (CC7) — critical
  { controlId: "CC7.1", controlName: "Monitoring and Detection", description: "To meet its objectives, entity uses detection and monitoring procedures", weight: 3, category: "Monitoring" },
  { controlId: "CC7.2", controlName: "Incident Response", description: "Entity monitors system components and anomalies for incidents", weight: 3, category: "Monitoring" },
  // Availability (A1) — important
  { controlId: "A1.1", controlName: "System Availability", description: "Maintains, monitors, evaluates current processing capacity", weight: 2, category: "Availability" },
  { controlId: "A1.2", controlName: "Recovery Procedures", description: "Recovery procedures, backups, and related infrastructure", weight: 2, category: "Availability" },
  // Communications (CC2) — standard
  { controlId: "CC2.1", controlName: "Internal Communications", description: "Entity has established information and communication processes", weight: 1, category: "Communications" },
  // Control Environment (CC1) — standard
  { controlId: "CC1.1", controlName: "COSO Principle 1", description: "Entity demonstrates commitment to integrity and ethical values", weight: 1, category: "Control Environment" },
];

const iso27001Controls: ControlDefinition[] = [
  // Access Control — critical
  { controlId: "A.8.5", controlName: "Secure Authentication", description: "Secure authentication technologies and procedures", weight: 3, category: "Access Control" },
  { controlId: "A.8.3", controlName: "Access Restriction", description: "Access to information and systems restricted", weight: 3, category: "Access Control" },
  { controlId: "A.5.15", controlName: "Access Control Policy", description: "Rules controlling physical and logical access", weight: 3, category: "Access Control" },
  // Cryptography — critical
  { controlId: "A.8.24", controlName: "Use of Cryptography", description: "Rules for effective use of cryptography", weight: 3, category: "Cryptography" },
  // Network Security — critical
  { controlId: "A.8.20", controlName: "Networks Security", description: "Networks and network devices secured and managed", weight: 3, category: "Network Security" },
  { controlId: "A.8.21", controlName: "Web Services Security", description: "Security of web-facing services", weight: 3, category: "Network Security" },
  // Logging & Monitoring — important
  { controlId: "A.8.15", controlName: "Logging", description: "Logs recording activities, exceptions, and faults", weight: 2, category: "Logging & Monitoring" },
  { controlId: "A.8.16", controlName: "Monitoring Activities", description: "Networks, systems, and applications monitored", weight: 2, category: "Logging & Monitoring" },
  // Incident Management — important
  { controlId: "A.5.24", controlName: "Incident Response Planning", description: "Approach to managing information security incidents", weight: 2, category: "Incident Management" },
  { controlId: "A.5.25", controlName: "Incident Assessment", description: "Information security events assessed and classified", weight: 2, category: "Incident Management" },
  // Asset Management — standard
  { controlId: "A.5.9", controlName: "Inventory of Assets", description: "Inventory of information and associated assets", weight: 1, category: "Asset Management" },
  { controlId: "A.5.10", controlName: "Acceptable Use of Assets", description: "Rules for acceptable use identified", weight: 1, category: "Asset Management" },
];

const hipaaControls: ControlDefinition[] = [
  // Access Control — critical
  { controlId: "164.312(a)(1)", controlName: "Access Control", description: "Technical policies and procedures for electronic information systems maintaining ePHI", weight: 3, category: "Access Control" },
  { controlId: "164.312(d)", controlName: "Person or Entity Authentication", description: "Procedures to verify identity of person seeking access to ePHI", weight: 3, category: "Access Control" },
  // Audit Controls — critical
  { controlId: "164.312(b)", controlName: "Audit Controls", description: "Hardware, software, and procedures to record and examine access", weight: 3, category: "Audit Controls" },
  // Transmission Security — critical
  { controlId: "164.312(e)(1)", controlName: "Transmission Security", description: "Technical security measures to guard against unauthorized access during transmission", weight: 3, category: "Transmission Security" },
  // Integrity — important
  { controlId: "164.312(c)(1)", controlName: "Integrity", description: "Policies and procedures to protect ePHI from improper alteration or destruction", weight: 2, category: "Integrity" },
  // Administrative Safeguards — important
  { controlId: "164.308(a)(1)(i)", controlName: "Security Management Process", description: "Implement policies and procedures to prevent, detect, contain security violations", weight: 2, category: "Administrative" },
  { controlId: "164.308(a)(3)(i)", controlName: "Workforce Security", description: "Policies and procedures to ensure workforce members have appropriate access", weight: 2, category: "Administrative" },
  { controlId: "164.308(a)(5)(i)", controlName: "Security Awareness Training", description: "Security awareness and training program", weight: 1, category: "Administrative" },
  // Physical Safeguards — standard
  { controlId: "164.310(a)(1)", controlName: "Facility Access Controls", description: "Policies to limit physical access to systems", weight: 1, category: "Physical" },
  { controlId: "164.310(d)(1)", controlName: "Device and Media Controls", description: "Policies governing hardware and electronic media", weight: 1, category: "Physical" },
];

const gdprControls: ControlDefinition[] = [
  // Data Protection — critical
  { controlId: "Art.32(1)", controlName: "Security of Processing", description: "Appropriate technical and organizational measures ensuring security", weight: 3, category: "Data Protection" },
  { controlId: "Art.25(1)", controlName: "Data Protection by Design", description: "Appropriate technical measures designed to implement data protection principles", weight: 3, category: "Data Protection" },
  { controlId: "Art.25(2)", controlName: "Data Protection by Default", description: "Appropriate measures ensuring only necessary personal data processed", weight: 3, category: "Data Protection" },
  // Consent & Rights — critical
  { controlId: "Art.7", controlName: "Conditions for Consent", description: "Controller able to demonstrate data subject consent", weight: 3, category: "Consent & Rights" },
  { controlId: "Art.17", controlName: "Right to Erasure", description: "Data subject right to obtain erasure of personal data", weight: 3, category: "Consent & Rights" },
  { controlId: "Art.20", controlName: "Right to Data Portability", description: "Data subject right to receive personal data in structured format", weight: 2, category: "Consent & Rights" },
  // Breach Notification — critical
  { controlId: "Art.33", controlName: "Notification to Supervisory Authority", description: "Notify supervisory authority within 72 hours of breach awareness", weight: 3, category: "Breach Notification" },
  { controlId: "Art.34", controlName: "Notification to Data Subject", description: "Communicate personal data breach to data subject when high risk", weight: 2, category: "Breach Notification" },
  // Records & Accountability — important
  { controlId: "Art.30", controlName: "Records of Processing Activities", description: "Maintain records of processing activities", weight: 2, category: "Records & Accountability" },
  { controlId: "Art.35", controlName: "Data Protection Impact Assessment", description: "Assessment where processing likely to result in high risk", weight: 2, category: "Records & Accountability" },
  // International Transfers — standard
  { controlId: "Art.46", controlName: "Appropriate Safeguards for Transfers", description: "Appropriate safeguards for international data transfers", weight: 1, category: "International Transfers" },
];

const pcidssControls: ControlDefinition[] = [
  // Network Security — critical
  { controlId: "1.1", controlName: "Network Security Controls", description: "Install and maintain network security controls", weight: 3, category: "Network Security" },
  { controlId: "1.2", controlName: "Network Security Configuration", description: "Network security controls configured and maintained", weight: 3, category: "Network Security" },
  // Account Data Protection — critical
  { controlId: "3.1", controlName: "Account Data Storage Minimization", description: "Storage of account data is kept to a minimum", weight: 3, category: "Account Data" },
  { controlId: "3.5", controlName: "Primary Account Number Protection", description: "PAN is secured wherever it is stored", weight: 3, category: "Account Data" },
  { controlId: "4.1", controlName: "Transmission Encryption", description: "Strong cryptography protects cardholder data during transmission over open networks", weight: 3, category: "Encryption" },
  // Access Control — critical
  { controlId: "7.1", controlName: "Access Restriction to System Components", description: "Access limited to those individuals whose job requires it", weight: 3, category: "Access Control" },
  { controlId: "8.3.1", controlName: "Multi-Factor Authentication", description: "MFA for all non-console administrative access", weight: 3, category: "Access Control" },
  { controlId: "8.2.1", controlName: "Unique Identification", description: "All users assigned a unique ID", weight: 2, category: "Access Control" },
  // Monitoring & Logging — important
  { controlId: "10.1", controlName: "Audit Trail Implementation", description: "Audit trails linking access to system components to individual user", weight: 2, category: "Monitoring" },
  { controlId: "10.2", controlName: "Audit Log Content", description: "Automated audit trails for all system components to reconstruct events", weight: 2, category: "Monitoring" },
  // Vulnerability Management — important
  { controlId: "6.1", controlName: "Security Vulnerability Identification", description: "Process to identify security vulnerabilities", weight: 2, category: "Vulnerability Management" },
  { controlId: "6.2", controlName: "Secure Software Development", description: "Bespoke and custom software developed securely", weight: 2, category: "Vulnerability Management" },
  // Testing — standard
  { controlId: "11.3", controlName: "Penetration Testing", description: "External and internal penetration testing regularly performed", weight: 1, category: "Testing" },
  { controlId: "11.1", controlName: "Wireless Access Point Detection", description: "Processes to test for wireless access points", weight: 1, category: "Testing" },
];

const dpdpaControls: ControlDefinition[] = [
  { controlId: "DPDPA-S8-1", controlName: "Encryption of Personal Data", description: "Appropriate technical measures including encryption to protect personal data per Rule 8(1)(a)", weight: 3, category: "Security Safeguards" },
  { controlId: "DPDPA-S8-2", controlName: "Access Control to Personal Data Systems", description: "Restrict access to personal data systems to authorized personnel per Rule 8(1)(b)", weight: 3, category: "Security Safeguards" },
  { controlId: "DPDPA-S8-3", controlName: "Audit Logging and Monitoring", description: "Maintain logs and monitoring of personal data access per Rule 8(1)(c)", weight: 2, category: "Security Safeguards" },
  { controlId: "DPDPA-S8-4", controlName: "Data Continuity and Backup", description: "Ensure continuity and availability of personal data per Rule 8(1)(d)", weight: 2, category: "Security Safeguards" },
  { controlId: "DPDPA-S8-5", controlName: "Breach Detection and Response", description: "Detect, respond to, and report personal data breaches per Rule 8(2)", weight: 3, category: "Breach Management" },
  { controlId: "DPDPA-S8-6", controlName: "Processor Contractual Safeguards", description: "Contractual obligations on data processors for security per Rule 8(3)", weight: 1, category: "Third Party" },
  { controlId: "DPDPA-S9-1", controlName: "Data Retention Limitation", description: "Erase personal data when purpose is fulfilled per Rule 9", weight: 2, category: "Data Lifecycle" },
  { controlId: "DPDPA-S10-1", controlName: "Data Subject Consent Records", description: "Maintain verifiable records of consent per Rule 10", weight: 2, category: "Consent Management" },
];

const registries: Map<string, FrameworkRegistry> = new Map();

function register(framework: string, version: string, controls: ControlDefinition[]): void {
  registries.set(framework, {
    framework: framework as any,
    version,
    totalControls: controls.length,
    controls,
  });
}

// NIST 800-53 family name lookup for projected category
const NIST_FAMILY_NAMES: Record<string, string> = {
  AC: "Access Control",
  AT: "Awareness and Training",
  AU: "Audit and Accountability",
  CA: "Assessment, Authorization, and Monitoring",
  CM: "Configuration Management",
  CP: "Contingency Planning",
  IA: "Identification and Authentication",
  IR: "Incident Response",
  MA: "Maintenance",
  MP: "Media Protection",
  PE: "Physical and Environmental Protection",
  PL: "Planning",
  PM: "Program Management",
  PS: "Personnel Security",
  PT: "PII Processing and Transparency",
  RA: "Risk Assessment",
  SA: "System and Services Acquisition",
  SC: "System and Communications Protection",
  SI: "System and Information Integrity",
  SR: "Supply Chain Risk Management",
};

const iso27001Full: ControlDefinition[] = project(iso27001_2022);
const hipaaFullProjected: ControlDefinition[] = project(hipaaFull);
const gdprFull: ControlDefinition[] = [...project(gdpr_part1), ...project(gdpr_part2)];
const nist80053Full: ControlDefinition[] = [...nist80053_part1, ...nist80053_part2, ...nist80053_part3].map(
  ({ controlId, controlName, description, weight, family, familyName }) => ({
    controlId,
    controlName,
    description,
    weight,
    category: familyName || NIST_FAMILY_NAMES[family] || family,
  })
);

register("soc2", "2017", soc2Controls);
register("iso27001", "2022", iso27001Full);
register("hipaa", "2013", hipaaFullProjected);
register("gdpr", "2016", gdprFull);
register("pcidss", "4.0", pcidssControls);
register("dpdpa", "2023", dpdpaControls);

// ISO 42001:2023 — AI Management System
const iso42001Controls: ControlDefinition[] = [
  // Governance — critical
  { controlId: "AI-4.1", controlName: "AI System Inventory", description: "Maintain comprehensive inventory of all AI systems and their purposes", weight: 3, category: "Governance" },
  { controlId: "AI-5.1", controlName: "AI Governance Policy", description: "Establish and maintain AI governance policy aligned with organizational objectives", weight: 3, category: "Governance" },
  { controlId: "AI-5.2", controlName: "AI Roles and Responsibilities", description: "Define and assign roles and responsibilities for AI governance", weight: 2, category: "Governance" },
  // Risk — critical
  { controlId: "AI-6.1", controlName: "AI Risk Assessment", description: "Systematic identification and assessment of risks associated with AI systems", weight: 3, category: "Risk Management" },
  { controlId: "AI-6.2", controlName: "AI Risk Treatment Plan", description: "Develop and implement risk treatment plans for identified AI risks", weight: 3, category: "Risk Management" },
  // People — important
  { controlId: "AI-7.1", controlName: "AI Competence and Training", description: "Ensure personnel have necessary competence for AI development and oversight", weight: 2, category: "People" },
  { controlId: "AI-7.2", controlName: "AI Awareness Program", description: "Promote awareness of AI policy and responsible AI practices", weight: 1, category: "People" },
  // Operations — critical
  { controlId: "AI-8.1", controlName: "AI System Development Lifecycle", description: "Manage AI system development through defined lifecycle processes", weight: 3, category: "Operations" },
  { controlId: "AI-8.2", controlName: "Data Quality Management", description: "Ensure quality, relevance, and representativeness of data used in AI systems", weight: 3, category: "Operations" },
  { controlId: "AI-8.3", controlName: "Model Validation and Testing", description: "Validate and test AI models before deployment and on ongoing basis", weight: 3, category: "Operations" },
  { controlId: "AI-8.4", controlName: "AI System Monitoring", description: "Monitor AI systems in production for performance, drift, and anomalies", weight: 2, category: "Operations" },
  // Evaluation — important
  { controlId: "AI-9.1", controlName: "AI Performance Evaluation", description: "Evaluate AI system performance against defined objectives and metrics", weight: 2, category: "Evaluation" },
  { controlId: "AI-9.2", controlName: "Internal Audit of AI Systems", description: "Conduct internal audits of AI management system at planned intervals", weight: 2, category: "Evaluation" },
  // Improvement — critical
  { controlId: "AI-10.1", controlName: "AI Incident Management", description: "Establish process for managing AI-related incidents and near-misses", weight: 3, category: "Improvement" },
  { controlId: "AI-10.2", controlName: "Continuous Improvement of AI", description: "Continually improve the suitability, adequacy, and effectiveness of AI management", weight: 2, category: "Improvement" },
  // Annex A — critical ethical controls
  { controlId: "AI-A.2", controlName: "AI Impact Assessment", description: "Conduct impact assessments for AI systems on individuals and society", weight: 3, category: "Annex A" },
  { controlId: "AI-A.3", controlName: "AI Transparency and Explainability", description: "Ensure AI decisions are transparent and explainable to stakeholders", weight: 3, category: "Annex A" },
  { controlId: "AI-A.4", controlName: "AI Fairness and Bias Prevention", description: "Implement measures to detect, prevent, and mitigate bias in AI systems", weight: 3, category: "Annex A" },
  { controlId: "AI-A.5", controlName: "Human Oversight of AI", description: "Maintain meaningful human oversight of AI system decisions", weight: 3, category: "Annex A" },
  { controlId: "AI-A.6", controlName: "Third-Party AI Management", description: "Manage risks from third-party AI components and services", weight: 2, category: "Annex A" },
  { controlId: "AI-A.7", controlName: "AI Data Provenance", description: "Track and document data lineage and provenance for AI training data", weight: 2, category: "Annex A" },
  { controlId: "AI-A.8", controlName: "AI Privacy Protection", description: "Ensure AI systems protect individual privacy and comply with data protection laws", weight: 3, category: "Annex A" },
];

register("iso42001", "2023", iso42001Controls);

// Qatar PDPPL — Personal Data Protection Privacy Law (Law No. 13 of 2016)
const pdpplControls: ControlDefinition[] = [
  { controlId: "PDPPL-5.1", controlName: "Lawful Processing Basis", description: "Personal data must be processed on a lawful basis with consent or legitimate purpose", weight: 3, category: "Lawful Processing" },
  { controlId: "PDPPL-5.2", controlName: "Purpose Limitation", description: "Data collected for specified, explicit, and legitimate purposes only", weight: 3, category: "Lawful Processing" },
  { controlId: "PDPPL-6.1", controlName: "Data Subject Consent", description: "Obtain clear and informed consent before processing personal data", weight: 3, category: "Consent" },
  { controlId: "PDPPL-7.1", controlName: "Data Minimization", description: "Process only data adequate, relevant, and limited to purpose", weight: 2, category: "Data Principles" },
  { controlId: "PDPPL-8.1", controlName: "Data Accuracy", description: "Ensure personal data is accurate and kept up to date", weight: 2, category: "Data Principles" },
  { controlId: "PDPPL-9.1", controlName: "Storage Limitation", description: "Data retained only as long as necessary for processing purpose", weight: 2, category: "Data Principles" },
  { controlId: "PDPPL-10.1", controlName: "Security Safeguards", description: "Implement appropriate technical and organizational measures for data security", weight: 3, category: "Security" },
  { controlId: "PDPPL-10.2", controlName: "Breach Notification", description: "Notify authority within 72 hours of personal data breach discovery", weight: 3, category: "Security" },
  { controlId: "PDPPL-11.1", controlName: "Cross-Border Transfer Restrictions", description: "Transfer outside Qatar only with adequate protection per ministerial decree", weight: 3, category: "Cross-Border" },
  { controlId: "PDPPL-11.2", controlName: "Data Localization", description: "Certain categories of data must remain within Qatar national borders", weight: 3, category: "Cross-Border" },
  { controlId: "PDPPL-12.1", controlName: "Data Subject Rights - Access", description: "Right to access personal data and obtain copies", weight: 2, category: "Data Subject Rights" },
  { controlId: "PDPPL-12.2", controlName: "Data Subject Rights - Rectification", description: "Right to correct inaccurate or incomplete personal data", weight: 2, category: "Data Subject Rights" },
  { controlId: "PDPPL-12.3", controlName: "Data Subject Rights - Erasure", description: "Right to request deletion of personal data", weight: 2, category: "Data Subject Rights" },
  { controlId: "PDPPL-13.1", controlName: "Data Protection Impact Assessment", description: "Conduct DPIA for high-risk processing operations", weight: 3, category: "Accountability" },
  { controlId: "PDPPL-13.2", controlName: "Records of Processing Activities", description: "Maintain detailed records of all processing activities (RoPA)", weight: 2, category: "Accountability" },
  { controlId: "PDPPL-14.1", controlName: "Data Protection Officer", description: "Appoint DPO for organizations processing significant volumes of personal data", weight: 2, category: "Accountability" },
];

register("pdppl", "2016", pdpplControls);

// NIST SP 800-53 Rev 5 — Security and Privacy Controls for Information Systems
const nist80053Controls: ControlDefinition[] = [
  // Access Control — critical
  { controlId: "AC-2", controlName: "Account Management", category: "Access Control", weight: 3, description: "Manage system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts" },
  { controlId: "AC-3", controlName: "Access Enforcement", category: "Access Control", weight: 3, description: "Enforce approved authorizations for logical access to information and system resources" },
  { controlId: "AC-6", controlName: "Least Privilege", category: "Access Control", weight: 2, description: "Employ the principle of least privilege" },
  // Audit and Accountability — important
  { controlId: "AU-2", controlName: "Event Logging", category: "Audit and Accountability", weight: 2, description: "Identify events that the system is capable of logging" },
  { controlId: "AU-6", controlName: "Audit Record Review", category: "Audit and Accountability", weight: 2, description: "Review and analyze system audit records" },
  // Assessment — important
  { controlId: "CA-7", controlName: "Continuous Monitoring", category: "Assessment", weight: 2, description: "Develop a continuous monitoring strategy and program" },
  // Configuration Management — important
  { controlId: "CM-6", controlName: "Configuration Settings", category: "Configuration Management", weight: 2, description: "Establish and document mandatory configuration settings" },
  { controlId: "CM-8", controlName: "System Component Inventory", category: "Configuration Management", weight: 2, description: "Develop and maintain an inventory of system components" },
  // Contingency Planning — important
  { controlId: "CP-9", controlName: "System Backup", category: "Contingency Planning", weight: 2, description: "Conduct backups of system-level and user-level information" },
  // Identification — critical
  { controlId: "IA-2", controlName: "Identification and Authentication", category: "Identification", weight: 3, description: "Uniquely identify and authenticate organizational users" },
  { controlId: "IA-5", controlName: "Authenticator Management", category: "Identification", weight: 2, description: "Manage system authenticators" },
  // Incident Response — important
  { controlId: "IR-4", controlName: "Incident Handling", category: "Incident Response", weight: 2, description: "Implement an incident handling capability" },
  // Risk Assessment — critical
  { controlId: "RA-5", controlName: "Vulnerability Monitoring", category: "Risk Assessment", weight: 3, description: "Monitor and scan for vulnerabilities in the system" },
  // System Acquisition — standard
  { controlId: "SA-11", controlName: "Developer Testing", category: "System Acquisition", weight: 1, description: "Require the developer to create and implement a security test and evaluation plan" },
  // System Communications — critical
  { controlId: "SC-7", controlName: "Boundary Protection", category: "System Communications", weight: 3, description: "Monitor and control communications at the external managed interfaces" },
  { controlId: "SC-8", controlName: "Transmission Confidentiality", category: "System Communications", weight: 2, description: "Protect the confidentiality of transmitted information" },
  { controlId: "SC-12", controlName: "Cryptographic Key Management", category: "System Communications", weight: 2, description: "Establish and manage cryptographic keys" },
  { controlId: "SC-28", controlName: "Protection of Information at Rest", category: "System Communications", weight: 3, description: "Protect the confidentiality and integrity of information at rest" },
  // System Integrity — critical
  { controlId: "SI-2", controlName: "Flaw Remediation", category: "System Integrity", weight: 3, description: "Identify, report, and correct system flaws" },
  { controlId: "SI-4", controlName: "System Monitoring", category: "System Integrity", weight: 2, description: "Monitor the system to detect attacks, unauthorized connections, and anomalous behavior" },
];

register("nist80053", "Rev 5", nist80053Full);
// Keep legacy stub array referenced in case other modules import it
void nist80053Controls;

/**
 * Get the control registry for a specific framework.
 */
export function getFrameworkRegistry(framework: string): FrameworkRegistry | undefined {
  return registries.get(framework);
}

/**
 * Get all framework registries.
 */
export function getAllFrameworkRegistries(): FrameworkRegistry[] {
  return Array.from(registries.values());
}

/**
 * Get a specific control definition by framework and controlId.
 */
export function getControlDefinition(framework: string, controlId: string): ControlDefinition | undefined {
  const registry = registries.get(framework);
  if (!registry) return undefined;
  return registry.controls.find((c) => c.controlId === controlId);
}

/**
 * Get all supported framework versions for diff.
 * Currently each framework has one version; future: load multiple versions.
 */
export function getFrameworkVersions(framework: string): string[] {
  const registry = registries.get(framework);
  return registry ? [registry.version] : [];
}
