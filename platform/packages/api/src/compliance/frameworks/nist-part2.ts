// NIST SP 800-53 Rev 5 - base controls for CP, IA, IR, MA, MP, PE, PL
// Source: NIST SP 800-53 Rev 5 (public domain)
// Reference: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
// Baseline impacts sourced from NIST SP 800-53B (Control Baselines for Information Systems and Organizations)

export interface Nist80053Control {
  controlId: string;
  controlName: string;
  description: string;
  family: "CP" | "IA" | "IR" | "MA" | "MP" | "PE" | "PL";
  familyName: string;
  weight: 1 | 2 | 3;
  baselineImpact: ("low" | "moderate" | "high")[];
  reference: string;
}

export const nist80053_part2: Nist80053Control[] = [
  // ===========================================================================
  // CP: Contingency Planning (CP-1 through CP-13)
  // ===========================================================================
  {
    controlId: "CP-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate contingency planning policy and procedures to facilitate the implementation of contingency planning controls; review and update them at an organization-defined frequency.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-1",
  },
  {
    controlId: "CP-2",
    controlName: "Contingency Plan",
    description:
      "Develop a contingency plan for the system that identifies essential mission and business functions, recovery objectives, restoration priorities, and roles and responsibilities; coordinate planning with related organizational elements; review, update, and protect the plan.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-2",
  },
  {
    controlId: "CP-3",
    controlName: "Contingency Training",
    description:
      "Provide contingency training to system users consistent with assigned roles and responsibilities within an organization-defined time period of assuming a role, when required by changes, and at an organization-defined frequency thereafter.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-3",
  },
  {
    controlId: "CP-4",
    controlName: "Contingency Plan Testing",
    description:
      "Test the contingency plan for the system at an organization-defined frequency using organization-defined tests to determine effectiveness and readiness; review results and initiate corrective actions.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-4",
  },
  // CP-5 was withdrawn in Rev 5 (incorporated into CP-2)
  {
    controlId: "CP-6",
    controlName: "Alternate Storage Site",
    description:
      "Establish an alternate storage site, including necessary agreements, to permit the storage and retrieval of system backup information; ensure the alternate site provides controls equivalent to the primary site.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-6",
  },
  {
    controlId: "CP-7",
    controlName: "Alternate Processing Site",
    description:
      "Establish an alternate processing site, including necessary agreements, to permit the transfer and resumption of organization-defined system operations within an organization-defined time period when the primary site is unavailable.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-7",
  },
  {
    controlId: "CP-8",
    controlName: "Telecommunications Services",
    description:
      "Establish alternate telecommunications services, including necessary agreements, to permit the resumption of organization-defined system operations within an organization-defined time period when primary telecommunications capabilities are unavailable.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-8",
  },
  {
    controlId: "CP-9",
    controlName: "System Backup",
    description:
      "Conduct backups of user-level information, system-level information, and system documentation (including security- and privacy-related) at an organization-defined frequency consistent with recovery objectives; protect the confidentiality, integrity, and availability of backup information.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-9",
  },
  {
    controlId: "CP-10",
    controlName: "System Recovery and Reconstitution",
    description:
      "Provide for the recovery and reconstitution of the system to a known state within an organization-defined time period consistent with recovery time and recovery point objectives after a disruption, compromise, or failure.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CP-10",
  },
  {
    controlId: "CP-11",
    controlName: "Alternate Communications Protocols",
    description:
      "Provide the capability to employ organization-defined alternative communications protocols in support of maintaining continuity of operations.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 CP-11",
  },
  {
    controlId: "CP-12",
    controlName: "Safe Mode",
    description:
      "When organization-defined conditions are detected, enter a safe mode of operation with organization-defined restrictions.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 CP-12",
  },
  {
    controlId: "CP-13",
    controlName: "Alternative Security Mechanisms",
    description:
      "Employ organization-defined alternative or supplemental security mechanisms for satisfying organization-defined security functions when the primary means of implementing the security function is unavailable or compromised.",
    family: "CP",
    familyName: "Contingency Planning",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 CP-13",
  },

  // ===========================================================================
  // IA: Identification and Authentication (IA-1 through IA-12)
  // ===========================================================================
  {
    controlId: "IA-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate identification and authentication policy and procedures; review and update at an organization-defined frequency.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-1",
  },
  {
    controlId: "IA-2",
    controlName: "Identification and Authentication (Organizational Users)",
    description:
      "Uniquely identify and authenticate organizational users and associate that unique identification with processes acting on behalf of those users.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-2",
  },
  {
    controlId: "IA-3",
    controlName: "Device Identification and Authentication",
    description:
      "Uniquely identify and authenticate organization-defined devices and/or types of devices before establishing a local, remote, or network connection.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-3",
  },
  {
    controlId: "IA-4",
    controlName: "Identifier Management",
    description:
      "Manage system identifiers by receiving authorization, selecting an identifier, assigning it to the intended individual/group/role/service/device, and preventing reuse for an organization-defined time period.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-4",
  },
  {
    controlId: "IA-5",
    controlName: "Authenticator Management",
    description:
      "Manage system authenticators by verifying identity of the recipient, establishing initial authenticator content, ensuring sufficient authenticator strength, and establishing procedures for initial distribution, lost/compromised/damaged authenticators, and revocation.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-5",
  },
  {
    controlId: "IA-6",
    controlName: "Authentication Feedback",
    description:
      "Obscure feedback of authentication information during the authentication process to protect the information from possible exploitation and use by unauthorized individuals.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-6",
  },
  {
    controlId: "IA-7",
    controlName: "Cryptographic Module Authentication",
    description:
      "Implement mechanisms for authentication to a cryptographic module that meet the requirements of applicable laws, executive orders, directives, policies, regulations, standards, and guidelines for such authentication.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-7",
  },
  {
    controlId: "IA-8",
    controlName: "Identification and Authentication (Non-Organizational Users)",
    description:
      "Uniquely identify and authenticate non-organizational users or processes acting on behalf of non-organizational users.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-8",
  },
  {
    controlId: "IA-9",
    controlName: "Service Identification and Authentication",
    description:
      "Uniquely identify and authenticate organization-defined system services and applications before establishing communications with devices, users, or other services or applications.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 IA-9",
  },
  {
    controlId: "IA-10",
    controlName: "Adaptive Authentication",
    description:
      "Require individuals accessing the system to employ organization-defined supplemental authentication techniques or mechanisms under organization-defined circumstances or situations.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 IA-10",
  },
  {
    controlId: "IA-11",
    controlName: "Re-authentication",
    description:
      "Require users to re-authenticate when organization-defined circumstances or situations require re-authentication.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-11",
  },
  {
    controlId: "IA-12",
    controlName: "Identity Proofing",
    description:
      "Identity proof users that require accounts for logical access to systems based on appropriate identity assurance level requirements as specified in applicable standards and guidelines; resolve user identities to a unique individual; collect, validate, and verify identity evidence.",
    family: "IA",
    familyName: "Identification and Authentication",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IA-12",
  },

  // ===========================================================================
  // IR: Incident Response (IR-1 through IR-10)
  // ===========================================================================
  {
    controlId: "IR-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate incident response policy and procedures; review and update at an organization-defined frequency.",
    family: "IR",
    familyName: "Incident Response",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-1",
  },
  {
    controlId: "IR-2",
    controlName: "Incident Response Training",
    description:
      "Provide incident response training to system users consistent with assigned roles and responsibilities within an organization-defined time period of assuming a role, when required by changes, and at an organization-defined frequency thereafter.",
    family: "IR",
    familyName: "Incident Response",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-2",
  },
  {
    controlId: "IR-3",
    controlName: "Incident Response Testing",
    description:
      "Test the effectiveness of the incident response capability for the system at an organization-defined frequency using organization-defined tests; document the results.",
    family: "IR",
    familyName: "Incident Response",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-3",
  },
  {
    controlId: "IR-4",
    controlName: "Incident Handling",
    description:
      "Implement an incident handling capability for incidents that is consistent with the incident response plan and includes preparation, detection and analysis, containment, eradication, and recovery; coordinate handling activities with contingency planning activities.",
    family: "IR",
    familyName: "Incident Response",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-4",
  },
  {
    controlId: "IR-5",
    controlName: "Incident Monitoring",
    description:
      "Track and document incidents.",
    family: "IR",
    familyName: "Incident Response",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-5",
  },
  {
    controlId: "IR-6",
    controlName: "Incident Reporting",
    description:
      "Require personnel to report suspected incidents to the organizational incident response capability within an organization-defined time period; report incident information to organization-defined authorities.",
    family: "IR",
    familyName: "Incident Response",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-6",
  },
  {
    controlId: "IR-7",
    controlName: "Incident Response Assistance",
    description:
      "Provide an incident response support resource, integral to the organizational incident response capability, that offers advice and assistance to users of the system for the handling and reporting of incidents.",
    family: "IR",
    familyName: "Incident Response",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-7",
  },
  {
    controlId: "IR-8",
    controlName: "Incident Response Plan",
    description:
      "Develop an incident response plan that provides a roadmap for implementing incident response capability, describes structure/organization, provides a high-level approach, meets the unique requirements of the organization, defines reportable incidents, and addresses information sharing.",
    family: "IR",
    familyName: "Incident Response",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 IR-8",
  },
  {
    controlId: "IR-9",
    controlName: "Information Spillage Response",
    description:
      "Respond to information spills by assigning personnel with responsibility for responding to spills, identifying the specific information involved, alerting personnel, isolating the contaminated system or component, eradicating the information, and identifying other systems that may have been impacted.",
    family: "IR",
    familyName: "Incident Response",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 IR-9",
  },
  {
    controlId: "IR-10",
    controlName: "Integrated Information Security Analysis Team",
    description:
      "(Withdrawn in Rev 5 - incorporated into IR-4(11)). Retained as placeholder for legacy crosswalks. // VERIFY",
    family: "IR",
    familyName: "Incident Response",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 IR-10 (Withdrawn)",
  },

  // ===========================================================================
  // MA: Maintenance (MA-1 through MA-7)
  // ===========================================================================
  {
    controlId: "MA-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate system maintenance policy and procedures; review and update at an organization-defined frequency.",
    family: "MA",
    familyName: "Maintenance",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MA-1",
  },
  {
    controlId: "MA-2",
    controlName: "Controlled Maintenance",
    description:
      "Schedule, document, and review records of maintenance, repair, and replacement on system components in accordance with manufacturer/vendor specifications and organizational requirements; approve and monitor all maintenance activities.",
    family: "MA",
    familyName: "Maintenance",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MA-2",
  },
  {
    controlId: "MA-3",
    controlName: "Maintenance Tools",
    description:
      "Approve, control, and monitor the use of system maintenance tools; review previously approved maintenance tools at an organization-defined frequency.",
    family: "MA",
    familyName: "Maintenance",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MA-3",
  },
  {
    controlId: "MA-4",
    controlName: "Nonlocal Maintenance",
    description:
      "Approve and monitor nonlocal maintenance and diagnostic activities; allow only when consistent with organizational policy; employ strong authentication; maintain records; terminate session and network connections when done.",
    family: "MA",
    familyName: "Maintenance",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MA-4",
  },
  {
    controlId: "MA-5",
    controlName: "Maintenance Personnel",
    description:
      "Establish a process for maintenance personnel authorization and maintain a list of authorized maintenance organizations or personnel; verify that non-escorted personnel performing maintenance have required access authorizations.",
    family: "MA",
    familyName: "Maintenance",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MA-5",
  },
  {
    controlId: "MA-6",
    controlName: "Timely Maintenance",
    description:
      "Obtain maintenance support and/or spare parts for organization-defined system components within an organization-defined time period of failure.",
    family: "MA",
    familyName: "Maintenance",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MA-6",
  },
  {
    controlId: "MA-7",
    controlName: "Field Maintenance",
    description:
      "Restrict or prohibit field maintenance on organization-defined systems or system components to organization-defined trusted maintenance facilities.",
    family: "MA",
    familyName: "Maintenance",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 MA-7",
  },

  // ===========================================================================
  // MP: Media Protection (MP-1 through MP-8)
  // ===========================================================================
  {
    controlId: "MP-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate media protection policy and procedures; review and update at an organization-defined frequency.",
    family: "MP",
    familyName: "Media Protection",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-1",
  },
  {
    controlId: "MP-2",
    controlName: "Media Access",
    description:
      "Restrict access to organization-defined types of digital and/or non-digital media to organization-defined personnel or roles.",
    family: "MP",
    familyName: "Media Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-2",
  },
  {
    controlId: "MP-3",
    controlName: "Media Marking",
    description:
      "Mark system media indicating the distribution limitations, handling caveats, and applicable security markings (if any) of the information; exempt organization-defined types of media from marking if the media remain within organization-defined controlled areas.",
    family: "MP",
    familyName: "Media Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-3",
  },
  {
    controlId: "MP-4",
    controlName: "Media Storage",
    description:
      "Physically control and securely store organization-defined types of digital and/or non-digital media within organization-defined controlled areas; protect media until destroyed or sanitized using approved equipment, techniques, and procedures.",
    family: "MP",
    familyName: "Media Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-4",
  },
  {
    controlId: "MP-5",
    controlName: "Media Transport",
    description:
      "Protect and control organization-defined types of system media during transport outside of controlled areas using organization-defined controls; maintain accountability for media during transport; document activities associated with the transport.",
    family: "MP",
    familyName: "Media Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-5",
  },
  {
    controlId: "MP-6",
    controlName: "Media Sanitization",
    description:
      "Sanitize organization-defined system media prior to disposal, release out of organizational control, or release for reuse using organization-defined sanitization techniques and procedures; employ sanitization mechanisms with the strength and integrity commensurate with the security category or classification of the information.",
    family: "MP",
    familyName: "Media Protection",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-6",
  },
  {
    controlId: "MP-7",
    controlName: "Media Use",
    description:
      "Restrict or prohibit the use of organization-defined types of system media on organization-defined systems or system components using organization-defined controls; prohibit the use of portable storage devices in organizational systems when such devices have no identifiable owner.",
    family: "MP",
    familyName: "Media Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 MP-7",
  },
  {
    controlId: "MP-8",
    controlName: "Media Downgrading",
    description:
      "Establish an organization-defined system media downgrading process that includes employing downgrading mechanisms with organization-defined strength and integrity; verify that the system media downgrading process is commensurate with the security category and/or classification level of the information.",
    family: "MP",
    familyName: "Media Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 MP-8",
  },

  // ===========================================================================
  // PE: Physical and Environmental Protection (PE-1 through PE-23)
  // ===========================================================================
  {
    controlId: "PE-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate physical and environmental protection policy and procedures; review and update at an organization-defined frequency.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-1",
  },
  {
    controlId: "PE-2",
    controlName: "Physical Access Authorizations",
    description:
      "Develop, approve, and maintain a list of individuals with authorized access to the facility where the system resides; issue authorization credentials; review access list at an organization-defined frequency; remove individuals from the list when access is no longer required.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-2",
  },
  {
    controlId: "PE-3",
    controlName: "Physical Access Control",
    description:
      "Enforce physical access authorizations at organization-defined entry and exit points to the facility; maintain physical access audit logs; control access to areas officially designated as publicly accessible; escort visitors; secure keys, combinations, and other physical access devices; inventory them at an organization-defined frequency; change combinations/keys when required.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-3",
  },
  {
    controlId: "PE-4",
    controlName: "Access Control for Transmission",
    description:
      "Control physical access to organization-defined system distribution and transmission lines within organizational facilities using organization-defined security controls.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-4",
  },
  {
    controlId: "PE-5",
    controlName: "Access Control for Output Devices",
    description:
      "Control physical access to output from organization-defined output devices to prevent unauthorized individuals from obtaining the output.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-5",
  },
  {
    controlId: "PE-6",
    controlName: "Monitoring Physical Access",
    description:
      "Monitor physical access to the facility where the system resides to detect and respond to physical security incidents; review physical access logs at an organization-defined frequency; coordinate results of reviews and investigations with the organizational incident response capability.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-6",
  },
  // PE-7 was withdrawn in Rev 5 (incorporated into PE-2 and PE-3)
  {
    controlId: "PE-8",
    controlName: "Visitor Access Records",
    description:
      "Maintain visitor access records to the facility where the system resides for an organization-defined time period; review visitor access records at an organization-defined frequency; report anomalies to designated organizational personnel.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-8",
  },
  {
    controlId: "PE-9",
    controlName: "Power Equipment and Cabling",
    description:
      "Protect power equipment and power cabling for the system from damage and destruction.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-9",
  },
  {
    controlId: "PE-10",
    controlName: "Emergency Shutoff",
    description:
      "Provide the capability of shutting off power to organization-defined system or individual system components in emergency situations; place emergency shutoff switches or devices in an organization-defined location to facilitate access for authorized personnel; protect shutoff capability from unauthorized activation.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-10",
  },
  {
    controlId: "PE-11",
    controlName: "Emergency Power",
    description:
      "Provide an uninterruptible power supply to facilitate an organization-defined outcome (orderly shutdown, transition to long-term alternate power) in the event of a primary power source loss.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-11",
  },
  {
    controlId: "PE-12",
    controlName: "Emergency Lighting",
    description:
      "Employ and maintain automatic emergency lighting for the system that activates in the event of a power outage or disruption and covers emergency exits and evacuation routes within the facility.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-12",
  },
  {
    controlId: "PE-13",
    controlName: "Fire Protection",
    description:
      "Employ and maintain fire detection and suppression systems that are supported by an independent energy source.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-13",
  },
  {
    controlId: "PE-14",
    controlName: "Environmental Controls",
    description:
      "Maintain organization-defined temperature and humidity levels within the facility where the system resides; monitor environmental control levels at an organization-defined frequency.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-14",
  },
  {
    controlId: "PE-15",
    controlName: "Water Damage Protection",
    description:
      "Protect the system from damage resulting from water leakage by providing master shutoff or isolation valves that are accessible, working properly, and known to key personnel.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-15",
  },
  {
    controlId: "PE-16",
    controlName: "Delivery and Removal",
    description:
      "Authorize and control organization-defined types of system components entering and exiting the facility; maintain records of the system components.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-16",
  },
  {
    controlId: "PE-17",
    controlName: "Alternate Work Site",
    description:
      "Determine and document organization-defined alternate work sites allowed for use by employees; employ organization-defined controls at alternate work sites; assess the effectiveness of controls at alternate work sites; provide a means for employees to communicate with information security and privacy personnel in case of incidents.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PE-17",
  },
  {
    controlId: "PE-18",
    controlName: "Location of System Components",
    description:
      "Position system components within the facility to minimize potential damage from organization-defined physical and environmental hazards and to minimize the opportunity for unauthorized access.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 PE-18",
  },
  {
    controlId: "PE-19",
    controlName: "Information Leakage",
    description:
      "Protect the system from information leakage due to electromagnetic signals emanations.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PE-19",
  },
  {
    controlId: "PE-20",
    controlName: "Asset Monitoring and Tracking",
    description:
      "Employ organization-defined asset location technologies to track and monitor the location and movement of organization-defined assets within organization-defined controlled areas; ensure that asset location technologies are employed in accordance with applicable federal laws, executive orders, directives, regulations, policies, standards, and guidelines.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PE-20",
  },
  {
    controlId: "PE-21",
    controlName: "Electromagnetic Pulse Protection",
    description:
      "Employ organization-defined protective measures against electromagnetic pulse damage for organization-defined systems and system components.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PE-21",
  },
  {
    controlId: "PE-22",
    controlName: "Component Marking",
    description:
      "Mark organization-defined system hardware components indicating the impact level or classification level of the information permitted to be processed, stored, or transmitted by the hardware component.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PE-22",
  },
  {
    controlId: "PE-23",
    controlName: "Facility Location",
    description:
      "Plan the location or site of the facility where the system resides considering physical and environmental hazards; for existing facilities, consider the physical and environmental hazards in the organizational risk management strategy.",
    family: "PE",
    familyName: "Physical and Environmental Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PE-23",
  },

  // ===========================================================================
  // PL: Planning (PL-1 through PL-11)
  // ===========================================================================
  {
    controlId: "PL-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate planning policy and procedures; review and update at an organization-defined frequency.",
    family: "PL",
    familyName: "Planning",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PL-1",
  },
  {
    controlId: "PL-2",
    controlName: "System Security and Privacy Plans",
    description:
      "Develop security and privacy plans for the system that are consistent with the organization's enterprise architecture, explicitly define the constituent system components, describe the operational context, identify the information types processed, provide the security categorization, describe the operational environment, describe relationships/connections with other systems, provide an overview of security and privacy requirements, and identify any relevant control overlays.",
    family: "PL",
    familyName: "Planning",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PL-2",
  },
  // PL-3 was withdrawn in Rev 5 (incorporated into PL-2)
  {
    controlId: "PL-4",
    controlName: "Rules of Behavior",
    description:
      "Establish and provide to individuals requiring access to the system, rules of behavior describing responsibilities and expected behavior for information and system usage, security, and privacy; receive a documented acknowledgment from such individuals; review and update at an organization-defined frequency; require individuals to re-acknowledge when rules are revised or updated.",
    family: "PL",
    familyName: "Planning",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PL-4",
  },
  // PL-5 was withdrawn in Rev 5 (incorporated into RA-8)
  // PL-6 was withdrawn in Rev 5 (incorporated into PL-2)
  {
    controlId: "PL-7",
    controlName: "Concept of Operations",
    description:
      "Develop a Concept of Operations (CONOPS) for the system describing how the organization intends to operate the system from the perspective of information security and privacy; review and update the CONOPS at an organization-defined frequency.",
    family: "PL",
    familyName: "Planning",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PL-7",
  },
  {
    controlId: "PL-8",
    controlName: "Security and Privacy Architectures",
    description:
      "Develop security and privacy architectures for the system that describe the requirements and approach to be taken for protecting confidentiality, integrity, and availability of information and individual privacy; describe how the architectures are integrated into and support the enterprise architecture; describe any assumptions about, and dependencies on, external services; review and update at an organization-defined frequency to reflect changes.",
    family: "PL",
    familyName: "Planning",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PL-8",
  },
  {
    controlId: "PL-9",
    controlName: "Central Management",
    description:
      "Centrally manage organization-defined controls and related processes.",
    family: "PL",
    familyName: "Planning",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PL-9",
  },
  {
    controlId: "PL-10",
    controlName: "Baseline Selection",
    description:
      "Select a control baseline for the system.",
    family: "PL",
    familyName: "Planning",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PL-10",
  },
  {
    controlId: "PL-11",
    controlName: "Baseline Tailoring",
    description:
      "Tailor the selected control baseline by applying specified tailoring actions.",
    family: "PL",
    familyName: "Planning",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PL-11",
  },
];

export default nist80053_part2;
