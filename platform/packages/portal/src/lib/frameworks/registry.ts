// Canonical framework + control catalog. Source of truth.
// Pure data, zero React, no side effects.
//
// REGISTRY SAMPLE — for very large frameworks (NIST 800-53, NIST CSF, PCI-DSS,
// GDPR), totalControls reflects the real published total; the controls[] array
// is a curated representative subset spanning every domain. Full enumeration
// would come from official sources at runtime. Smaller frameworks
// (ISO 27001, HIPAA, DPDPA, ISO 42001, SOC 2, CCPA, CERT-In, SOX ITGC) are
// enumerated fully where feasible.

export type FrameworkFamily = "security" | "privacy" | "ai-governance" | "industry";

export interface ControlDefinition {
  id: string;          // e.g. "ISO-27001-A.5.1"
  ref: string;         // canonical reference, e.g. "A.5.1"
  title: string;
  description: string;
  domain: string;      // grouping within framework
  category?: string;   // sub-grouping
  required: boolean;
  evidenceTypes: string[]; // e.g. ["policy", "log", "screenshot", "config"]
}

export interface FrameworkDomain {
  id: string;
  name: string;
  controlCount: number;
}

export interface FrameworkDefinition {
  id: string;          // slug: "iso-27001-2022"
  name: string;        // "ISO/IEC 27001:2022"
  shortName: string;   // "ISO 27001"
  version: string;
  family: FrameworkFamily;
  description: string;
  jurisdiction?: string;
  publishedBy: string;
  totalControls: number; // real published total (may exceed controls.length)
  domains: FrameworkDomain[];
  controls: ControlDefinition[];
}

// ---------------------------------------------------------------------------
// ISO/IEC 27001:2022 — Annex A: 93 controls across 4 themes
// Fully enumerated.
// ---------------------------------------------------------------------------

const ISO_27001_CONTROLS: ControlDefinition[] = [
  // A.5 Organizational controls (37)
  { id: "ISO-27001-A.5.1", ref: "A.5.1", title: "Policies for information security", description: "Define, approve, publish and communicate information security policies.", domain: "Organizational", required: true, evidenceTypes: ["policy", "approval"] },
  { id: "ISO-27001-A.5.2", ref: "A.5.2", title: "Information security roles and responsibilities", description: "Allocate and communicate information security responsibilities.", domain: "Organizational", required: true, evidenceTypes: ["policy", "org-chart"] },
  { id: "ISO-27001-A.5.3", ref: "A.5.3", title: "Segregation of duties", description: "Segregate conflicting duties and areas of responsibility.", domain: "Organizational", required: true, evidenceTypes: ["policy", "access-matrix"] },
  { id: "ISO-27001-A.5.4", ref: "A.5.4", title: "Management responsibilities", description: "Management requires personnel to apply information security per policy.", domain: "Organizational", required: true, evidenceTypes: ["policy", "training-record"] },
  { id: "ISO-27001-A.5.5", ref: "A.5.5", title: "Contact with authorities", description: "Establish and maintain contact with relevant authorities.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "contact-list"] },
  { id: "ISO-27001-A.5.6", ref: "A.5.6", title: "Contact with special interest groups", description: "Maintain contact with security forums and groups.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "membership"] },
  { id: "ISO-27001-A.5.7", ref: "A.5.7", title: "Threat intelligence", description: "Collect and analyze threat intelligence.", domain: "Organizational", required: true, evidenceTypes: ["report", "log"] },
  { id: "ISO-27001-A.5.8", ref: "A.5.8", title: "Information security in project management", description: "Integrate information security into project management.", domain: "Organizational", required: true, evidenceTypes: ["policy", "project-plan"] },
  { id: "ISO-27001-A.5.9", ref: "A.5.9", title: "Inventory of information and other associated assets", description: "Develop and maintain inventory of assets.", domain: "Organizational", required: true, evidenceTypes: ["inventory", "config"] },
  { id: "ISO-27001-A.5.10", ref: "A.5.10", title: "Acceptable use of information and other associated assets", description: "Identify, document and implement rules for acceptable use.", domain: "Organizational", required: true, evidenceTypes: ["policy", "acknowledgement"] },
  { id: "ISO-27001-A.5.11", ref: "A.5.11", title: "Return of assets", description: "Personnel return organization assets upon termination.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "checklist"] },
  { id: "ISO-27001-A.5.12", ref: "A.5.12", title: "Classification of information", description: "Classify information per security needs.", domain: "Organizational", required: true, evidenceTypes: ["policy", "classification-scheme"] },
  { id: "ISO-27001-A.5.13", ref: "A.5.13", title: "Labelling of information", description: "Develop and implement procedures for labelling information.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "screenshot"] },
  { id: "ISO-27001-A.5.14", ref: "A.5.14", title: "Information transfer", description: "Establish rules for information transfer.", domain: "Organizational", required: true, evidenceTypes: ["policy", "agreement"] },
  { id: "ISO-27001-A.5.15", ref: "A.5.15", title: "Access control", description: "Establish rules to control physical and logical access.", domain: "Organizational", required: true, evidenceTypes: ["policy", "access-matrix"] },
  { id: "ISO-27001-A.5.16", ref: "A.5.16", title: "Identity management", description: "Manage full lifecycle of identities.", domain: "Organizational", required: true, evidenceTypes: ["policy", "iam-config"] },
  { id: "ISO-27001-A.5.17", ref: "A.5.17", title: "Authentication information", description: "Control allocation and management of authentication information.", domain: "Organizational", required: true, evidenceTypes: ["policy", "config"] },
  { id: "ISO-27001-A.5.18", ref: "A.5.18", title: "Access rights", description: "Provision, review, modify and remove access rights.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "review-record"] },
  { id: "ISO-27001-A.5.19", ref: "A.5.19", title: "Information security in supplier relationships", description: "Manage information security risks from supplier use.", domain: "Organizational", required: true, evidenceTypes: ["policy", "contract"] },
  { id: "ISO-27001-A.5.20", ref: "A.5.20", title: "Addressing information security within supplier agreements", description: "Establish requirements in supplier agreements.", domain: "Organizational", required: true, evidenceTypes: ["contract", "policy"] },
  { id: "ISO-27001-A.5.21", ref: "A.5.21", title: "Managing information security in the ICT supply chain", description: "Manage risks from products and services supply chain.", domain: "Organizational", required: true, evidenceTypes: ["policy", "assessment"] },
  { id: "ISO-27001-A.5.22", ref: "A.5.22", title: "Monitoring, review and change management of supplier services", description: "Regularly monitor and manage supplier service changes.", domain: "Organizational", required: true, evidenceTypes: ["report", "review-record"] },
  { id: "ISO-27001-A.5.23", ref: "A.5.23", title: "Information security for use of cloud services", description: "Establish processes for cloud services security.", domain: "Organizational", required: true, evidenceTypes: ["policy", "config"] },
  { id: "ISO-27001-A.5.24", ref: "A.5.24", title: "Information security incident management planning and preparation", description: "Plan and prepare for incident management.", domain: "Organizational", required: true, evidenceTypes: ["policy", "runbook"] },
  { id: "ISO-27001-A.5.25", ref: "A.5.25", title: "Assessment and decision on information security events", description: "Assess and decide on information security events.", domain: "Organizational", required: true, evidenceTypes: ["log", "ticket"] },
  { id: "ISO-27001-A.5.26", ref: "A.5.26", title: "Response to information security incidents", description: "Respond to incidents per documented procedures.", domain: "Organizational", required: true, evidenceTypes: ["runbook", "ticket"] },
  { id: "ISO-27001-A.5.27", ref: "A.5.27", title: "Learning from information security incidents", description: "Use knowledge from incidents to strengthen controls.", domain: "Organizational", required: true, evidenceTypes: ["report", "lessons-learned"] },
  { id: "ISO-27001-A.5.28", ref: "A.5.28", title: "Collection of evidence", description: "Establish procedures for evidence collection.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "chain-of-custody"] },
  { id: "ISO-27001-A.5.29", ref: "A.5.29", title: "Information security during disruption", description: "Plan how to maintain security during disruption.", domain: "Organizational", required: true, evidenceTypes: ["plan", "test-result"] },
  { id: "ISO-27001-A.5.30", ref: "A.5.30", title: "ICT readiness for business continuity", description: "Plan, implement and test ICT readiness for BC.", domain: "Organizational", required: true, evidenceTypes: ["plan", "test-result"] },
  { id: "ISO-27001-A.5.31", ref: "A.5.31", title: "Legal, statutory, regulatory and contractual requirements", description: "Identify and document compliance requirements.", domain: "Organizational", required: true, evidenceTypes: ["register", "policy"] },
  { id: "ISO-27001-A.5.32", ref: "A.5.32", title: "Intellectual property rights", description: "Implement procedures to protect IPR.", domain: "Organizational", required: true, evidenceTypes: ["policy", "inventory"] },
  { id: "ISO-27001-A.5.33", ref: "A.5.33", title: "Protection of records", description: "Protect records from loss, destruction, falsification.", domain: "Organizational", required: true, evidenceTypes: ["policy", "config"] },
  { id: "ISO-27001-A.5.34", ref: "A.5.34", title: "Privacy and protection of PII", description: "Comply with privacy and PII protection requirements.", domain: "Organizational", required: true, evidenceTypes: ["policy", "DPIA"] },
  { id: "ISO-27001-A.5.35", ref: "A.5.35", title: "Independent review of information security", description: "Independent reviews of information security approach.", domain: "Organizational", required: true, evidenceTypes: ["audit-report", "assessment"] },
  { id: "ISO-27001-A.5.36", ref: "A.5.36", title: "Compliance with policies, rules and standards", description: "Regularly review compliance with security policies.", domain: "Organizational", required: true, evidenceTypes: ["audit-report", "review-record"] },
  { id: "ISO-27001-A.5.37", ref: "A.5.37", title: "Documented operating procedures", description: "Document and make available operating procedures.", domain: "Organizational", required: true, evidenceTypes: ["procedure", "runbook"] },

  // A.6 People controls (8)
  { id: "ISO-27001-A.6.1", ref: "A.6.1", title: "Screening", description: "Verify backgrounds prior to and during employment.", domain: "People", required: true, evidenceTypes: ["background-check", "policy"] },
  { id: "ISO-27001-A.6.2", ref: "A.6.2", title: "Terms and conditions of employment", description: "Information security responsibilities in employment agreements.", domain: "People", required: true, evidenceTypes: ["contract", "policy"] },
  { id: "ISO-27001-A.6.3", ref: "A.6.3", title: "Information security awareness, education and training", description: "Receive appropriate awareness education and training.", domain: "People", required: true, evidenceTypes: ["training-record", "log"] },
  { id: "ISO-27001-A.6.4", ref: "A.6.4", title: "Disciplinary process", description: "Formalize and communicate disciplinary process.", domain: "People", required: true, evidenceTypes: ["policy", "procedure"] },
  { id: "ISO-27001-A.6.5", ref: "A.6.5", title: "Responsibilities after termination or change of employment", description: "Define and enforce post-employment responsibilities.", domain: "People", required: true, evidenceTypes: ["procedure", "agreement"] },
  { id: "ISO-27001-A.6.6", ref: "A.6.6", title: "Confidentiality or non-disclosure agreements", description: "Identify, document, review NDAs.", domain: "People", required: true, evidenceTypes: ["agreement", "register"] },
  { id: "ISO-27001-A.6.7", ref: "A.6.7", title: "Remote working", description: "Implement measures for remote working.", domain: "People", required: true, evidenceTypes: ["policy", "config"] },
  { id: "ISO-27001-A.6.8", ref: "A.6.8", title: "Information security event reporting", description: "Provide a mechanism to report security events.", domain: "People", required: true, evidenceTypes: ["procedure", "ticket"] },

  // A.7 Physical controls (14)
  { id: "ISO-27001-A.7.1", ref: "A.7.1", title: "Physical security perimeters", description: "Define and use security perimeters.", domain: "Physical", required: true, evidenceTypes: ["site-plan", "photo"] },
  { id: "ISO-27001-A.7.2", ref: "A.7.2", title: "Physical entry", description: "Protect secure areas by entry controls.", domain: "Physical", required: true, evidenceTypes: ["access-log", "policy"] },
  { id: "ISO-27001-A.7.3", ref: "A.7.3", title: "Securing offices, rooms and facilities", description: "Design and implement physical security.", domain: "Physical", required: true, evidenceTypes: ["site-plan", "photo"] },
  { id: "ISO-27001-A.7.4", ref: "A.7.4", title: "Physical security monitoring", description: "Monitor premises for unauthorized physical access.", domain: "Physical", required: true, evidenceTypes: ["cctv-log", "report"] },
  { id: "ISO-27001-A.7.5", ref: "A.7.5", title: "Protecting against physical and environmental threats", description: "Design protection against environmental threats.", domain: "Physical", required: true, evidenceTypes: ["risk-assessment", "config"] },
  { id: "ISO-27001-A.7.6", ref: "A.7.6", title: "Working in secure areas", description: "Design and implement secure-area procedures.", domain: "Physical", required: true, evidenceTypes: ["procedure", "training-record"] },
  { id: "ISO-27001-A.7.7", ref: "A.7.7", title: "Clear desk and clear screen", description: "Implement clear desk and clear screen rules.", domain: "Physical", required: true, evidenceTypes: ["policy", "audit-result"] },
  { id: "ISO-27001-A.7.8", ref: "A.7.8", title: "Equipment siting and protection", description: "Site equipment securely and protect it.", domain: "Physical", required: true, evidenceTypes: ["inventory", "site-plan"] },
  { id: "ISO-27001-A.7.9", ref: "A.7.9", title: "Security of assets off-premises", description: "Protect off-site assets.", domain: "Physical", required: true, evidenceTypes: ["policy", "inventory"] },
  { id: "ISO-27001-A.7.10", ref: "A.7.10", title: "Storage media", description: "Manage storage media through their life cycle.", domain: "Physical", required: true, evidenceTypes: ["inventory", "procedure"] },
  { id: "ISO-27001-A.7.11", ref: "A.7.11", title: "Supporting utilities", description: "Protect equipment from utility failures.", domain: "Physical", required: true, evidenceTypes: ["maintenance-log", "config"] },
  { id: "ISO-27001-A.7.12", ref: "A.7.12", title: "Cabling security", description: "Protect cabling from interception or damage.", domain: "Physical", required: true, evidenceTypes: ["site-plan", "photo"] },
  { id: "ISO-27001-A.7.13", ref: "A.7.13", title: "Equipment maintenance", description: "Maintain equipment to ensure availability.", domain: "Physical", required: true, evidenceTypes: ["maintenance-log", "contract"] },
  { id: "ISO-27001-A.7.14", ref: "A.7.14", title: "Secure disposal or re-use of equipment", description: "Verify equipment is sanitized before disposal/reuse.", domain: "Physical", required: true, evidenceTypes: ["procedure", "certificate"] },

  // A.8 Technological controls (34)
  { id: "ISO-27001-A.8.1", ref: "A.8.1", title: "User end point devices", description: "Protect information on user endpoint devices.", domain: "Technological", required: true, evidenceTypes: ["config", "mdm-report"] },
  { id: "ISO-27001-A.8.2", ref: "A.8.2", title: "Privileged access rights", description: "Restrict and manage privileged access rights.", domain: "Technological", required: true, evidenceTypes: ["iam-config", "review-record"] },
  { id: "ISO-27001-A.8.3", ref: "A.8.3", title: "Information access restriction", description: "Restrict information access per policy.", domain: "Technological", required: true, evidenceTypes: ["access-matrix", "config"] },
  { id: "ISO-27001-A.8.4", ref: "A.8.4", title: "Access to source code", description: "Manage read/write access to source code.", domain: "Technological", required: true, evidenceTypes: ["iam-config", "log"] },
  { id: "ISO-27001-A.8.5", ref: "A.8.5", title: "Secure authentication", description: "Implement secure authentication technologies.", domain: "Technological", required: true, evidenceTypes: ["config", "policy"] },
  { id: "ISO-27001-A.8.6", ref: "A.8.6", title: "Capacity management", description: "Monitor and forecast capacity.", domain: "Technological", required: true, evidenceTypes: ["report", "monitoring"] },
  { id: "ISO-27001-A.8.7", ref: "A.8.7", title: "Protection against malware", description: "Implement controls against malware.", domain: "Technological", required: true, evidenceTypes: ["edr-report", "config"] },
  { id: "ISO-27001-A.8.8", ref: "A.8.8", title: "Management of technical vulnerabilities", description: "Identify and manage vulnerabilities.", domain: "Technological", required: true, evidenceTypes: ["scan-report", "patch-record"] },
  { id: "ISO-27001-A.8.9", ref: "A.8.9", title: "Configuration management", description: "Establish and manage configurations.", domain: "Technological", required: true, evidenceTypes: ["config", "baseline"] },
  { id: "ISO-27001-A.8.10", ref: "A.8.10", title: "Information deletion", description: "Delete information no longer required.", domain: "Technological", required: true, evidenceTypes: ["procedure", "log"] },
  { id: "ISO-27001-A.8.11", ref: "A.8.11", title: "Data masking", description: "Use data masking per policy.", domain: "Technological", required: true, evidenceTypes: ["config", "policy"] },
  { id: "ISO-27001-A.8.12", ref: "A.8.12", title: "Data leakage prevention", description: "Apply DLP measures.", domain: "Technological", required: true, evidenceTypes: ["dlp-config", "report"] },
  { id: "ISO-27001-A.8.13", ref: "A.8.13", title: "Information backup", description: "Maintain and test backups.", domain: "Technological", required: true, evidenceTypes: ["backup-log", "test-result"] },
  { id: "ISO-27001-A.8.14", ref: "A.8.14", title: "Redundancy of information processing facilities", description: "Implement redundancy to meet availability requirements.", domain: "Technological", required: true, evidenceTypes: ["config", "architecture-diagram"] },
  { id: "ISO-27001-A.8.15", ref: "A.8.15", title: "Logging", description: "Produce, store, protect and analyze logs.", domain: "Technological", required: true, evidenceTypes: ["log", "config"] },
  { id: "ISO-27001-A.8.16", ref: "A.8.16", title: "Monitoring activities", description: "Monitor networks, systems, and applications.", domain: "Technological", required: true, evidenceTypes: ["monitoring", "alert-log"] },
  { id: "ISO-27001-A.8.17", ref: "A.8.17", title: "Clock synchronization", description: "Synchronize clocks across systems.", domain: "Technological", required: true, evidenceTypes: ["config", "log"] },
  { id: "ISO-27001-A.8.18", ref: "A.8.18", title: "Use of privileged utility programs", description: "Restrict and tightly control utility programs.", domain: "Technological", required: true, evidenceTypes: ["config", "log"] },
  { id: "ISO-27001-A.8.19", ref: "A.8.19", title: "Installation of software on operational systems", description: "Implement procedures for software installation.", domain: "Technological", required: true, evidenceTypes: ["procedure", "config"] },
  { id: "ISO-27001-A.8.20", ref: "A.8.20", title: "Networks security", description: "Manage and control networks.", domain: "Technological", required: true, evidenceTypes: ["network-diagram", "config"] },
  { id: "ISO-27001-A.8.21", ref: "A.8.21", title: "Security of network services", description: "Identify and manage network service security.", domain: "Technological", required: true, evidenceTypes: ["config", "contract"] },
  { id: "ISO-27001-A.8.22", ref: "A.8.22", title: "Segregation of networks", description: "Segregate networks into security zones.", domain: "Technological", required: true, evidenceTypes: ["network-diagram", "config"] },
  { id: "ISO-27001-A.8.23", ref: "A.8.23", title: "Web filtering", description: "Manage access to external websites.", domain: "Technological", required: true, evidenceTypes: ["config", "report"] },
  { id: "ISO-27001-A.8.24", ref: "A.8.24", title: "Use of cryptography", description: "Define and implement cryptography rules.", domain: "Technological", required: true, evidenceTypes: ["policy", "config"] },
  { id: "ISO-27001-A.8.25", ref: "A.8.25", title: "Secure development life cycle", description: "Establish secure SDLC.", domain: "Technological", required: true, evidenceTypes: ["policy", "pipeline-config"] },
  { id: "ISO-27001-A.8.26", ref: "A.8.26", title: "Application security requirements", description: "Identify and approve app security requirements.", domain: "Technological", required: true, evidenceTypes: ["requirements-doc", "review"] },
  { id: "ISO-27001-A.8.27", ref: "A.8.27", title: "Secure system architecture and engineering principles", description: "Apply secure engineering principles.", domain: "Technological", required: true, evidenceTypes: ["architecture-doc", "review"] },
  { id: "ISO-27001-A.8.28", ref: "A.8.28", title: "Secure coding", description: "Apply secure coding principles.", domain: "Technological", required: true, evidenceTypes: ["sast-report", "review"] },
  { id: "ISO-27001-A.8.29", ref: "A.8.29", title: "Security testing in development and acceptance", description: "Define and implement security testing.", domain: "Technological", required: true, evidenceTypes: ["test-result", "pipeline-config"] },
  { id: "ISO-27001-A.8.30", ref: "A.8.30", title: "Outsourced development", description: "Direct, monitor and review outsourced development.", domain: "Technological", required: true, evidenceTypes: ["contract", "review"] },
  { id: "ISO-27001-A.8.31", ref: "A.8.31", title: "Separation of development, test and production environments", description: "Separate environments.", domain: "Technological", required: true, evidenceTypes: ["architecture-diagram", "config"] },
  { id: "ISO-27001-A.8.32", ref: "A.8.32", title: "Change management", description: "Apply change management procedures.", domain: "Technological", required: true, evidenceTypes: ["ticket", "approval"] },
  { id: "ISO-27001-A.8.33", ref: "A.8.33", title: "Test information", description: "Protect test information.", domain: "Technological", required: true, evidenceTypes: ["config", "policy"] },
  { id: "ISO-27001-A.8.34", ref: "A.8.34", title: "Protection of information systems during audit testing", description: "Plan audit tests to minimize disruption.", domain: "Technological", required: true, evidenceTypes: ["plan", "approval"] },
];

const ISO_27001: FrameworkDefinition = {
  id: "iso-27001-2022",
  name: "ISO/IEC 27001:2022",
  shortName: "ISO 27001",
  version: "2022",
  family: "security",
  description: "International standard for information security management systems (ISMS) with 93 Annex A controls across 4 themes.",
  publishedBy: "ISO/IEC",
  totalControls: 93,
  domains: [
    { id: "organizational", name: "Organizational", controlCount: 37 },
    { id: "people", name: "People", controlCount: 8 },
    { id: "physical", name: "Physical", controlCount: 14 },
    { id: "technological", name: "Technological", controlCount: 34 },
  ],
  controls: ISO_27001_CONTROLS,
};

// ---------------------------------------------------------------------------
// SOC 2 Type II — Trust Services Criteria (TSC 2017, revised 2022)
// 5 categories. ~64 points of focus. Curated representative set per criterion.
// ---------------------------------------------------------------------------

const SOC2_CONTROLS: ControlDefinition[] = [
  // CC1 Control Environment
  { id: "SOC2-CC1.1", ref: "CC1.1", title: "Commitment to integrity and ethical values", description: "Entity demonstrates a commitment to integrity and ethical values.", domain: "Security (Common Criteria)", category: "CC1", required: true, evidenceTypes: ["policy", "code-of-conduct"] },
  { id: "SOC2-CC1.2", ref: "CC1.2", title: "Board independence and oversight", description: "Board demonstrates independence and exercises oversight.", domain: "Security (Common Criteria)", category: "CC1", required: true, evidenceTypes: ["board-minutes", "charter"] },
  { id: "SOC2-CC1.3", ref: "CC1.3", title: "Structures, reporting lines, authorities", description: "Management establishes structures and reporting lines.", domain: "Security (Common Criteria)", category: "CC1", required: true, evidenceTypes: ["org-chart", "policy"] },
  { id: "SOC2-CC1.4", ref: "CC1.4", title: "Commitment to attract, develop, retain competent personnel", description: "Entity demonstrates commitment to competence.", domain: "Security (Common Criteria)", category: "CC1", required: true, evidenceTypes: ["hr-policy", "training-record"] },
  { id: "SOC2-CC1.5", ref: "CC1.5", title: "Holds personnel accountable", description: "Entity holds individuals accountable for internal control responsibilities.", domain: "Security (Common Criteria)", category: "CC1", required: true, evidenceTypes: ["performance-review", "policy"] },
  // CC2 Communication & Information
  { id: "SOC2-CC2.1", ref: "CC2.1", title: "Internal communication of objectives and responsibilities", description: "Entity internally communicates objectives.", domain: "Security (Common Criteria)", category: "CC2", required: true, evidenceTypes: ["policy", "newsletter"] },
  { id: "SOC2-CC2.2", ref: "CC2.2", title: "Internal communication of incident reporting", description: "Provides channels for internal communication of issues.", domain: "Security (Common Criteria)", category: "CC2", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "SOC2-CC2.3", ref: "CC2.3", title: "External communication", description: "Communicates with external parties.", domain: "Security (Common Criteria)", category: "CC2", required: true, evidenceTypes: ["policy", "report"] },
  // CC3 Risk Assessment
  { id: "SOC2-CC3.1", ref: "CC3.1", title: "Specifies suitable objectives", description: "Entity specifies objectives to identify risks.", domain: "Security (Common Criteria)", category: "CC3", required: true, evidenceTypes: ["risk-register", "policy"] },
  { id: "SOC2-CC3.2", ref: "CC3.2", title: "Identifies risks", description: "Identifies risks to achievement of objectives.", domain: "Security (Common Criteria)", category: "CC3", required: true, evidenceTypes: ["risk-register"] },
  { id: "SOC2-CC3.3", ref: "CC3.3", title: "Considers potential for fraud", description: "Considers potential for fraud in risk assessment.", domain: "Security (Common Criteria)", category: "CC3", required: true, evidenceTypes: ["risk-register", "fraud-assessment"] },
  { id: "SOC2-CC3.4", ref: "CC3.4", title: "Identifies and assesses changes", description: "Identifies and assesses significant changes.", domain: "Security (Common Criteria)", category: "CC3", required: true, evidenceTypes: ["change-log", "assessment"] },
  // CC4 Monitoring
  { id: "SOC2-CC4.1", ref: "CC4.1", title: "Ongoing and separate evaluations", description: "Selects, develops, and performs evaluations.", domain: "Security (Common Criteria)", category: "CC4", required: true, evidenceTypes: ["audit-report", "review"] },
  { id: "SOC2-CC4.2", ref: "CC4.2", title: "Evaluates and communicates deficiencies", description: "Evaluates and communicates internal control deficiencies.", domain: "Security (Common Criteria)", category: "CC4", required: true, evidenceTypes: ["audit-report", "ticket"] },
  // CC5 Control Activities
  { id: "SOC2-CC5.1", ref: "CC5.1", title: "Selects and develops control activities", description: "Selects controls that mitigate risks.", domain: "Security (Common Criteria)", category: "CC5", required: true, evidenceTypes: ["policy", "control-matrix"] },
  { id: "SOC2-CC5.2", ref: "CC5.2", title: "Technology general controls", description: "Selects general technology controls.", domain: "Security (Common Criteria)", category: "CC5", required: true, evidenceTypes: ["config", "policy"] },
  { id: "SOC2-CC5.3", ref: "CC5.3", title: "Deploys through policies and procedures", description: "Deploys control activities through policies.", domain: "Security (Common Criteria)", category: "CC5", required: true, evidenceTypes: ["procedure", "training-record"] },
  // CC6 Logical & Physical Access
  { id: "SOC2-CC6.1", ref: "CC6.1", title: "Logical access security software", description: "Implements logical access security to assets.", domain: "Security (Common Criteria)", category: "CC6", required: true, evidenceTypes: ["iam-config", "policy"] },
  { id: "SOC2-CC6.2", ref: "CC6.2", title: "New user registration and modification", description: "Registers, authorizes and removes users.", domain: "Security (Common Criteria)", category: "CC6", required: true, evidenceTypes: ["procedure", "log"] },
  { id: "SOC2-CC6.3", ref: "CC6.3", title: "Authorizes, modifies, removes access", description: "Manages access rights.", domain: "Security (Common Criteria)", category: "CC6", required: true, evidenceTypes: ["access-matrix", "review-record"] },
  { id: "SOC2-CC6.6", ref: "CC6.6", title: "Logical access perimeter", description: "Implements logical access security over boundaries.", domain: "Security (Common Criteria)", category: "CC6", required: true, evidenceTypes: ["firewall-config", "diagram"] },
  { id: "SOC2-CC6.7", ref: "CC6.7", title: "Transmission of information", description: "Restricts movement of information.", domain: "Security (Common Criteria)", category: "CC6", required: true, evidenceTypes: ["tls-config", "policy"] },
  { id: "SOC2-CC6.8", ref: "CC6.8", title: "Prevention of unauthorized or malicious software", description: "Detects and prevents malicious software.", domain: "Security (Common Criteria)", category: "CC6", required: true, evidenceTypes: ["edr-report", "config"] },
  // CC7 System Operations
  { id: "SOC2-CC7.1", ref: "CC7.1", title: "Vulnerability detection", description: "Detects and prevents introduction of new vulnerabilities.", domain: "Security (Common Criteria)", category: "CC7", required: true, evidenceTypes: ["scan-report", "config"] },
  { id: "SOC2-CC7.2", ref: "CC7.2", title: "Monitors system components", description: "Monitors components for anomalies.", domain: "Security (Common Criteria)", category: "CC7", required: true, evidenceTypes: ["monitoring", "alert-log"] },
  { id: "SOC2-CC7.3", ref: "CC7.3", title: "Evaluates security events", description: "Evaluates events to determine if incident.", domain: "Security (Common Criteria)", category: "CC7", required: true, evidenceTypes: ["ticket", "soc-report"] },
  { id: "SOC2-CC7.4", ref: "CC7.4", title: "Responds to incidents", description: "Responds to identified incidents.", domain: "Security (Common Criteria)", category: "CC7", required: true, evidenceTypes: ["runbook", "ticket"] },
  { id: "SOC2-CC7.5", ref: "CC7.5", title: "Recovers from incidents", description: "Identifies and develops activities to recover.", domain: "Security (Common Criteria)", category: "CC7", required: true, evidenceTypes: ["plan", "post-incident-review"] },
  // CC8 Change Management
  { id: "SOC2-CC8.1", ref: "CC8.1", title: "Changes to infrastructure, data, and software", description: "Authorizes, designs, develops changes.", domain: "Security (Common Criteria)", category: "CC8", required: true, evidenceTypes: ["ticket", "approval"] },
  // CC9 Risk Mitigation
  { id: "SOC2-CC9.1", ref: "CC9.1", title: "Identifies, selects, and develops risk mitigation activities", description: "Develops mitigation activities.", domain: "Security (Common Criteria)", category: "CC9", required: true, evidenceTypes: ["risk-register", "policy"] },
  { id: "SOC2-CC9.2", ref: "CC9.2", title: "Vendor and business partner risk", description: "Assesses and manages vendor risk.", domain: "Security (Common Criteria)", category: "CC9", required: true, evidenceTypes: ["vendor-assessment", "contract"] },
  // A1 Availability
  { id: "SOC2-A1.1", ref: "A1.1", title: "Capacity management", description: "Maintains current processing capacity and forecasts.", domain: "Availability", category: "A1", required: false, evidenceTypes: ["monitoring", "report"] },
  { id: "SOC2-A1.2", ref: "A1.2", title: "Environmental protections", description: "Protects against environmental threats.", domain: "Availability", category: "A1", required: false, evidenceTypes: ["bcdr-plan", "test-result"] },
  { id: "SOC2-A1.3", ref: "A1.3", title: "Recovery testing", description: "Tests recovery procedures.", domain: "Availability", category: "A1", required: false, evidenceTypes: ["test-result", "plan"] },
  // C1 Confidentiality
  { id: "SOC2-C1.1", ref: "C1.1", title: "Identifies and maintains confidential information", description: "Identifies confidential information.", domain: "Confidentiality", category: "C1", required: false, evidenceTypes: ["inventory", "classification"] },
  { id: "SOC2-C1.2", ref: "C1.2", title: "Disposes of confidential information", description: "Disposes of confidential information.", domain: "Confidentiality", category: "C1", required: false, evidenceTypes: ["procedure", "log"] },
  // PI1 Processing Integrity
  { id: "SOC2-PI1.1", ref: "PI1.1", title: "Definition of data processing", description: "Obtains, generates, uses information.", domain: "Processing Integrity", category: "PI1", required: false, evidenceTypes: ["data-flow", "doc"] },
  { id: "SOC2-PI1.4", ref: "PI1.4", title: "Output completeness and accuracy", description: "Implements policies for accuracy and completeness.", domain: "Processing Integrity", category: "PI1", required: false, evidenceTypes: ["test-result", "log"] },
  // P1-P8 Privacy
  { id: "SOC2-P1.1", ref: "P1.1", title: "Notice of privacy practices", description: "Provides notice about privacy practices.", domain: "Privacy", category: "P1", required: false, evidenceTypes: ["privacy-notice"] },
  { id: "SOC2-P2.1", ref: "P2.1", title: "Choice and consent", description: "Communicates choices and obtains consent.", domain: "Privacy", category: "P2", required: false, evidenceTypes: ["consent-record", "policy"] },
  { id: "SOC2-P3.1", ref: "P3.1", title: "Collection of personal information", description: "Collects PI for identified purposes.", domain: "Privacy", category: "P3", required: false, evidenceTypes: ["policy", "data-flow"] },
  { id: "SOC2-P4.1", ref: "P4.1", title: "Use, retention, disposal", description: "Limits use of PI.", domain: "Privacy", category: "P4", required: false, evidenceTypes: ["policy", "log"] },
  { id: "SOC2-P5.1", ref: "P5.1", title: "Access by data subjects", description: "Provides access to PI.", domain: "Privacy", category: "P5", required: false, evidenceTypes: ["procedure", "ticket"] },
  { id: "SOC2-P6.1", ref: "P6.1", title: "Disclosure and notification", description: "Discloses PI per consent and notifies on breach.", domain: "Privacy", category: "P6", required: false, evidenceTypes: ["procedure", "notice"] },
  { id: "SOC2-P7.1", ref: "P7.1", title: "Quality of personal information", description: "Maintains accuracy of PI.", domain: "Privacy", category: "P7", required: false, evidenceTypes: ["procedure", "audit"] },
  { id: "SOC2-P8.1", ref: "P8.1", title: "Monitoring and enforcement", description: "Monitors compliance with privacy commitments.", domain: "Privacy", category: "P8", required: false, evidenceTypes: ["audit-report", "monitoring"] },
];

const SOC2: FrameworkDefinition = {
  id: "soc2-2017",
  name: "SOC 2 Type II",
  shortName: "SOC 2",
  version: "TSC 2017 (rev 2022)",
  family: "security",
  description: "AICPA Trust Services Criteria across Security, Availability, Confidentiality, Processing Integrity, and Privacy.",
  publishedBy: "AICPA",
  totalControls: 64,
  domains: [
    { id: "common-criteria", name: "Security (Common Criteria)", controlCount: 31 },
    { id: "availability", name: "Availability", controlCount: 3 },
    { id: "confidentiality", name: "Confidentiality", controlCount: 2 },
    { id: "processing-integrity", name: "Processing Integrity", controlCount: 2 },
    { id: "privacy", name: "Privacy", controlCount: 8 },
  ],
  controls: SOC2_CONTROLS,
};

// ---------------------------------------------------------------------------
// HIPAA Security Rule — Administrative (9), Physical (4), Technical (5) safeguards
// 54 implementation specifications. Fully enumerated.
// ---------------------------------------------------------------------------

const HIPAA_CONTROLS: ControlDefinition[] = [
  // Administrative §164.308
  { id: "HIPAA-164.308(a)(1)(i)", ref: "164.308(a)(1)(i)", title: "Security Management Process", description: "Implement policies and procedures to prevent, detect, contain, and correct security violations.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.308(a)(1)(ii)(A)", ref: "164.308(a)(1)(ii)(A)", title: "Risk Analysis", description: "Conduct an accurate and thorough risk assessment.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["risk-assessment"] },
  { id: "HIPAA-164.308(a)(1)(ii)(B)", ref: "164.308(a)(1)(ii)(B)", title: "Risk Management", description: "Implement security measures sufficient to reduce risks.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["risk-register", "policy"] },
  { id: "HIPAA-164.308(a)(1)(ii)(C)", ref: "164.308(a)(1)(ii)(C)", title: "Sanction Policy", description: "Apply appropriate sanctions against workforce members.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.308(a)(1)(ii)(D)", ref: "164.308(a)(1)(ii)(D)", title: "Information System Activity Review", description: "Implement procedures to regularly review system activity.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["log", "review-record"] },
  { id: "HIPAA-164.308(a)(2)", ref: "164.308(a)(2)", title: "Assigned Security Responsibility", description: "Identify the security official responsible.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["org-chart", "policy"] },
  { id: "HIPAA-164.308(a)(3)(i)", ref: "164.308(a)(3)(i)", title: "Workforce Security", description: "Implement policies to ensure all workforce members have appropriate access.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.308(a)(3)(ii)(A)", ref: "164.308(a)(3)(ii)(A)", title: "Authorization and/or Supervision", description: "Implement procedures for authorization or supervision.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["procedure"] },
  { id: "HIPAA-164.308(a)(3)(ii)(B)", ref: "164.308(a)(3)(ii)(B)", title: "Workforce Clearance Procedure", description: "Implement procedures to determine access appropriateness.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["background-check", "procedure"] },
  { id: "HIPAA-164.308(a)(3)(ii)(C)", ref: "164.308(a)(3)(ii)(C)", title: "Termination Procedures", description: "Implement procedures for terminating access.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["procedure", "log"] },
  { id: "HIPAA-164.308(a)(4)(i)", ref: "164.308(a)(4)(i)", title: "Information Access Management", description: "Implement policies for authorizing access to ePHI.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.308(a)(4)(ii)(A)", ref: "164.308(a)(4)(ii)(A)", title: "Isolating Health Care Clearinghouse Functions", description: "Isolate ePHI from larger organization.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["architecture-diagram"] },
  { id: "HIPAA-164.308(a)(4)(ii)(B)", ref: "164.308(a)(4)(ii)(B)", title: "Access Authorization", description: "Procedures for granting access.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["procedure"] },
  { id: "HIPAA-164.308(a)(4)(ii)(C)", ref: "164.308(a)(4)(ii)(C)", title: "Access Establishment and Modification", description: "Procedures to establish, document, review, and modify access.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["procedure", "review-record"] },
  { id: "HIPAA-164.308(a)(5)(i)", ref: "164.308(a)(5)(i)", title: "Security Awareness and Training", description: "Security awareness and training program.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["training-record"] },
  { id: "HIPAA-164.308(a)(5)(ii)(A)", ref: "164.308(a)(5)(ii)(A)", title: "Security Reminders", description: "Periodic security updates.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["communication"] },
  { id: "HIPAA-164.308(a)(5)(ii)(B)", ref: "164.308(a)(5)(ii)(B)", title: "Protection from Malicious Software", description: "Procedures for guarding against malware.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["edr-report", "policy"] },
  { id: "HIPAA-164.308(a)(5)(ii)(C)", ref: "164.308(a)(5)(ii)(C)", title: "Log-in Monitoring", description: "Monitor log-in attempts.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["log", "monitoring"] },
  { id: "HIPAA-164.308(a)(5)(ii)(D)", ref: "164.308(a)(5)(ii)(D)", title: "Password Management", description: "Procedures for password management.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["policy", "config"] },
  { id: "HIPAA-164.308(a)(6)(i)", ref: "164.308(a)(6)(i)", title: "Security Incident Procedures", description: "Procedures to address security incidents.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.308(a)(6)(ii)", ref: "164.308(a)(6)(ii)", title: "Response and Reporting", description: "Identify and respond to suspected incidents.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["runbook", "ticket"] },
  { id: "HIPAA-164.308(a)(7)(i)", ref: "164.308(a)(7)(i)", title: "Contingency Plan", description: "Establish and implement contingency plans.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["plan"] },
  { id: "HIPAA-164.308(a)(7)(ii)(A)", ref: "164.308(a)(7)(ii)(A)", title: "Data Backup Plan", description: "Establish procedures for backup of ePHI.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["backup-log"] },
  { id: "HIPAA-164.308(a)(7)(ii)(B)", ref: "164.308(a)(7)(ii)(B)", title: "Disaster Recovery Plan", description: "Establish procedures to restore lost data.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["plan", "test-result"] },
  { id: "HIPAA-164.308(a)(7)(ii)(C)", ref: "164.308(a)(7)(ii)(C)", title: "Emergency Mode Operation Plan", description: "Establish procedures for emergency mode operations.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["plan"] },
  { id: "HIPAA-164.308(a)(7)(ii)(D)", ref: "164.308(a)(7)(ii)(D)", title: "Testing and Revision Procedures", description: "Procedures for periodic testing.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["test-result"] },
  { id: "HIPAA-164.308(a)(7)(ii)(E)", ref: "164.308(a)(7)(ii)(E)", title: "Applications and Data Criticality Analysis", description: "Assess criticality.", domain: "Administrative", category: "Addressable", required: false, evidenceTypes: ["assessment"] },
  { id: "HIPAA-164.308(a)(8)", ref: "164.308(a)(8)", title: "Evaluation", description: "Perform periodic technical and nontechnical evaluation.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["audit-report"] },
  { id: "HIPAA-164.308(b)(1)", ref: "164.308(b)(1)", title: "Business Associate Contracts", description: "Obtain assurances from business associates.", domain: "Administrative", category: "Standard", required: true, evidenceTypes: ["contract"] },
  { id: "HIPAA-164.308(b)(4)", ref: "164.308(b)(4)", title: "Written Contract or Other Arrangement", description: "Document satisfactory assurances through written contract.", domain: "Administrative", category: "Required", required: true, evidenceTypes: ["contract"] },

  // Physical §164.310
  { id: "HIPAA-164.310(a)(1)", ref: "164.310(a)(1)", title: "Facility Access Controls", description: "Limit physical access to electronic info systems.", domain: "Physical", category: "Standard", required: true, evidenceTypes: ["policy", "access-log"] },
  { id: "HIPAA-164.310(a)(2)(i)", ref: "164.310(a)(2)(i)", title: "Contingency Operations", description: "Procedures to allow facility access during emergencies.", domain: "Physical", category: "Addressable", required: false, evidenceTypes: ["procedure"] },
  { id: "HIPAA-164.310(a)(2)(ii)", ref: "164.310(a)(2)(ii)", title: "Facility Security Plan", description: "Protect facility and equipment from unauthorized access.", domain: "Physical", category: "Addressable", required: false, evidenceTypes: ["plan"] },
  { id: "HIPAA-164.310(a)(2)(iii)", ref: "164.310(a)(2)(iii)", title: "Access Control and Validation Procedures", description: "Procedures to control and validate access.", domain: "Physical", category: "Addressable", required: false, evidenceTypes: ["procedure"] },
  { id: "HIPAA-164.310(a)(2)(iv)", ref: "164.310(a)(2)(iv)", title: "Maintenance Records", description: "Document repairs and modifications.", domain: "Physical", category: "Addressable", required: false, evidenceTypes: ["maintenance-log"] },
  { id: "HIPAA-164.310(b)", ref: "164.310(b)", title: "Workstation Use", description: "Specify proper functions of workstations.", domain: "Physical", category: "Standard", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.310(c)", ref: "164.310(c)", title: "Workstation Security", description: "Implement physical safeguards for workstations.", domain: "Physical", category: "Standard", required: true, evidenceTypes: ["policy", "config"] },
  { id: "HIPAA-164.310(d)(1)", ref: "164.310(d)(1)", title: "Device and Media Controls", description: "Govern receipt and removal of hardware/media.", domain: "Physical", category: "Standard", required: true, evidenceTypes: ["policy"] },
  { id: "HIPAA-164.310(d)(2)(i)", ref: "164.310(d)(2)(i)", title: "Disposal", description: "Address disposal of ePHI media.", domain: "Physical", category: "Required", required: true, evidenceTypes: ["procedure", "certificate"] },
  { id: "HIPAA-164.310(d)(2)(ii)", ref: "164.310(d)(2)(ii)", title: "Media Re-use", description: "Procedures for removal of ePHI before re-use.", domain: "Physical", category: "Required", required: true, evidenceTypes: ["procedure", "log"] },
  { id: "HIPAA-164.310(d)(2)(iii)", ref: "164.310(d)(2)(iii)", title: "Accountability", description: "Maintain record of movements of hardware/media.", domain: "Physical", category: "Addressable", required: false, evidenceTypes: ["inventory", "log"] },
  { id: "HIPAA-164.310(d)(2)(iv)", ref: "164.310(d)(2)(iv)", title: "Data Backup and Storage", description: "Create retrievable, exact copy of ePHI before equipment moves.", domain: "Physical", category: "Addressable", required: false, evidenceTypes: ["backup-log"] },

  // Technical §164.312
  { id: "HIPAA-164.312(a)(1)", ref: "164.312(a)(1)", title: "Access Control", description: "Technical policies to allow access only to authorized.", domain: "Technical", category: "Standard", required: true, evidenceTypes: ["iam-config", "policy"] },
  { id: "HIPAA-164.312(a)(2)(i)", ref: "164.312(a)(2)(i)", title: "Unique User Identification", description: "Assign unique name/number for identifying users.", domain: "Technical", category: "Required", required: true, evidenceTypes: ["iam-config"] },
  { id: "HIPAA-164.312(a)(2)(ii)", ref: "164.312(a)(2)(ii)", title: "Emergency Access Procedure", description: "Procedures for obtaining ePHI during emergency.", domain: "Technical", category: "Required", required: true, evidenceTypes: ["procedure"] },
  { id: "HIPAA-164.312(a)(2)(iii)", ref: "164.312(a)(2)(iii)", title: "Automatic Logoff", description: "Terminate session after inactivity.", domain: "Technical", category: "Addressable", required: false, evidenceTypes: ["config"] },
  { id: "HIPAA-164.312(a)(2)(iv)", ref: "164.312(a)(2)(iv)", title: "Encryption and Decryption", description: "Mechanism to encrypt and decrypt ePHI.", domain: "Technical", category: "Addressable", required: false, evidenceTypes: ["config", "policy"] },
  { id: "HIPAA-164.312(b)", ref: "164.312(b)", title: "Audit Controls", description: "Implement mechanisms to record and examine activity.", domain: "Technical", category: "Standard", required: true, evidenceTypes: ["log", "config"] },
  { id: "HIPAA-164.312(c)(1)", ref: "164.312(c)(1)", title: "Integrity", description: "Protect ePHI from improper alteration or destruction.", domain: "Technical", category: "Standard", required: true, evidenceTypes: ["config", "policy"] },
  { id: "HIPAA-164.312(c)(2)", ref: "164.312(c)(2)", title: "Mechanism to Authenticate ePHI", description: "Authenticate ePHI integrity.", domain: "Technical", category: "Addressable", required: false, evidenceTypes: ["config", "log"] },
  { id: "HIPAA-164.312(d)", ref: "164.312(d)", title: "Person or Entity Authentication", description: "Verify identity of users seeking access.", domain: "Technical", category: "Standard", required: true, evidenceTypes: ["iam-config", "mfa-config"] },
  { id: "HIPAA-164.312(e)(1)", ref: "164.312(e)(1)", title: "Transmission Security", description: "Guard against unauthorized access during transmission.", domain: "Technical", category: "Standard", required: true, evidenceTypes: ["tls-config", "policy"] },
  { id: "HIPAA-164.312(e)(2)(i)", ref: "164.312(e)(2)(i)", title: "Integrity Controls", description: "Ensure ePHI not modified in transit.", domain: "Technical", category: "Addressable", required: false, evidenceTypes: ["config", "policy"] },
  { id: "HIPAA-164.312(e)(2)(ii)", ref: "164.312(e)(2)(ii)", title: "Encryption", description: "Encrypt ePHI in transit.", domain: "Technical", category: "Addressable", required: false, evidenceTypes: ["config", "policy"] },
];

const HIPAA: FrameworkDefinition = {
  id: "hipaa-security",
  name: "HIPAA Security Rule",
  shortName: "HIPAA",
  version: "45 CFR Part 164",
  family: "privacy",
  description: "U.S. health information security rule covering Administrative, Physical, and Technical safeguards.",
  jurisdiction: "US",
  publishedBy: "HHS",
  totalControls: 54,
  domains: [
    { id: "administrative", name: "Administrative", controlCount: 30 },
    { id: "physical", name: "Physical", controlCount: 12 },
    { id: "technical", name: "Technical", controlCount: 12 },
  ],
  controls: HIPAA_CONTROLS,
};

// ---------------------------------------------------------------------------
// DPDPA 2023 — Digital Personal Data Protection Act, India.
// 18 sections grouped by chapter (Preliminary / Obligations of Data Fiduciary /
// Rights & Duties / Special Provisions / DPB India / Appellate / Penalties / Misc).
// Fully enumerated to the section level.
// ---------------------------------------------------------------------------

const DPDPA_CONTROLS: ControlDefinition[] = [
  { id: "DPDPA-S4", ref: "S.4", title: "Grounds for processing personal data", description: "Process personal data only for lawful purpose with consent or legitimate use.", domain: "Obligations of Data Fiduciary", required: true, evidenceTypes: ["policy", "consent-record"] },
  { id: "DPDPA-S5", ref: "S.5", title: "Notice", description: "Provide clear notice describing personal data and purpose.", domain: "Obligations of Data Fiduciary", required: true, evidenceTypes: ["privacy-notice"] },
  { id: "DPDPA-S6", ref: "S.6", title: "Consent", description: "Consent must be free, specific, informed, unconditional and unambiguous.", domain: "Obligations of Data Fiduciary", required: true, evidenceTypes: ["consent-record", "policy"] },
  { id: "DPDPA-S7", ref: "S.7", title: "Certain legitimate uses", description: "Process for certain legitimate uses without consent.", domain: "Obligations of Data Fiduciary", required: false, evidenceTypes: ["policy", "record"] },
  { id: "DPDPA-S8", ref: "S.8", title: "General obligations of data fiduciary", description: "Implement appropriate technical and organizational measures.", domain: "Obligations of Data Fiduciary", required: true, evidenceTypes: ["policy", "config"] },
  { id: "DPDPA-S9", ref: "S.9", title: "Processing of personal data of children", description: "Obtain verifiable consent of parent before processing child data.", domain: "Obligations of Data Fiduciary", required: true, evidenceTypes: ["consent-record", "policy"] },
  { id: "DPDPA-S10", ref: "S.10", title: "Additional obligations of Significant Data Fiduciary", description: "DPO appointment, DPIA, audit obligations.", domain: "Obligations of Data Fiduciary", required: true, evidenceTypes: ["DPIA", "audit-report", "appointment"] },
  { id: "DPDPA-S11", ref: "S.11", title: "Right to access information", description: "Right to confirmation and access to personal data.", domain: "Rights of Data Principal", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "DPDPA-S12", ref: "S.12", title: "Right to correction and erasure", description: "Right to correction, completion, updating and erasure.", domain: "Rights of Data Principal", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "DPDPA-S13", ref: "S.13", title: "Right of grievance redressal", description: "Right to readily available means of grievance redressal.", domain: "Rights of Data Principal", required: true, evidenceTypes: ["procedure", "policy"] },
  { id: "DPDPA-S14", ref: "S.14", title: "Right to nominate", description: "Right to nominate any other individual in event of death/incapacity.", domain: "Rights of Data Principal", required: true, evidenceTypes: ["procedure"] },
  { id: "DPDPA-S15", ref: "S.15", title: "Duties of data principal", description: "Duty to comply with applicable law and not file false complaints.", domain: "Duties of Data Principal", required: true, evidenceTypes: ["policy"] },
  { id: "DPDPA-S16", ref: "S.16", title: "Processing outside India", description: "Central Government may restrict transfer to certain countries.", domain: "Special Provisions", required: true, evidenceTypes: ["policy", "register"] },
  { id: "DPDPA-S17", ref: "S.17", title: "Exemptions", description: "Exemptions for state, research, statistical purposes.", domain: "Special Provisions", required: false, evidenceTypes: ["policy"] },
  { id: "DPDPA-S18", ref: "S.18", title: "Data Protection Board of India", description: "Establishment of the Data Protection Board.", domain: "Data Protection Board", required: true, evidenceTypes: ["register"] },
  { id: "DPDPA-S25", ref: "S.25", title: "Appellate Tribunal", description: "Appeals from orders of the Board.", domain: "Appellate", required: false, evidenceTypes: ["register"] },
  { id: "DPDPA-S33", ref: "S.33", title: "Penalties for breach", description: "Financial penalties up to INR 250 crore.", domain: "Penalties", required: true, evidenceTypes: ["policy", "record"] },
  { id: "DPDPA-S37", ref: "S.37", title: "Power to call for information", description: "Central Government power to call for information.", domain: "Miscellaneous", required: true, evidenceTypes: ["procedure"] },
];

const DPDPA: FrameworkDefinition = {
  id: "dpdpa-2023",
  name: "Digital Personal Data Protection Act, 2023",
  shortName: "DPDPA",
  version: "2023",
  family: "privacy",
  description: "India's Digital Personal Data Protection Act covering obligations of data fiduciaries, rights and duties of data principals, and cross-border transfers.",
  jurisdiction: "IN",
  publishedBy: "MeitY (Government of India)",
  totalControls: 18,
  domains: [
    { id: "obligations", name: "Obligations of Data Fiduciary", controlCount: 7 },
    { id: "rights", name: "Rights of Data Principal", controlCount: 4 },
    { id: "duties", name: "Duties of Data Principal", controlCount: 1 },
    { id: "special", name: "Special Provisions", controlCount: 2 },
    { id: "board", name: "Data Protection Board", controlCount: 1 },
    { id: "appellate", name: "Appellate", controlCount: 1 },
    { id: "penalties", name: "Penalties", controlCount: 1 },
    { id: "misc", name: "Miscellaneous", controlCount: 1 },
  ],
  controls: DPDPA_CONTROLS,
};

// ---------------------------------------------------------------------------
// PCI-DSS v4.0.1 — 12 requirements, ~277 sub-requirements.
// REGISTRY SAMPLE: representative across all 12 requirements.
// ---------------------------------------------------------------------------

const PCI_DSS_CONTROLS: ControlDefinition[] = [
  { id: "PCI-DSS-1.1", ref: "1.1", title: "Network security controls (NSC) governance", description: "Processes and mechanisms for installing and maintaining NSCs.", domain: "Build and Maintain a Secure Network", category: "Req 1", required: true, evidenceTypes: ["policy", "config"] },
  { id: "PCI-DSS-1.2", ref: "1.2", title: "Network security controls configuration", description: "NSCs are configured and maintained.", domain: "Build and Maintain a Secure Network", category: "Req 1", required: true, evidenceTypes: ["firewall-config"] },
  { id: "PCI-DSS-1.3", ref: "1.3", title: "Restrict network access to/from CDE", description: "Restrict inbound and outbound traffic to cardholder data environment.", domain: "Build and Maintain a Secure Network", category: "Req 1", required: true, evidenceTypes: ["firewall-config", "diagram"] },
  { id: "PCI-DSS-2.1", ref: "2.1", title: "Configuration standards", description: "Apply secure configurations to all system components.", domain: "Build and Maintain a Secure Network", category: "Req 2", required: true, evidenceTypes: ["baseline", "config"] },
  { id: "PCI-DSS-2.2", ref: "2.2", title: "Vendor default removal", description: "Change vendor defaults before installing on network.", domain: "Build and Maintain a Secure Network", category: "Req 2", required: true, evidenceTypes: ["config", "checklist"] },
  { id: "PCI-DSS-3.1", ref: "3.1", title: "Stored account data protection", description: "Protect stored account data.", domain: "Protect Account Data", category: "Req 3", required: true, evidenceTypes: ["config", "policy"] },
  { id: "PCI-DSS-3.5", ref: "3.5", title: "PAN unreadable", description: "PAN rendered unreadable wherever stored.", domain: "Protect Account Data", category: "Req 3", required: true, evidenceTypes: ["config", "encryption"] },
  { id: "PCI-DSS-4.1", ref: "4.1", title: "Strong cryptography in transmission", description: "Protect cardholder data with strong cryptography during transmission over open public networks.", domain: "Protect Account Data", category: "Req 4", required: true, evidenceTypes: ["tls-config"] },
  { id: "PCI-DSS-5.1", ref: "5.1", title: "Anti-malware mechanisms", description: "Protect all systems against malware.", domain: "Maintain a Vulnerability Management Program", category: "Req 5", required: true, evidenceTypes: ["edr-report"] },
  { id: "PCI-DSS-6.1", ref: "6.1", title: "Secure software development", description: "Develop and maintain secure systems and software.", domain: "Maintain a Vulnerability Management Program", category: "Req 6", required: true, evidenceTypes: ["sast-report", "policy"] },
  { id: "PCI-DSS-6.3", ref: "6.3", title: "Vulnerability identification", description: "Security vulnerabilities are identified and addressed.", domain: "Maintain a Vulnerability Management Program", category: "Req 6", required: true, evidenceTypes: ["scan-report", "patch-record"] },
  { id: "PCI-DSS-7.1", ref: "7.1", title: "Access restriction", description: "Restrict access to system components and cardholder data by business need.", domain: "Implement Strong Access Control", category: "Req 7", required: true, evidenceTypes: ["access-matrix", "iam-config"] },
  { id: "PCI-DSS-8.1", ref: "8.1", title: "Identify users and authenticate access", description: "Identify users and authenticate access to system components.", domain: "Implement Strong Access Control", category: "Req 8", required: true, evidenceTypes: ["iam-config", "mfa-config"] },
  { id: "PCI-DSS-8.3", ref: "8.3", title: "Strong authentication for users", description: "Strong authentication for users and admins.", domain: "Implement Strong Access Control", category: "Req 8", required: true, evidenceTypes: ["mfa-config"] },
  { id: "PCI-DSS-9.1", ref: "9.1", title: "Physical access to CDE", description: "Restrict physical access to CDE.", domain: "Implement Strong Access Control", category: "Req 9", required: true, evidenceTypes: ["access-log", "cctv-log"] },
  { id: "PCI-DSS-10.1", ref: "10.1", title: "Audit log of all access", description: "Log and monitor all access to system components and cardholder data.", domain: "Regularly Monitor and Test Networks", category: "Req 10", required: true, evidenceTypes: ["log", "siem-config"] },
  { id: "PCI-DSS-10.2", ref: "10.2", title: "Audit logs capture relevant events", description: "Audit logs capture key events.", domain: "Regularly Monitor and Test Networks", category: "Req 10", required: true, evidenceTypes: ["log"] },
  { id: "PCI-DSS-11.3", ref: "11.3", title: "External and internal vulnerability scans", description: "Quarterly external scans and post-change scans.", domain: "Regularly Monitor and Test Networks", category: "Req 11", required: true, evidenceTypes: ["scan-report"] },
  { id: "PCI-DSS-11.4", ref: "11.4", title: "Penetration testing", description: "Annual internal and external penetration testing.", domain: "Regularly Monitor and Test Networks", category: "Req 11", required: true, evidenceTypes: ["pentest-report"] },
  { id: "PCI-DSS-12.1", ref: "12.1", title: "Information security policy", description: "Maintain a comprehensive information security policy.", domain: "Information Security Policy", category: "Req 12", required: true, evidenceTypes: ["policy"] },
  { id: "PCI-DSS-12.6", ref: "12.6", title: "Security awareness program", description: "Formal security awareness program.", domain: "Information Security Policy", category: "Req 12", required: true, evidenceTypes: ["training-record"] },
  { id: "PCI-DSS-12.10", ref: "12.10", title: "Incident response plan", description: "Implement an incident response plan.", domain: "Information Security Policy", category: "Req 12", required: true, evidenceTypes: ["plan", "test-result"] },
];

const PCI_DSS: FrameworkDefinition = {
  id: "pci-dss-v4.0.1",
  name: "PCI-DSS v4.0.1",
  shortName: "PCI-DSS",
  version: "4.0.1",
  family: "industry",
  description: "Payment Card Industry Data Security Standard. 12 requirements, ~277 sub-requirements. REGISTRY SAMPLE — totalControls reflects real count; controls[] is curated representative subset.",
  publishedBy: "PCI Security Standards Council",
  totalControls: 277,
  domains: [
    { id: "secure-network", name: "Build and Maintain a Secure Network", controlCount: 5 },
    { id: "protect-data", name: "Protect Account Data", controlCount: 3 },
    { id: "vuln-mgmt", name: "Maintain a Vulnerability Management Program", controlCount: 3 },
    { id: "access-control", name: "Implement Strong Access Control", controlCount: 4 },
    { id: "monitor-test", name: "Regularly Monitor and Test Networks", controlCount: 4 },
    { id: "policy", name: "Information Security Policy", controlCount: 3 },
  ],
  controls: PCI_DSS_CONTROLS,
};

// ---------------------------------------------------------------------------
// NIST 800-53 r5 — 20 control families, 1189 controls.
// REGISTRY SAMPLE: representative across all 20 families.
// ---------------------------------------------------------------------------

const NIST_800_53_CONTROLS: ControlDefinition[] = [
  { id: "NIST-800-53-AC-1", ref: "AC-1", title: "Policy and Procedures", description: "Develop, document, disseminate access control policy and procedures.", domain: "Access Control (AC)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-AC-2", ref: "AC-2", title: "Account Management", description: "Manage information system accounts.", domain: "Access Control (AC)", required: true, evidenceTypes: ["iam-config", "procedure"] },
  { id: "NIST-800-53-AC-3", ref: "AC-3", title: "Access Enforcement", description: "Enforce approved authorizations for logical access.", domain: "Access Control (AC)", required: true, evidenceTypes: ["config"] },
  { id: "NIST-800-53-AT-1", ref: "AT-1", title: "Awareness Training Policy and Procedures", description: "Establish awareness and training policy.", domain: "Awareness and Training (AT)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-AT-2", ref: "AT-2", title: "Literacy Training and Awareness", description: "Provide security and privacy literacy training.", domain: "Awareness and Training (AT)", required: true, evidenceTypes: ["training-record"] },
  { id: "NIST-800-53-AU-1", ref: "AU-1", title: "Audit and Accountability Policy", description: "Establish audit policy.", domain: "Audit and Accountability (AU)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-AU-2", ref: "AU-2", title: "Event Logging", description: "Identify the types of events to be logged.", domain: "Audit and Accountability (AU)", required: true, evidenceTypes: ["config", "log"] },
  { id: "NIST-800-53-AU-6", ref: "AU-6", title: "Audit Record Review", description: "Review and analyze audit records.", domain: "Audit and Accountability (AU)", required: true, evidenceTypes: ["report", "log"] },
  { id: "NIST-800-53-CA-1", ref: "CA-1", title: "Assessment, Authorization, and Monitoring Policy", description: "Establish CA policy.", domain: "Assessment, Authorization, Monitoring (CA)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-CA-2", ref: "CA-2", title: "Control Assessments", description: "Develop and approve control assessment plans.", domain: "Assessment, Authorization, Monitoring (CA)", required: true, evidenceTypes: ["assessment", "plan"] },
  { id: "NIST-800-53-CM-1", ref: "CM-1", title: "Configuration Management Policy", description: "Establish CM policy.", domain: "Configuration Management (CM)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-CM-2", ref: "CM-2", title: "Baseline Configuration", description: "Develop and maintain baseline configurations.", domain: "Configuration Management (CM)", required: true, evidenceTypes: ["baseline", "config"] },
  { id: "NIST-800-53-CP-1", ref: "CP-1", title: "Contingency Planning Policy", description: "Establish CP policy.", domain: "Contingency Planning (CP)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-CP-2", ref: "CP-2", title: "Contingency Plan", description: "Develop and implement contingency plan.", domain: "Contingency Planning (CP)", required: true, evidenceTypes: ["plan"] },
  { id: "NIST-800-53-IA-1", ref: "IA-1", title: "Identification and Authentication Policy", description: "Establish IA policy.", domain: "Identification and Authentication (IA)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-IA-2", ref: "IA-2", title: "Identification and Authentication (Org Users)", description: "Uniquely identify and authenticate users.", domain: "Identification and Authentication (IA)", required: true, evidenceTypes: ["iam-config", "mfa-config"] },
  { id: "NIST-800-53-IR-1", ref: "IR-1", title: "Incident Response Policy", description: "Establish IR policy.", domain: "Incident Response (IR)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-IR-4", ref: "IR-4", title: "Incident Handling", description: "Implement incident handling capability.", domain: "Incident Response (IR)", required: true, evidenceTypes: ["runbook", "ticket"] },
  { id: "NIST-800-53-MA-1", ref: "MA-1", title: "System Maintenance Policy", description: "Establish maintenance policy.", domain: "Maintenance (MA)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-MA-2", ref: "MA-2", title: "Controlled Maintenance", description: "Schedule and document maintenance.", domain: "Maintenance (MA)", required: true, evidenceTypes: ["maintenance-log"] },
  { id: "NIST-800-53-MP-1", ref: "MP-1", title: "Media Protection Policy", description: "Establish media protection policy.", domain: "Media Protection (MP)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-MP-6", ref: "MP-6", title: "Media Sanitization", description: "Sanitize media prior to disposal.", domain: "Media Protection (MP)", required: true, evidenceTypes: ["procedure", "certificate"] },
  { id: "NIST-800-53-PE-1", ref: "PE-1", title: "Physical and Environmental Protection Policy", description: "Establish PE policy.", domain: "Physical and Environmental (PE)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-PE-3", ref: "PE-3", title: "Physical Access Control", description: "Enforce physical access authorizations.", domain: "Physical and Environmental (PE)", required: true, evidenceTypes: ["access-log"] },
  { id: "NIST-800-53-PL-1", ref: "PL-1", title: "Planning Policy", description: "Establish planning policy.", domain: "Planning (PL)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-PL-2", ref: "PL-2", title: "System Security and Privacy Plans", description: "Develop and maintain SSP.", domain: "Planning (PL)", required: true, evidenceTypes: ["plan"] },
  { id: "NIST-800-53-PS-1", ref: "PS-1", title: "Personnel Security Policy", description: "Establish PS policy.", domain: "Personnel Security (PS)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-PS-3", ref: "PS-3", title: "Personnel Screening", description: "Screen individuals prior to access.", domain: "Personnel Security (PS)", required: true, evidenceTypes: ["background-check"] },
  { id: "NIST-800-53-RA-1", ref: "RA-1", title: "Risk Assessment Policy", description: "Establish RA policy.", domain: "Risk Assessment (RA)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-RA-5", ref: "RA-5", title: "Vulnerability Monitoring and Scanning", description: "Monitor and scan for vulnerabilities.", domain: "Risk Assessment (RA)", required: true, evidenceTypes: ["scan-report"] },
  { id: "NIST-800-53-SA-1", ref: "SA-1", title: "System and Services Acquisition Policy", description: "Establish SA policy.", domain: "System and Services Acquisition (SA)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-SA-11", ref: "SA-11", title: "Developer Testing and Evaluation", description: "Developer to perform security testing.", domain: "System and Services Acquisition (SA)", required: true, evidenceTypes: ["test-result"] },
  { id: "NIST-800-53-SC-1", ref: "SC-1", title: "System and Communications Protection Policy", description: "Establish SC policy.", domain: "System and Communications Protection (SC)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-SC-7", ref: "SC-7", title: "Boundary Protection", description: "Monitor and control communications at boundaries.", domain: "System and Communications Protection (SC)", required: true, evidenceTypes: ["firewall-config"] },
  { id: "NIST-800-53-SC-12", ref: "SC-12", title: "Cryptographic Key Establishment", description: "Establish and manage cryptographic keys.", domain: "System and Communications Protection (SC)", required: true, evidenceTypes: ["kms-config"] },
  { id: "NIST-800-53-SI-1", ref: "SI-1", title: "System and Information Integrity Policy", description: "Establish SI policy.", domain: "System and Information Integrity (SI)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-SI-2", ref: "SI-2", title: "Flaw Remediation", description: "Identify, report and correct flaws.", domain: "System and Information Integrity (SI)", required: true, evidenceTypes: ["patch-record"] },
  { id: "NIST-800-53-SI-4", ref: "SI-4", title: "System Monitoring", description: "Monitor systems for attacks.", domain: "System and Information Integrity (SI)", required: true, evidenceTypes: ["monitoring"] },
  { id: "NIST-800-53-PM-1", ref: "PM-1", title: "Information Security Program Plan", description: "Develop and maintain ISPP.", domain: "Program Management (PM)", required: true, evidenceTypes: ["plan"] },
  { id: "NIST-800-53-PT-1", ref: "PT-1", title: "Personally Identifiable Information Processing Policy", description: "Establish PT policy.", domain: "PII Processing and Transparency (PT)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-SR-1", ref: "SR-1", title: "Supply Chain Risk Management Policy", description: "Establish SR policy.", domain: "Supply Chain Risk Management (SR)", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-800-53-SR-3", ref: "SR-3", title: "Supply Chain Controls and Processes", description: "Establish supply chain controls.", domain: "Supply Chain Risk Management (SR)", required: true, evidenceTypes: ["policy", "vendor-assessment"] },
];

const NIST_800_53: FrameworkDefinition = {
  id: "nist-800-53-r5",
  name: "NIST SP 800-53 Rev. 5",
  shortName: "NIST 800-53",
  version: "Rev. 5",
  family: "security",
  description: "Security and Privacy Controls for Information Systems and Organizations. 20 families, 1189 controls. REGISTRY SAMPLE — totalControls reflects real count; controls[] is curated representative subset.",
  jurisdiction: "US",
  publishedBy: "NIST",
  totalControls: 1189,
  domains: [
    { id: "AC", name: "Access Control (AC)", controlCount: 3 },
    { id: "AT", name: "Awareness and Training (AT)", controlCount: 2 },
    { id: "AU", name: "Audit and Accountability (AU)", controlCount: 3 },
    { id: "CA", name: "Assessment, Authorization, Monitoring (CA)", controlCount: 2 },
    { id: "CM", name: "Configuration Management (CM)", controlCount: 2 },
    { id: "CP", name: "Contingency Planning (CP)", controlCount: 2 },
    { id: "IA", name: "Identification and Authentication (IA)", controlCount: 2 },
    { id: "IR", name: "Incident Response (IR)", controlCount: 2 },
    { id: "MA", name: "Maintenance (MA)", controlCount: 2 },
    { id: "MP", name: "Media Protection (MP)", controlCount: 2 },
    { id: "PE", name: "Physical and Environmental (PE)", controlCount: 2 },
    { id: "PL", name: "Planning (PL)", controlCount: 2 },
    { id: "PS", name: "Personnel Security (PS)", controlCount: 2 },
    { id: "RA", name: "Risk Assessment (RA)", controlCount: 2 },
    { id: "SA", name: "System and Services Acquisition (SA)", controlCount: 2 },
    { id: "SC", name: "System and Communications Protection (SC)", controlCount: 3 },
    { id: "SI", name: "System and Information Integrity (SI)", controlCount: 3 },
    { id: "PM", name: "Program Management (PM)", controlCount: 1 },
    { id: "PT", name: "PII Processing and Transparency (PT)", controlCount: 1 },
    { id: "SR", name: "Supply Chain Risk Management (SR)", controlCount: 2 },
  ],
  controls: NIST_800_53_CONTROLS,
};

// ---------------------------------------------------------------------------
// NIST CSF 2.0 — 6 functions, 22 categories, 106 subcategories.
// REGISTRY SAMPLE: representative across all 6 functions and 22 categories.
// ---------------------------------------------------------------------------

const NIST_CSF_CONTROLS: ControlDefinition[] = [
  // Govern (GV) — 6 categories
  { id: "NIST-CSF-GV.OC", ref: "GV.OC", title: "Organizational Context", description: "Mission, stakeholder expectations, and dependencies are understood.", domain: "Govern", category: "GV.OC", required: true, evidenceTypes: ["policy", "context-doc"] },
  { id: "NIST-CSF-GV.RM", ref: "GV.RM", title: "Risk Management Strategy", description: "Risk management priorities are established.", domain: "Govern", category: "GV.RM", required: true, evidenceTypes: ["policy", "risk-register"] },
  { id: "NIST-CSF-GV.RR", ref: "GV.RR", title: "Roles, Responsibilities, Authorities", description: "Roles and responsibilities for cyber risk are established.", domain: "Govern", category: "GV.RR", required: true, evidenceTypes: ["org-chart", "policy"] },
  { id: "NIST-CSF-GV.PO", ref: "GV.PO", title: "Policy", description: "Policies for managing cyber risk are established.", domain: "Govern", category: "GV.PO", required: true, evidenceTypes: ["policy"] },
  { id: "NIST-CSF-GV.OV", ref: "GV.OV", title: "Oversight", description: "Outcomes of risk management activities are reviewed.", domain: "Govern", category: "GV.OV", required: true, evidenceTypes: ["board-minutes", "report"] },
  { id: "NIST-CSF-GV.SC", ref: "GV.SC", title: "Cybersecurity Supply Chain Risk Management", description: "Manage supply chain risks.", domain: "Govern", category: "GV.SC", required: true, evidenceTypes: ["policy", "vendor-assessment"] },
  // Identify (ID) — 3 categories
  { id: "NIST-CSF-ID.AM", ref: "ID.AM", title: "Asset Management", description: "Identify assets consistent with risk strategy.", domain: "Identify", category: "ID.AM", required: true, evidenceTypes: ["inventory"] },
  { id: "NIST-CSF-ID.RA", ref: "ID.RA", title: "Risk Assessment", description: "Assess cyber risk.", domain: "Identify", category: "ID.RA", required: true, evidenceTypes: ["risk-assessment"] },
  { id: "NIST-CSF-ID.IM", ref: "ID.IM", title: "Improvement", description: "Improvements are identified.", domain: "Identify", category: "ID.IM", required: true, evidenceTypes: ["report", "review"] },
  // Protect (PR) — 5 categories
  { id: "NIST-CSF-PR.AA", ref: "PR.AA", title: "Identity Management, Authentication, Access Control", description: "Manage identity and access.", domain: "Protect", category: "PR.AA", required: true, evidenceTypes: ["iam-config"] },
  { id: "NIST-CSF-PR.AT", ref: "PR.AT", title: "Awareness and Training", description: "Provide awareness training.", domain: "Protect", category: "PR.AT", required: true, evidenceTypes: ["training-record"] },
  { id: "NIST-CSF-PR.DS", ref: "PR.DS", title: "Data Security", description: "Manage data consistent with risk strategy.", domain: "Protect", category: "PR.DS", required: true, evidenceTypes: ["config", "policy"] },
  { id: "NIST-CSF-PR.PS", ref: "PR.PS", title: "Platform Security", description: "Manage platforms consistent with risk strategy.", domain: "Protect", category: "PR.PS", required: true, evidenceTypes: ["config", "baseline"] },
  { id: "NIST-CSF-PR.IR", ref: "PR.IR", title: "Technology Infrastructure Resilience", description: "Manage infrastructure for resilience.", domain: "Protect", category: "PR.IR", required: true, evidenceTypes: ["plan", "config"] },
  // Detect (DE) — 2 categories
  { id: "NIST-CSF-DE.CM", ref: "DE.CM", title: "Continuous Monitoring", description: "Monitor for anomalous events.", domain: "Detect", category: "DE.CM", required: true, evidenceTypes: ["monitoring", "log"] },
  { id: "NIST-CSF-DE.AE", ref: "DE.AE", title: "Adverse Event Analysis", description: "Analyze events to understand impact.", domain: "Detect", category: "DE.AE", required: true, evidenceTypes: ["soc-report", "log"] },
  // Respond (RS) — 4 categories
  { id: "NIST-CSF-RS.MA", ref: "RS.MA", title: "Incident Management", description: "Manage cybersecurity incidents.", domain: "Respond", category: "RS.MA", required: true, evidenceTypes: ["runbook", "ticket"] },
  { id: "NIST-CSF-RS.AN", ref: "RS.AN", title: "Incident Analysis", description: "Analyze incidents to support response.", domain: "Respond", category: "RS.AN", required: true, evidenceTypes: ["report"] },
  { id: "NIST-CSF-RS.CO", ref: "RS.CO", title: "Incident Response Reporting and Communication", description: "Coordinate response activities.", domain: "Respond", category: "RS.CO", required: true, evidenceTypes: ["communication", "notice"] },
  { id: "NIST-CSF-RS.MI", ref: "RS.MI", title: "Incident Mitigation", description: "Contain and eradicate incidents.", domain: "Respond", category: "RS.MI", required: true, evidenceTypes: ["runbook"] },
  // Recover (RC) — 2 categories
  { id: "NIST-CSF-RC.RP", ref: "RC.RP", title: "Incident Recovery Plan Execution", description: "Restore systems affected by incident.", domain: "Recover", category: "RC.RP", required: true, evidenceTypes: ["plan", "post-incident-review"] },
  { id: "NIST-CSF-RC.CO", ref: "RC.CO", title: "Incident Recovery Communication", description: "Coordinate restoration with internal/external parties.", domain: "Recover", category: "RC.CO", required: true, evidenceTypes: ["communication"] },
];

const NIST_CSF: FrameworkDefinition = {
  id: "nist-csf-2.0",
  name: "NIST Cybersecurity Framework 2.0",
  shortName: "NIST CSF",
  version: "2.0",
  family: "security",
  description: "Voluntary framework of cybersecurity outcomes. 6 functions, 22 categories, 106 subcategories. REGISTRY SAMPLE — totalControls reflects real count; controls[] covers all categories.",
  publishedBy: "NIST",
  totalControls: 106,
  domains: [
    { id: "govern", name: "Govern", controlCount: 6 },
    { id: "identify", name: "Identify", controlCount: 3 },
    { id: "protect", name: "Protect", controlCount: 5 },
    { id: "detect", name: "Detect", controlCount: 2 },
    { id: "respond", name: "Respond", controlCount: 4 },
    { id: "recover", name: "Recover", controlCount: 2 },
  ],
  controls: NIST_CSF_CONTROLS,
};

// ---------------------------------------------------------------------------
// GDPR — 11 chapters, 99 articles. REGISTRY SAMPLE: key articles mapped to controls.
// ---------------------------------------------------------------------------

const GDPR_CONTROLS: ControlDefinition[] = [
  { id: "GDPR-Art5", ref: "Art.5", title: "Principles relating to processing of personal data", description: "Lawfulness, fairness, transparency; purpose limitation; data minimisation; accuracy; storage limitation; integrity and confidentiality.", domain: "Principles", required: true, evidenceTypes: ["policy"] },
  { id: "GDPR-Art6", ref: "Art.6", title: "Lawfulness of processing", description: "Establish lawful basis for processing.", domain: "Principles", required: true, evidenceTypes: ["policy", "record"] },
  { id: "GDPR-Art7", ref: "Art.7", title: "Conditions for consent", description: "Demonstrate that data subject has consented.", domain: "Principles", required: true, evidenceTypes: ["consent-record"] },
  { id: "GDPR-Art9", ref: "Art.9", title: "Processing of special categories", description: "Processing of special category data is prohibited unless conditions apply.", domain: "Principles", required: true, evidenceTypes: ["policy", "record"] },
  { id: "GDPR-Art13", ref: "Art.13", title: "Information to be provided where personal data are collected", description: "Information provided to data subjects at collection.", domain: "Rights of the Data Subject", required: true, evidenceTypes: ["privacy-notice"] },
  { id: "GDPR-Art15", ref: "Art.15", title: "Right of access by the data subject", description: "Data subject has right to access their data.", domain: "Rights of the Data Subject", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "GDPR-Art16", ref: "Art.16", title: "Right to rectification", description: "Data subject can require correction.", domain: "Rights of the Data Subject", required: true, evidenceTypes: ["procedure"] },
  { id: "GDPR-Art17", ref: "Art.17", title: "Right to erasure", description: "Right to be forgotten.", domain: "Rights of the Data Subject", required: true, evidenceTypes: ["procedure"] },
  { id: "GDPR-Art20", ref: "Art.20", title: "Right to data portability", description: "Right to receive data in portable format.", domain: "Rights of the Data Subject", required: true, evidenceTypes: ["procedure", "export"] },
  { id: "GDPR-Art25", ref: "Art.25", title: "Data protection by design and by default", description: "Implement appropriate measures at design phase.", domain: "Controller and Processor", required: true, evidenceTypes: ["policy", "design-doc"] },
  { id: "GDPR-Art28", ref: "Art.28", title: "Processor", description: "Process personal data only on documented instructions.", domain: "Controller and Processor", required: true, evidenceTypes: ["contract", "DPA"] },
  { id: "GDPR-Art30", ref: "Art.30", title: "Records of processing activities", description: "Maintain a record of processing activities.", domain: "Controller and Processor", required: true, evidenceTypes: ["RoPA"] },
  { id: "GDPR-Art32", ref: "Art.32", title: "Security of processing", description: "Implement appropriate technical and organizational measures.", domain: "Security of Personal Data", required: true, evidenceTypes: ["policy", "config"] },
  { id: "GDPR-Art33", ref: "Art.33", title: "Notification of a personal data breach to the supervisory authority", description: "Notify supervisory authority within 72 hours.", domain: "Security of Personal Data", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "GDPR-Art34", ref: "Art.34", title: "Communication of a personal data breach to the data subject", description: "Communicate breach to data subjects when high risk.", domain: "Security of Personal Data", required: true, evidenceTypes: ["procedure", "communication"] },
  { id: "GDPR-Art35", ref: "Art.35", title: "Data protection impact assessment", description: "Conduct DPIA where processing is high risk.", domain: "Controller and Processor", required: true, evidenceTypes: ["DPIA"] },
  { id: "GDPR-Art37", ref: "Art.37", title: "Designation of the data protection officer", description: "Designate a DPO where required.", domain: "Controller and Processor", required: true, evidenceTypes: ["appointment"] },
  { id: "GDPR-Art44", ref: "Art.44", title: "General principle for transfers", description: "Personal data transfers outside EEA require safeguards.", domain: "Transfers to Third Countries", required: true, evidenceTypes: ["policy", "SCC"] },
  { id: "GDPR-Art46", ref: "Art.46", title: "Transfers subject to appropriate safeguards", description: "Use SCCs, BCRs, or other safeguards.", domain: "Transfers to Third Countries", required: true, evidenceTypes: ["SCC", "policy"] },
  { id: "GDPR-Art58", ref: "Art.58", title: "Powers of the supervisory authority", description: "Cooperate with supervisory authority.", domain: "Independent Supervisory Authorities", required: true, evidenceTypes: ["procedure"] },
  { id: "GDPR-Art83", ref: "Art.83", title: "General conditions for imposing administrative fines", description: "Fines up to 4% of global turnover or EUR 20M.", domain: "Penalties", required: true, evidenceTypes: ["policy"] },
];

const GDPR: FrameworkDefinition = {
  id: "gdpr-2016",
  name: "General Data Protection Regulation",
  shortName: "GDPR",
  version: "2016/679",
  family: "privacy",
  description: "EU regulation on data protection and privacy. 11 chapters, 99 articles. REGISTRY SAMPLE — totalControls reflects real count; controls[] is curated representative subset.",
  jurisdiction: "EU",
  publishedBy: "European Parliament and Council",
  totalControls: 99,
  domains: [
    { id: "principles", name: "Principles", controlCount: 4 },
    { id: "rights", name: "Rights of the Data Subject", controlCount: 5 },
    { id: "controller-processor", name: "Controller and Processor", controlCount: 5 },
    { id: "security", name: "Security of Personal Data", controlCount: 3 },
    { id: "transfers", name: "Transfers to Third Countries", controlCount: 2 },
    { id: "supervisory", name: "Independent Supervisory Authorities", controlCount: 1 },
    { id: "penalties", name: "Penalties", controlCount: 1 },
  ],
  controls: GDPR_CONTROLS,
};

// ---------------------------------------------------------------------------
// ISO 42001:2023 — AI management system. 9 clauses, 38 Annex A AI-system controls.
// Fully enumerated (Annex A only; clauses 4-10 covered as 9 governance controls).
// ---------------------------------------------------------------------------

const ISO_42001_CONTROLS: ControlDefinition[] = [
  // Clauses 4-10 (9 governance-level requirements)
  { id: "ISO-42001-4", ref: "Cl.4", title: "Context of the organization", description: "Determine internal/external issues and interested parties for AIMS.", domain: "AIMS Clauses", required: true, evidenceTypes: ["context-doc"] },
  { id: "ISO-42001-5", ref: "Cl.5", title: "Leadership", description: "Top management leadership and AI policy.", domain: "AIMS Clauses", required: true, evidenceTypes: ["policy", "approval"] },
  { id: "ISO-42001-6", ref: "Cl.6", title: "Planning", description: "Address risks, opportunities, and AI objectives.", domain: "AIMS Clauses", required: true, evidenceTypes: ["risk-register", "plan"] },
  { id: "ISO-42001-7", ref: "Cl.7", title: "Support", description: "Resources, competence, awareness, communication, documented information.", domain: "AIMS Clauses", required: true, evidenceTypes: ["training-record", "policy"] },
  { id: "ISO-42001-8", ref: "Cl.8", title: "Operation", description: "Operational planning and control.", domain: "AIMS Clauses", required: true, evidenceTypes: ["procedure"] },
  { id: "ISO-42001-9", ref: "Cl.9", title: "Performance evaluation", description: "Monitoring, measurement, analysis, evaluation.", domain: "AIMS Clauses", required: true, evidenceTypes: ["report"] },
  { id: "ISO-42001-10", ref: "Cl.10", title: "Improvement", description: "Continual improvement.", domain: "AIMS Clauses", required: true, evidenceTypes: ["improvement-log"] },
  { id: "ISO-42001-4.4", ref: "Cl.4.4", title: "AI management system scope", description: "Determine boundaries and applicability of AIMS.", domain: "AIMS Clauses", required: true, evidenceTypes: ["scope-doc"] },
  { id: "ISO-42001-5.2", ref: "Cl.5.2", title: "AI policy", description: "Establish, implement, and maintain AI policy.", domain: "AIMS Clauses", required: true, evidenceTypes: ["policy"] },

  // Annex A AI-system controls (38)
  { id: "ISO-42001-A.2.2", ref: "A.2.2", title: "AI policy", description: "Policies for development, deployment, and use of AI systems.", domain: "A.2 Policies related to AI", required: true, evidenceTypes: ["policy"] },
  { id: "ISO-42001-A.2.3", ref: "A.2.3", title: "Alignment with other organizational policies", description: "Align AI policies with other policies.", domain: "A.2 Policies related to AI", required: true, evidenceTypes: ["policy"] },
  { id: "ISO-42001-A.2.4", ref: "A.2.4", title: "Review of AI policy", description: "Regular review of AI policies.", domain: "A.2 Policies related to AI", required: true, evidenceTypes: ["review-record"] },
  { id: "ISO-42001-A.3.2", ref: "A.3.2", title: "AI roles and responsibilities", description: "Define and assign AI roles.", domain: "A.3 Internal organization", required: true, evidenceTypes: ["org-chart"] },
  { id: "ISO-42001-A.3.3", ref: "A.3.3", title: "Reporting of concerns", description: "Process for reporting AI concerns.", domain: "A.3 Internal organization", required: true, evidenceTypes: ["procedure"] },
  { id: "ISO-42001-A.4.2", ref: "A.4.2", title: "Resources for AI", description: "Identify and allocate resources for AI systems.", domain: "A.4 Resources for AI systems", required: true, evidenceTypes: ["resource-plan"] },
  { id: "ISO-42001-A.4.3", ref: "A.4.3", title: "Data resources", description: "Document data resources for AI.", domain: "A.4 Resources for AI systems", required: true, evidenceTypes: ["data-inventory"] },
  { id: "ISO-42001-A.4.4", ref: "A.4.4", title: "Tooling resources", description: "Document tooling resources.", domain: "A.4 Resources for AI systems", required: true, evidenceTypes: ["inventory"] },
  { id: "ISO-42001-A.4.5", ref: "A.4.5", title: "System and computing resources", description: "Document compute/system resources for AI.", domain: "A.4 Resources for AI systems", required: true, evidenceTypes: ["inventory"] },
  { id: "ISO-42001-A.4.6", ref: "A.4.6", title: "Human resources", description: "Document competence requirements.", domain: "A.4 Resources for AI systems", required: true, evidenceTypes: ["competence-matrix"] },
  { id: "ISO-42001-A.5.2", ref: "A.5.2", title: "AI system impact assessment process", description: "Process for AI system impact assessment.", domain: "A.5 Assessing impacts of AI systems", required: true, evidenceTypes: ["impact-assessment"] },
  { id: "ISO-42001-A.5.3", ref: "A.5.3", title: "Documentation of AI system impact assessment", description: "Document outcomes of impact assessments.", domain: "A.5 Assessing impacts of AI systems", required: true, evidenceTypes: ["impact-assessment"] },
  { id: "ISO-42001-A.5.4", ref: "A.5.4", title: "Assessing AI system impact on individuals", description: "Assess impact on individuals.", domain: "A.5 Assessing impacts of AI systems", required: true, evidenceTypes: ["impact-assessment"] },
  { id: "ISO-42001-A.5.5", ref: "A.5.5", title: "Assessing societal impacts", description: "Assess societal impacts of AI systems.", domain: "A.5 Assessing impacts of AI systems", required: true, evidenceTypes: ["impact-assessment"] },
  { id: "ISO-42001-A.6.1.2", ref: "A.6.1.2", title: "Objectives for AI system development", description: "Define objectives for AI development.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["requirements-doc"] },
  { id: "ISO-42001-A.6.1.3", ref: "A.6.1.3", title: "Processes for AI system development", description: "Document processes for AI development.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["procedure"] },
  { id: "ISO-42001-A.6.2.2", ref: "A.6.2.2", title: "AI system requirements", description: "Document AI system requirements.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["requirements-doc"] },
  { id: "ISO-42001-A.6.2.3", ref: "A.6.2.3", title: "AI system design and development", description: "Design and develop AI per requirements.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["design-doc"] },
  { id: "ISO-42001-A.6.2.4", ref: "A.6.2.4", title: "Verification and validation", description: "Verify and validate AI system.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["test-result"] },
  { id: "ISO-42001-A.6.2.5", ref: "A.6.2.5", title: "AI system deployment", description: "Document AI deployment activities.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["deploy-record"] },
  { id: "ISO-42001-A.6.2.6", ref: "A.6.2.6", title: "AI system operation and monitoring", description: "Operate and monitor AI systems.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["monitoring", "log"] },
  { id: "ISO-42001-A.6.2.7", ref: "A.6.2.7", title: "AI system technical documentation", description: "Maintain technical documentation.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["doc"] },
  { id: "ISO-42001-A.6.2.8", ref: "A.6.2.8", title: "AI system recording of event logs", description: "Record events from AI systems.", domain: "A.6 AI system life cycle", required: true, evidenceTypes: ["log"] },
  { id: "ISO-42001-A.7.2", ref: "A.7.2", title: "Data for development and enhancement of AI", description: "Process for managing data used by AI systems.", domain: "A.7 Data for AI systems", required: true, evidenceTypes: ["procedure", "data-inventory"] },
  { id: "ISO-42001-A.7.3", ref: "A.7.3", title: "Acquisition of data", description: "Document acquisition of data.", domain: "A.7 Data for AI systems", required: true, evidenceTypes: ["procedure"] },
  { id: "ISO-42001-A.7.4", ref: "A.7.4", title: "Quality of data for AI systems", description: "Define and ensure data quality.", domain: "A.7 Data for AI systems", required: true, evidenceTypes: ["quality-report"] },
  { id: "ISO-42001-A.7.5", ref: "A.7.5", title: "Data provenance", description: "Document data provenance.", domain: "A.7 Data for AI systems", required: true, evidenceTypes: ["provenance-record"] },
  { id: "ISO-42001-A.7.6", ref: "A.7.6", title: "Data preparation", description: "Document data preparation.", domain: "A.7 Data for AI systems", required: true, evidenceTypes: ["procedure"] },
  { id: "ISO-42001-A.8.2", ref: "A.8.2", title: "System documentation and information for users", description: "Document information for AI system users.", domain: "A.8 Information for interested parties", required: true, evidenceTypes: ["doc", "user-guide"] },
  { id: "ISO-42001-A.8.3", ref: "A.8.3", title: "External reporting", description: "External reporting on AI system.", domain: "A.8 Information for interested parties", required: true, evidenceTypes: ["report"] },
  { id: "ISO-42001-A.8.4", ref: "A.8.4", title: "Communication of incidents", description: "Communicate AI incidents to interested parties.", domain: "A.8 Information for interested parties", required: true, evidenceTypes: ["procedure", "communication"] },
  { id: "ISO-42001-A.8.5", ref: "A.8.5", title: "Information for interested parties", description: "Provide information to interested parties.", domain: "A.8 Information for interested parties", required: true, evidenceTypes: ["doc"] },
  { id: "ISO-42001-A.9.2", ref: "A.9.2", title: "Processes for responsible use of AI", description: "Establish processes for responsible AI use.", domain: "A.9 Use of AI systems", required: true, evidenceTypes: ["procedure", "policy"] },
  { id: "ISO-42001-A.9.3", ref: "A.9.3", title: "Objectives for responsible use of AI", description: "Define objectives for responsible AI use.", domain: "A.9 Use of AI systems", required: true, evidenceTypes: ["policy"] },
  { id: "ISO-42001-A.9.4", ref: "A.9.4", title: "Intended use of the AI system", description: "Document intended use.", domain: "A.9 Use of AI systems", required: true, evidenceTypes: ["doc"] },
  { id: "ISO-42001-A.10.2", ref: "A.10.2", title: "Allocation of responsibilities", description: "Allocate responsibilities for third parties.", domain: "A.10 Third-party and customer relationships", required: true, evidenceTypes: ["contract"] },
  { id: "ISO-42001-A.10.3", ref: "A.10.3", title: "Suppliers", description: "Manage supplier relationships for AI.", domain: "A.10 Third-party and customer relationships", required: true, evidenceTypes: ["contract", "vendor-assessment"] },
  { id: "ISO-42001-A.10.4", ref: "A.10.4", title: "Customers", description: "Manage customer relationships for AI.", domain: "A.10 Third-party and customer relationships", required: true, evidenceTypes: ["contract"] },
];

const ISO_42001: FrameworkDefinition = {
  id: "iso-42001-2023",
  name: "ISO/IEC 42001:2023",
  shortName: "ISO 42001",
  version: "2023",
  family: "ai-governance",
  description: "International standard for AI management systems (AIMS). 9 clauses, 38 Annex A controls.",
  publishedBy: "ISO/IEC",
  totalControls: 47,
  domains: [
    { id: "clauses", name: "AIMS Clauses", controlCount: 9 },
    { id: "A2", name: "A.2 Policies related to AI", controlCount: 3 },
    { id: "A3", name: "A.3 Internal organization", controlCount: 2 },
    { id: "A4", name: "A.4 Resources for AI systems", controlCount: 5 },
    { id: "A5", name: "A.5 Assessing impacts of AI systems", controlCount: 4 },
    { id: "A6", name: "A.6 AI system life cycle", controlCount: 9 },
    { id: "A7", name: "A.7 Data for AI systems", controlCount: 5 },
    { id: "A8", name: "A.8 Information for interested parties", controlCount: 4 },
    { id: "A9", name: "A.9 Use of AI systems", controlCount: 3 },
    { id: "A10", name: "A.10 Third-party and customer relationships", controlCount: 3 },
  ],
  controls: ISO_42001_CONTROLS,
};

// ---------------------------------------------------------------------------
// CCPA / CPRA — California Consumer Privacy Act / Privacy Rights Act
// ~30 control points covering consumer rights and business obligations.
// ---------------------------------------------------------------------------

const CCPA_CONTROLS: ControlDefinition[] = [
  { id: "CCPA-1798.100", ref: "1798.100", title: "Right to know about personal information collected", description: "Inform consumers about categories of PI collected.", domain: "Consumer Rights", required: true, evidenceTypes: ["privacy-notice"] },
  { id: "CCPA-1798.105", ref: "1798.105", title: "Right to delete personal information", description: "Honor consumer requests to delete PI.", domain: "Consumer Rights", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "CCPA-1798.106", ref: "1798.106", title: "Right to correct inaccurate personal information", description: "Honor requests to correct PI.", domain: "Consumer Rights", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "CCPA-1798.110", ref: "1798.110", title: "Right to know what personal information is collected", description: "Disclose specific PI collected.", domain: "Consumer Rights", required: true, evidenceTypes: ["procedure", "data-inventory"] },
  { id: "CCPA-1798.115", ref: "1798.115", title: "Right to know about disclosure or sale of PI", description: "Disclose PI sold or shared.", domain: "Consumer Rights", required: true, evidenceTypes: ["procedure", "data-inventory"] },
  { id: "CCPA-1798.120", ref: "1798.120", title: "Right to opt-out of sale or sharing", description: "Honor opt-out requests.", domain: "Consumer Rights", required: true, evidenceTypes: ["procedure", "config"] },
  { id: "CCPA-1798.121", ref: "1798.121", title: "Right to limit use of sensitive personal information", description: "Honor limitation requests for sensitive PI.", domain: "Consumer Rights", required: true, evidenceTypes: ["procedure"] },
  { id: "CCPA-1798.125", ref: "1798.125", title: "Right to non-discrimination", description: "Do not discriminate against consumers exercising rights.", domain: "Consumer Rights", required: true, evidenceTypes: ["policy"] },
  { id: "CCPA-1798.130", ref: "1798.130", title: "Notice and disclosure requirements", description: "Provide notice at collection and methods to submit requests.", domain: "Business Obligations", required: true, evidenceTypes: ["privacy-notice", "procedure"] },
  { id: "CCPA-1798.135", ref: "1798.135", title: "Methods for consumer requests", description: "Provide at least two designated methods.", domain: "Business Obligations", required: true, evidenceTypes: ["procedure"] },
  { id: "CCPA-1798.140", ref: "1798.140", title: "Definitions", description: "Apply CCPA-specific definitions.", domain: "Business Obligations", required: true, evidenceTypes: ["policy"] },
  { id: "CCPA-1798.145", ref: "1798.145", title: "Exemptions", description: "Document applicable exemptions.", domain: "Business Obligations", required: false, evidenceTypes: ["policy"] },
  { id: "CCPA-1798.150", ref: "1798.150", title: "Private right of action for data breaches", description: "Implement reasonable security to avoid breach exposure.", domain: "Enforcement", required: true, evidenceTypes: ["policy", "config"] },
  { id: "CCPA-1798.155", ref: "1798.155", title: "Administrative enforcement", description: "Cooperate with CA AG / CPPA enforcement.", domain: "Enforcement", required: true, evidenceTypes: ["procedure"] },
  { id: "CCPA-1798.185", ref: "1798.185", title: "Annual cybersecurity audits and risk assessments (CPRA)", description: "Conduct annual cyber audits and risk assessments.", domain: "Business Obligations", required: true, evidenceTypes: ["audit-report", "risk-assessment"] },
  { id: "CCPA-DPA-Contract", ref: "Service Provider Agreement", title: "Service provider / contractor contracts", description: "Required contractual terms with service providers.", domain: "Business Obligations", required: true, evidenceTypes: ["contract"] },
  { id: "CCPA-Train-1", ref: "Training", title: "Employee training on PI handling", description: "Train employees handling PI / consumer requests.", domain: "Business Obligations", required: true, evidenceTypes: ["training-record"] },
  { id: "CCPA-Records-1", ref: "Records", title: "Recordkeeping of consumer requests", description: "Maintain records for 24 months.", domain: "Business Obligations", required: true, evidenceTypes: ["log", "ticket"] },
];

const CCPA: FrameworkDefinition = {
  id: "ccpa-cpra",
  name: "California Consumer Privacy Act / Privacy Rights Act",
  shortName: "CCPA/CPRA",
  version: "Cal. Civ. Code §1798",
  family: "privacy",
  description: "California state privacy law covering consumer rights and business obligations.",
  jurisdiction: "US-CA",
  publishedBy: "California Privacy Protection Agency / California AG",
  totalControls: 30,
  domains: [
    { id: "consumer-rights", name: "Consumer Rights", controlCount: 8 },
    { id: "business-obligations", name: "Business Obligations", controlCount: 8 },
    { id: "enforcement", name: "Enforcement", controlCount: 2 },
  ],
  controls: CCPA_CONTROLS,
};

// ---------------------------------------------------------------------------
// CERT-In Directive (India, 2022) — Cyber incident reporting requirements
// ---------------------------------------------------------------------------

const CERT_IN_CONTROLS: ControlDefinition[] = [
  { id: "CERT-IN-1", ref: "Dir.1", title: "Synchronisation of system clocks with NIC/NPL NTP", description: "All servers/network devices sync to NIC NTP or NPL NTP.", domain: "Time Synchronisation", required: true, evidenceTypes: ["config"] },
  { id: "CERT-IN-2", ref: "Dir.2", title: "Mandatory reporting of cyber incidents within 6 hours", description: "Report listed cyber incidents to CERT-In within 6 hours of noticing.", domain: "Incident Reporting", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "CERT-IN-3", ref: "Dir.3", title: "Point of Contact for CERT-In", description: "Designate Point of Contact for CERT-In communications.", domain: "Incident Reporting", required: true, evidenceTypes: ["appointment"] },
  { id: "CERT-IN-4", ref: "Dir.4", title: "Logs retention 180 days within India", description: "Retain ICT system logs for 180 days within India.", domain: "Log Retention", required: true, evidenceTypes: ["config", "log"] },
  { id: "CERT-IN-5", ref: "Dir.5", title: "VPN/Cloud/Datacenter customer record retention", description: "Retain customer records for 5 years per service categories.", domain: "Record Retention", required: true, evidenceTypes: ["policy", "config"] },
  { id: "CERT-IN-6", ref: "Dir.6", title: "Virtual asset / VASP customer KYC retention", description: "Maintain KYC and transaction information for 5 years.", domain: "Record Retention", required: true, evidenceTypes: ["procedure", "log"] },
  { id: "CERT-IN-7", ref: "Dir.7", title: "Furnish information when called for", description: "Provide information/assistance when ordered by CERT-In.", domain: "Cooperation", required: true, evidenceTypes: ["procedure"] },
];

const CERT_IN: FrameworkDefinition = {
  id: "cert-in-2022",
  name: "CERT-In Directions (April 2022)",
  shortName: "CERT-In",
  version: "April 2022",
  family: "industry",
  description: "Indian Computer Emergency Response Team directions on cyber incident reporting, log retention, and cooperation obligations.",
  jurisdiction: "IN",
  publishedBy: "CERT-In (MeitY)",
  totalControls: 7,
  domains: [
    { id: "time", name: "Time Synchronisation", controlCount: 1 },
    { id: "incident", name: "Incident Reporting", controlCount: 2 },
    { id: "log", name: "Log Retention", controlCount: 1 },
    { id: "record", name: "Record Retention", controlCount: 2 },
    { id: "cooperation", name: "Cooperation", controlCount: 1 },
  ],
  controls: CERT_IN_CONTROLS,
};

// ---------------------------------------------------------------------------
// SOX ITGC — IT General Controls supporting SOX 404 financial reporting.
// 4 control areas: Access, Change Mgmt, Operations, Development.
// ---------------------------------------------------------------------------

const SOX_ITGC_CONTROLS: ControlDefinition[] = [
  { id: "SOX-ITGC-AC-1", ref: "AC-1", title: "User provisioning approval", description: "All user access to financial systems is approved.", domain: "Access to Programs and Data", required: true, evidenceTypes: ["procedure", "approval"] },
  { id: "SOX-ITGC-AC-2", ref: "AC-2", title: "Periodic user access review", description: "Quarterly review of user access to financial systems.", domain: "Access to Programs and Data", required: true, evidenceTypes: ["review-record"] },
  { id: "SOX-ITGC-AC-3", ref: "AC-3", title: "Terminated user access removal", description: "Access removed within defined SLA upon termination.", domain: "Access to Programs and Data", required: true, evidenceTypes: ["log", "ticket"] },
  { id: "SOX-ITGC-AC-4", ref: "AC-4", title: "Privileged access control", description: "Privileged access to financial systems is restricted and monitored.", domain: "Access to Programs and Data", required: true, evidenceTypes: ["iam-config", "log"] },
  { id: "SOX-ITGC-AC-5", ref: "AC-5", title: "Segregation of duties", description: "Conflicting duties separated in financial systems.", domain: "Access to Programs and Data", required: true, evidenceTypes: ["sod-matrix"] },
  { id: "SOX-ITGC-CM-1", ref: "CM-1", title: "Change request authorization", description: "All changes are authorized prior to implementation.", domain: "Change Management", required: true, evidenceTypes: ["ticket", "approval"] },
  { id: "SOX-ITGC-CM-2", ref: "CM-2", title: "Change testing", description: "Changes tested prior to deployment.", domain: "Change Management", required: true, evidenceTypes: ["test-result"] },
  { id: "SOX-ITGC-CM-3", ref: "CM-3", title: "Production change approval", description: "Production deployments approved.", domain: "Change Management", required: true, evidenceTypes: ["ticket", "approval"] },
  { id: "SOX-ITGC-CM-4", ref: "CM-4", title: "Emergency change procedure", description: "Emergency changes follow documented procedure.", domain: "Change Management", required: true, evidenceTypes: ["procedure", "ticket"] },
  { id: "SOX-ITGC-OP-1", ref: "OP-1", title: "Job scheduling", description: "Scheduled jobs supporting financial reports are monitored.", domain: "Computer Operations", required: true, evidenceTypes: ["monitoring", "log"] },
  { id: "SOX-ITGC-OP-2", ref: "OP-2", title: "Backup management", description: "Backups of financial systems performed and tested.", domain: "Computer Operations", required: true, evidenceTypes: ["backup-log", "test-result"] },
  { id: "SOX-ITGC-OP-3", ref: "OP-3", title: "Incident management", description: "Incidents impacting financial systems are tracked.", domain: "Computer Operations", required: true, evidenceTypes: ["ticket", "report"] },
  { id: "SOX-ITGC-DEV-1", ref: "DEV-1", title: "SDLC procedure for financial systems", description: "SDLC procedures cover financial system development.", domain: "Program Development", required: true, evidenceTypes: ["policy", "procedure"] },
  { id: "SOX-ITGC-DEV-2", ref: "DEV-2", title: "Pre-production testing", description: "Financial system code is tested in non-prod before release.", domain: "Program Development", required: true, evidenceTypes: ["test-result"] },
];

const SOX_ITGC: FrameworkDefinition = {
  id: "sox-itgc",
  name: "SOX ITGC (Section 404)",
  shortName: "SOX ITGC",
  version: "PCAOB AS 2201",
  family: "industry",
  description: "IT General Controls supporting Sarbanes-Oxley Section 404 internal control over financial reporting.",
  jurisdiction: "US",
  publishedBy: "PCAOB",
  totalControls: 14,
  domains: [
    { id: "access", name: "Access to Programs and Data", controlCount: 5 },
    { id: "change", name: "Change Management", controlCount: 4 },
    { id: "ops", name: "Computer Operations", controlCount: 3 },
    { id: "dev", name: "Program Development", controlCount: 2 },
  ],
  controls: SOX_ITGC_CONTROLS,
};

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

export const FRAMEWORK_REGISTRY: Record<string, FrameworkDefinition> = {
  [ISO_27001.id]: ISO_27001,
  [SOC2.id]: SOC2,
  [HIPAA.id]: HIPAA,
  [DPDPA.id]: DPDPA,
  [PCI_DSS.id]: PCI_DSS,
  [NIST_800_53.id]: NIST_800_53,
  [NIST_CSF.id]: NIST_CSF,
  [GDPR.id]: GDPR,
  [ISO_42001.id]: ISO_42001,
  [CCPA.id]: CCPA,
  [CERT_IN.id]: CERT_IN,
  [SOX_ITGC.id]: SOX_ITGC,
};

export const ALL_FRAMEWORKS: FrameworkDefinition[] = Object.values(FRAMEWORK_REGISTRY);

export function getFramework(id: string): FrameworkDefinition | undefined {
  return FRAMEWORK_REGISTRY[id];
}

export function getControl(
  frameworkId: string,
  controlId: string,
): ControlDefinition | undefined {
  const fw = FRAMEWORK_REGISTRY[frameworkId];
  if (!fw) return undefined;
  return fw.controls.find((c) => c.id === controlId);
}
