// ISO/IEC 27001:2022 Annex A - all 93 controls
// Source: ISO/IEC 27001:2022 (referenced via ENISA, NIST CSF mappings, public control list summaries)
// Note: Control descriptions paraphrased - ISO text is copyrighted.

export interface Iso27001Control {
  controlId: string;              // e.g., "A.5.1"
  controlName: string;            // short title
  description: string;            // 1-2 sentence plain-english summary
  theme: "Organizational" | "People" | "Physical" | "Technological";
  category: string;               // grouping label (your own derived)
  weight: 1 | 2 | 3;              // 1=standard, 2=important, 3=critical
  attributes: {
    controlType: ("preventive" | "detective" | "corrective")[];
    cia: ("confidentiality" | "integrity" | "availability")[];
    operationalCapability?: string; // e.g., "Governance", "Access control"
  };
  reference: string;              // "ISO/IEC 27001:2022 Annex A.X.Y"
}

export const iso27001_2022: Iso27001Control[] = [
  // ============================================================
  // 37 Organizational controls (A.5.1 - A.5.37)
  // ============================================================
  {
    controlId: "A.5.1",
    controlName: "Policies for information security",
    description:
      "Define, approve, publish, and periodically review a set of information security policies that establish management direction and organizational commitment to security.",
    theme: "Organizational",
    category: "Governance & Policy",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.1",
  },
  {
    controlId: "A.5.2",
    controlName: "Information security roles and responsibilities",
    description:
      "Define and allocate information security roles and responsibilities across the organization in line with its security needs.",
    theme: "Organizational",
    category: "Governance & Policy",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.2",
  },
  {
    controlId: "A.5.3",
    controlName: "Segregation of duties",
    description:
      "Separate conflicting duties and areas of responsibility to reduce the risk of fraud, error, and unauthorized or unintended modifications.",
    theme: "Organizational",
    category: "Governance & Policy",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.3",
  },
  {
    controlId: "A.5.4",
    controlName: "Management responsibilities",
    description:
      "Require management to ensure all personnel apply information security in accordance with the organization's established policies, procedures, and standards.",
    theme: "Organizational",
    category: "Governance & Policy",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.4",
  },
  {
    controlId: "A.5.5",
    controlName: "Contact with authorities",
    description:
      "Establish and maintain documented procedures for contacting relevant authorities such as law enforcement and regulators for incidents and compliance matters.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 1,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.5",
  },
  {
    controlId: "A.5.6",
    controlName: "Contact with special interest groups",
    description:
      "Maintain contact with special interest groups, professional associations, and security forums to stay informed of threats and best practices.",
    theme: "Organizational",
    category: "Threat Intelligence",
    weight: 1,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.6",
  },
  {
    controlId: "A.5.7",
    controlName: "Threat intelligence",
    description:
      "Collect and analyze information about information security threats to produce actionable threat intelligence that informs defensive decisions.",
    theme: "Organizational",
    category: "Threat Intelligence",
    weight: 3,
    attributes: {
      controlType: ["preventive", "detective", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Threat and vulnerability management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.7",
  },
  {
    controlId: "A.5.8",
    controlName: "Information security in project management",
    description:
      "Integrate information security requirements and risk assessment into project management practices regardless of project type.",
    theme: "Organizational",
    category: "Governance & Policy",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.8",
  },
  {
    controlId: "A.5.9",
    controlName: "Inventory of information and other associated assets",
    description:
      "Develop and maintain an inventory of information and associated assets, including owners, to ensure they are protected appropriately.",
    theme: "Organizational",
    category: "Asset Management",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.9",
  },
  {
    controlId: "A.5.10",
    controlName: "Acceptable use of information and other associated assets",
    description:
      "Identify, document, and enforce rules for the acceptable use and handling of information and associated assets.",
    theme: "Organizational",
    category: "Asset Management",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.10",
  },
  {
    controlId: "A.5.11",
    controlName: "Return of assets",
    description:
      "Ensure personnel and external parties return organizational assets upon termination of employment, contract, or agreement.",
    theme: "Organizational",
    category: "Asset Management",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.11",
  },
  {
    controlId: "A.5.12",
    controlName: "Classification of information",
    description:
      "Classify information according to confidentiality, integrity, availability, and regulatory needs so it receives protection proportional to its value and sensitivity.",
    theme: "Organizational",
    category: "Information Classification",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.12",
  },
  {
    controlId: "A.5.13",
    controlName: "Labelling of information",
    description:
      "Implement a consistent set of procedures for labeling information in accordance with the adopted classification scheme.",
    theme: "Organizational",
    category: "Information Classification",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.13",
  },
  {
    controlId: "A.5.14",
    controlName: "Information transfer",
    description:
      "Establish rules, agreements, and safeguards for transferring information securely within the organization and with external parties via any channel.",
    theme: "Organizational",
    category: "Information Protection",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.14",
  },
  {
    controlId: "A.5.15",
    controlName: "Access control",
    description:
      "Establish and implement rules to control logical and physical access to information and associated assets based on business and security requirements.",
    theme: "Organizational",
    category: "Access Control",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.15",
  },
  {
    controlId: "A.5.16",
    controlName: "Identity management",
    description:
      "Manage the full lifecycle of identities used to access the organization's information and systems to ensure unique, accountable identification.",
    theme: "Organizational",
    category: "Access Control",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.16",
  },
  {
    controlId: "A.5.17",
    controlName: "Authentication information",
    description:
      "Control the allocation and management of authentication information such as passwords, keys, and tokens through a formal management process.",
    theme: "Organizational",
    category: "Access Control",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.17",
  },
  {
    controlId: "A.5.18",
    controlName: "Access rights",
    description:
      "Provision, review, modify, and revoke access rights to information and assets in accordance with the access control policy.",
    theme: "Organizational",
    category: "Access Control",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.18",
  },
  {
    controlId: "A.5.19",
    controlName: "Information security in supplier relationships",
    description:
      "Define and implement processes to manage the information security risks associated with the use of suppliers' products and services.",
    theme: "Organizational",
    category: "Supplier & Third-Party",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Supplier relationships security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.19",
  },
  {
    controlId: "A.5.20",
    controlName: "Addressing information security within supplier agreements",
    description:
      "Establish and agree relevant information security requirements with each supplier based on the type of access and services provided.",
    theme: "Organizational",
    category: "Supplier & Third-Party",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Supplier relationships security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.20",
  },
  {
    controlId: "A.5.21",
    controlName: "Managing information security in the ICT supply chain",
    description:
      "Define and implement processes to manage information security risks across the ICT products and services supply chain.",
    theme: "Organizational",
    category: "Supplier & Third-Party",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Supplier relationships security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.21",
  },
  {
    controlId: "A.5.22",
    controlName: "Monitoring, review and change management of supplier services",
    description:
      "Regularly monitor, review, evaluate, and manage changes in supplier security practices and service delivery.",
    theme: "Organizational",
    category: "Supplier & Third-Party",
    weight: 2,
    attributes: {
      controlType: ["detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Supplier relationships security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.22",
  },
  {
    controlId: "A.5.23",
    controlName: "Information security for use of cloud services",
    description:
      "Establish processes to acquire, use, manage, and exit cloud services in line with the organization's information security requirements.",
    theme: "Organizational",
    category: "Supplier & Third-Party",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Supplier relationships security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.23",
  },
  {
    controlId: "A.5.24",
    controlName: "Information security incident management planning and preparation",
    description:
      "Plan and prepare for managing information security incidents by defining processes, roles, and responsibilities in advance.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 3,
    attributes: {
      controlType: ["corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.24",
  },
  {
    controlId: "A.5.25",
    controlName: "Assessment and decision on information security events",
    description:
      "Assess reported information security events and decide whether they should be classified as information security incidents.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 3,
    attributes: {
      controlType: ["detective", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.25",
  },
  {
    controlId: "A.5.26",
    controlName: "Response to information security incidents",
    description:
      "Respond to confirmed information security incidents using documented procedures and trained personnel to contain and resolve them.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 3,
    attributes: {
      controlType: ["corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.26",
  },
  {
    controlId: "A.5.27",
    controlName: "Learning from information security incidents",
    description:
      "Analyze incidents after the fact and use lessons learned to strengthen controls and reduce the likelihood or impact of future incidents.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.27",
  },
  {
    controlId: "A.5.28",
    controlName: "Collection of evidence",
    description:
      "Define and apply procedures for the identification, collection, acquisition, and preservation of evidence related to information security events.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 2,
    attributes: {
      controlType: ["corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.28",
  },
  {
    controlId: "A.5.29",
    controlName: "Information security during disruption",
    description:
      "Plan how to maintain information security at appropriate levels during periods of business disruption or crisis.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 3,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Continuity",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.29",
  },
  {
    controlId: "A.5.30",
    controlName: "ICT readiness for business continuity",
    description:
      "Plan, implement, maintain, and test ICT readiness to meet business continuity objectives and recovery requirements.",
    theme: "Organizational",
    category: "Incident & Continuity",
    weight: 3,
    attributes: {
      controlType: ["corrective"],
      cia: ["availability"],
      operationalCapability: "Continuity",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.30",
  },
  {
    controlId: "A.5.31",
    controlName: "Identification of legal, statutory, regulatory and contractual requirements",
    description:
      "Identify, document, and keep current all legal, statutory, regulatory, and contractual requirements relevant to information security.",
    theme: "Organizational",
    category: "Legal & Compliance",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Legal and compliance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.31",
  },
  {
    controlId: "A.5.32",
    controlName: "Intellectual property rights",
    description:
      "Implement appropriate procedures to protect intellectual property rights and ensure compliance with relevant licensing requirements.",
    theme: "Organizational",
    category: "Legal & Compliance",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity"],
      operationalCapability: "Legal and compliance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.32",
  },
  {
    controlId: "A.5.33",
    controlName: "Protection of records",
    description:
      "Protect records from loss, destruction, falsification, unauthorized access, and unauthorized release in line with legal and business needs.",
    theme: "Organizational",
    category: "Legal & Compliance",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Legal and compliance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.33",
  },
  {
    controlId: "A.5.34",
    controlName: "Privacy and protection of PII",
    description:
      "Identify and meet privacy and protection requirements for personally identifiable information in accordance with applicable laws and regulations.",
    theme: "Organizational",
    category: "Legal & Compliance",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.34",
  },
  {
    controlId: "A.5.35",
    controlName: "Independent review of information security",
    description:
      "Periodically subject the organization's approach to managing information security to independent review at planned intervals or after significant change.",
    theme: "Organizational",
    category: "Assurance & Review",
    weight: 1,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security assurance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.35",
  },
  {
    controlId: "A.5.36",
    controlName: "Compliance with policies, rules and standards for information security",
    description:
      "Regularly review compliance with the organization's information security policies, rules, and standards, and address any nonconformities.",
    theme: "Organizational",
    category: "Assurance & Review",
    weight: 1,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Legal and compliance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.36",
  },
  {
    controlId: "A.5.37",
    controlName: "Documented operating procedures",
    description:
      "Document operating procedures for information processing facilities and make them available to personnel who need them.",
    theme: "Organizational",
    category: "Governance & Policy",
    weight: 1,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Governance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.5.37",
  },

  // ============================================================
  // 8 People controls (A.6.1 - A.6.8)
  // ============================================================
  {
    controlId: "A.6.1",
    controlName: "Screening",
    description:
      "Perform background verification checks on candidates for employment commensurate with the sensitivity of the role, in line with applicable laws.",
    theme: "People",
    category: "HR Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Human resource security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.1",
  },
  {
    controlId: "A.6.2",
    controlName: "Terms and conditions of employment",
    description:
      "Include information security responsibilities in the contractual terms and conditions of employment for personnel.",
    theme: "People",
    category: "HR Security",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Human resource security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.2",
  },
  {
    controlId: "A.6.3",
    controlName: "Information security awareness, education and training",
    description:
      "Provide personnel with appropriate information security awareness, education, and training relevant to their job function, updated regularly.",
    theme: "People",
    category: "Awareness & Training",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Human resource security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.3",
  },
  {
    controlId: "A.6.4",
    controlName: "Disciplinary process",
    description:
      "Establish and communicate a formal disciplinary process to act against personnel who commit information security violations.",
    theme: "People",
    category: "HR Security",
    weight: 1,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Human resource security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.4",
  },
  {
    controlId: "A.6.5",
    controlName: "Responsibilities after termination or change of employment",
    description:
      "Define, enforce, and communicate information security responsibilities that remain valid after employment is changed or terminated.",
    theme: "People",
    category: "HR Security",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Human resource security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.5",
  },
  {
    controlId: "A.6.6",
    controlName: "Confidentiality or non-disclosure agreements",
    description:
      "Identify, document, review, and have signed confidentiality or non-disclosure agreements reflecting the organization's need to protect information.",
    theme: "People",
    category: "HR Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality"],
      operationalCapability: "Human resource security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.6",
  },
  {
    controlId: "A.6.7",
    controlName: "Remote working",
    description:
      "Implement security measures when personnel work remotely to protect information accessed, processed, or stored outside the organization's premises.",
    theme: "People",
    category: "Remote Work",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.7",
  },
  {
    controlId: "A.6.8",
    controlName: "Information security event reporting",
    description:
      "Provide a mechanism for personnel to promptly report observed or suspected information security events through appropriate channels.",
    theme: "People",
    category: "Incident Reporting",
    weight: 2,
    attributes: {
      controlType: ["detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.6.8",
  },

  // ============================================================
  // 14 Physical controls (A.7.1 - A.7.14)
  // ============================================================
  {
    controlId: "A.7.1",
    controlName: "Physical security perimeters",
    description:
      "Define and use physical security perimeters to protect areas containing information and information processing facilities.",
    theme: "Physical",
    category: "Facility Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.1",
  },
  {
    controlId: "A.7.2",
    controlName: "Physical entry",
    description:
      "Protect secure areas with appropriate physical entry controls to ensure only authorized personnel can access them.",
    theme: "Physical",
    category: "Facility Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.2",
  },
  {
    controlId: "A.7.3",
    controlName: "Securing offices, rooms and facilities",
    description:
      "Design and apply physical security to offices, rooms, and facilities housing information and assets.",
    theme: "Physical",
    category: "Facility Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.3",
  },
  {
    controlId: "A.7.4",
    controlName: "Physical security monitoring",
    description:
      "Continuously monitor premises for unauthorized physical access using technologies such as CCTV, alarms, and intrusion detection.",
    theme: "Physical",
    category: "Facility Security",
    weight: 2,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.4",
  },
  {
    controlId: "A.7.5",
    controlName: "Protecting against physical and environmental threats",
    description:
      "Design and apply protection against physical and environmental threats such as natural disasters, crime, and deliberate attacks.",
    theme: "Physical",
    category: "Environmental",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.5",
  },
  {
    controlId: "A.7.6",
    controlName: "Working in secure areas",
    description:
      "Design and apply security measures for working in secure areas to prevent unauthorized access, damage, or disclosure.",
    theme: "Physical",
    category: "Facility Security",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.6",
  },
  {
    controlId: "A.7.7",
    controlName: "Clear desk and clear screen",
    description:
      "Enforce clear desk rules for papers and removable media and clear screen rules for information processing facilities.",
    theme: "Physical",
    category: "Workplace Hygiene",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.7",
  },
  {
    controlId: "A.7.8",
    controlName: "Equipment siting and protection",
    description:
      "Site and protect equipment to reduce risks from environmental threats and hazards and opportunities for unauthorized access.",
    theme: "Physical",
    category: "Equipment",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.8",
  },
  {
    controlId: "A.7.9",
    controlName: "Security of assets off-premises",
    description:
      "Protect off-premises assets considering the different risks associated with working outside the organization's premises.",
    theme: "Physical",
    category: "Equipment",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.9",
  },
  {
    controlId: "A.7.10",
    controlName: "Storage media",
    description:
      "Manage storage media throughout its lifecycle of acquisition, use, transport, and disposal in line with the organization's classification scheme.",
    theme: "Physical",
    category: "Media Management",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.10",
  },
  {
    controlId: "A.7.11",
    controlName: "Supporting utilities",
    description:
      "Protect information processing facilities from power failures and other disruptions caused by failures in supporting utilities.",
    theme: "Physical",
    category: "Environmental",
    weight: 2,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.11",
  },
  {
    controlId: "A.7.12",
    controlName: "Cabling security",
    description:
      "Protect cabling carrying power, data, or supporting information services from interception, interference, or damage.",
    theme: "Physical",
    category: "Equipment",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.12",
  },
  {
    controlId: "A.7.13",
    controlName: "Equipment maintenance",
    description:
      "Maintain equipment correctly to ensure ongoing availability, integrity, and protection of the information it processes.",
    theme: "Physical",
    category: "Equipment",
    weight: 1,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["integrity", "availability"],
      operationalCapability: "Physical security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.13",
  },
  {
    controlId: "A.7.14",
    controlName: "Secure disposal or re-use of equipment",
    description:
      "Verify that equipment containing storage media has any sensitive data and licensed software removed or securely overwritten before disposal or re-use.",
    theme: "Physical",
    category: "Media Management",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.7.14",
  },

  // ============================================================
  // 34 Technological controls (A.8.1 - A.8.34)
  // ============================================================
  {
    controlId: "A.8.1",
    controlName: "User endpoint devices",
    description:
      "Protect information stored on, processed by, or accessible via user endpoint devices such as laptops, mobiles, and workstations.",
    theme: "Technological",
    category: "Endpoint Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Asset management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.1",
  },
  {
    controlId: "A.8.2",
    controlName: "Privileged access rights",
    description:
      "Restrict and closely manage the allocation and use of privileged access rights to critical systems.",
    theme: "Technological",
    category: "Identity & Access",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.2",
  },
  {
    controlId: "A.8.3",
    controlName: "Information access restriction",
    description:
      "Restrict access to information and application system functions in accordance with the access control policy.",
    theme: "Technological",
    category: "Identity & Access",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.3",
  },
  {
    controlId: "A.8.4",
    controlName: "Access to source code",
    description:
      "Manage and restrict read and write access to source code, development tools, and software libraries to protect against malicious or accidental change.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.4",
  },
  {
    controlId: "A.8.5",
    controlName: "Secure authentication",
    description:
      "Implement secure authentication technologies and procedures based on the access restrictions and access control policy.",
    theme: "Technological",
    category: "Identity & Access",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Identity and access management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.5",
  },
  {
    controlId: "A.8.6",
    controlName: "Capacity management",
    description:
      "Monitor and tune the use of resources to ensure required system performance and availability in line with current and projected capacity needs.",
    theme: "Technological",
    category: "Operations",
    weight: 1,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["availability"],
      operationalCapability: "Continuity",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.6",
  },
  {
    controlId: "A.8.7",
    controlName: "Protection against malware",
    description:
      "Implement protection against malware combining technical controls with appropriate user awareness and operational procedures.",
    theme: "Technological",
    category: "Threat & Vulnerability",
    weight: 3,
    attributes: {
      controlType: ["preventive", "detective", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.7",
  },
  {
    controlId: "A.8.8",
    controlName: "Management of technical vulnerabilities",
    description:
      "Obtain timely information about technical vulnerabilities, evaluate exposure, and take appropriate measures to mitigate risk.",
    theme: "Technological",
    category: "Threat & Vulnerability",
    weight: 3,
    attributes: {
      controlType: ["preventive", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Threat and vulnerability management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.8",
  },
  {
    controlId: "A.8.9",
    controlName: "Configuration management",
    description:
      "Establish, document, implement, monitor, and review secure configurations of hardware, software, services, and networks.",
    theme: "Technological",
    category: "Secure Configuration",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Secure configuration",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.9",
  },
  {
    controlId: "A.8.10",
    controlName: "Information deletion",
    description:
      "Delete information stored in information systems, devices, or other storage media when no longer required and in line with policy.",
    theme: "Technological",
    category: "Information Protection",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.10",
  },
  {
    controlId: "A.8.11",
    controlName: "Data masking",
    description:
      "Apply data masking in accordance with access control policies and other business needs, considering applicable regulations.",
    theme: "Technological",
    category: "Information Protection",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.11",
  },
  {
    controlId: "A.8.12",
    controlName: "Data leakage prevention",
    description:
      "Apply data leakage prevention measures to systems, networks, and devices that process, store, or transmit sensitive information.",
    theme: "Technological",
    category: "Information Protection",
    weight: 3,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["confidentiality"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.12",
  },
  {
    controlId: "A.8.13",
    controlName: "Information backup",
    description:
      "Maintain and regularly test backup copies of information, software, and systems in line with the agreed backup policy.",
    theme: "Technological",
    category: "Operations",
    weight: 3,
    attributes: {
      controlType: ["corrective"],
      cia: ["integrity", "availability"],
      operationalCapability: "Continuity",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.13",
  },
  {
    controlId: "A.8.14",
    controlName: "Redundancy of information processing facilities",
    description:
      "Implement information processing facilities with sufficient redundancy to meet availability requirements.",
    theme: "Technological",
    category: "Operations",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["availability"],
      operationalCapability: "Continuity",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.14",
  },
  {
    controlId: "A.8.15",
    controlName: "Logging",
    description:
      "Produce, store, protect, and analyze logs that record activities, exceptions, faults, and other relevant security events.",
    theme: "Technological",
    category: "Logging & Monitoring",
    weight: 2,
    attributes: {
      controlType: ["detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.15",
  },
  {
    controlId: "A.8.16",
    controlName: "Monitoring activities",
    description:
      "Monitor networks, systems, and applications for anomalous behavior and evaluate potential information security incidents.",
    theme: "Technological",
    category: "Logging & Monitoring",
    weight: 3,
    attributes: {
      controlType: ["detective", "corrective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.16",
  },
  {
    controlId: "A.8.17",
    controlName: "Clock synchronization",
    description:
      "Synchronize the clocks of information processing systems to an approved time source to support accurate log correlation and forensics.",
    theme: "Technological",
    category: "Logging & Monitoring",
    weight: 1,
    attributes: {
      controlType: ["detective"],
      cia: ["integrity"],
      operationalCapability: "Information security event management",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.17",
  },
  {
    controlId: "A.8.18",
    controlName: "Use of privileged utility programs",
    description:
      "Restrict and tightly control the use of utility programs capable of overriding system and application controls.",
    theme: "Technological",
    category: "Identity & Access",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.18",
  },
  {
    controlId: "A.8.19",
    controlName: "Installation of software on operational systems",
    description:
      "Implement procedures and controls for the secure installation of software on operational systems to preserve integrity.",
    theme: "Technological",
    category: "Secure Configuration",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Secure configuration",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.19",
  },
  {
    controlId: "A.8.20",
    controlName: "Networks security",
    description:
      "Manage and control networks and network devices to protect information in systems and applications from network-based threats.",
    theme: "Technological",
    category: "Network Security",
    weight: 3,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.20",
  },
  {
    controlId: "A.8.21",
    controlName: "Security of network services",
    description:
      "Identify, implement, and monitor security mechanisms, service levels, and requirements for all network services used by the organization.",
    theme: "Technological",
    category: "Network Security",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.21",
  },
  {
    controlId: "A.8.22",
    controlName: "Segregation of networks",
    description:
      "Segregate groups of information services, users, and information systems on the network to limit the impact of compromise.",
    theme: "Technological",
    category: "Network Security",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.22",
  },
  {
    controlId: "A.8.23",
    controlName: "Web filtering",
    description:
      "Manage access to external websites to reduce exposure to malicious content and enforce acceptable use policies.",
    theme: "Technological",
    category: "Network Security",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.23",
  },
  {
    controlId: "A.8.24",
    controlName: "Use of cryptography",
    description:
      "Define and implement rules on the effective use of cryptography, including key management, to protect confidentiality, integrity, and authenticity.",
    theme: "Technological",
    category: "Cryptography",
    weight: 3,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity"],
      operationalCapability: "Secure configuration",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.24",
  },
  {
    controlId: "A.8.25",
    controlName: "Secure development life cycle",
    description:
      "Establish and apply rules for the secure development of software and systems across the full development life cycle.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.25",
  },
  {
    controlId: "A.8.26",
    controlName: "Application security requirements",
    description:
      "Identify, specify, and approve information security requirements when developing or acquiring applications.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.26",
  },
  {
    controlId: "A.8.27",
    controlName: "Secure system architecture and engineering principles",
    description:
      "Establish, document, maintain, and apply secure system engineering principles to the design and implementation of information systems.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.27",
  },
  {
    controlId: "A.8.28",
    controlName: "Secure coding",
    description:
      "Apply secure coding principles to software development to prevent common vulnerabilities and reduce security defects.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.28",
  },
  {
    controlId: "A.8.29",
    controlName: "Security testing in development and acceptance",
    description:
      "Define and implement security testing processes during development and before acceptance of systems into production.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.29",
  },
  {
    controlId: "A.8.30",
    controlName: "Outsourced development",
    description:
      "Direct, monitor, and review activities related to outsourced system development to ensure security requirements are met.",
    theme: "Technological",
    category: "Secure Development",
    weight: 2,
    attributes: {
      controlType: ["preventive", "detective"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "System and network security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.30",
  },
  {
    controlId: "A.8.31",
    controlName: "Separation of development, test and production environments",
    description:
      "Separate development, test, and production environments to reduce risks of unauthorized access or changes to the production environment.",
    theme: "Technological",
    category: "Secure Configuration",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.31",
  },
  {
    controlId: "A.8.32",
    controlName: "Change management",
    description:
      "Control changes to information processing facilities and information systems through a formal change management process.",
    theme: "Technological",
    category: "Operations",
    weight: 2,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Application security",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.32",
  },
  {
    controlId: "A.8.33",
    controlName: "Test information",
    description:
      "Select, protect, and manage test information carefully to avoid exposing sensitive production data during testing.",
    theme: "Technological",
    category: "Secure Development",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity"],
      operationalCapability: "Information protection",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.33",
  },
  {
    controlId: "A.8.34",
    controlName: "Protection of information systems during audit testing",
    description:
      "Plan and agree audit tests and assurance activities involving information systems to minimize disruption to business processes.",
    theme: "Technological",
    category: "Assurance & Review",
    weight: 1,
    attributes: {
      controlType: ["preventive"],
      cia: ["confidentiality", "integrity", "availability"],
      operationalCapability: "Information security assurance",
    },
    reference: "ISO/IEC 27001:2022 Annex A.8.34",
  },
];
