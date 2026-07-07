// NIST SP 800-53 Rev 5 - base controls for families AC, AT, AU, CA, CM
// Source: NIST SP 800-53 Rev 5 (public domain, NIST.gov)
// Baseline mapping source: NIST SP 800-53B Rev 5, Appendix C (Control Baselines)
//
// Scope: Base controls only. Control enhancements such as AC-2(1), AC-3(2),
// etc. are intentionally excluded per spec.
//
// Withdrawn controls in these families (per Rev 5) are NOT emitted:
//   AC-13 (Withdrawn; incorporated into AC-2, AC-3, AC-5, AC-6)
//   AC-15 (Withdrawn; incorporated into PL-4)
//   AT-5  (Withdrawn; incorporated into PM-15)
//   AU-15 (Withdrawn; incorporated into AU-12)
//   AU-17 (Withdrawn; incorporated into AC-20)
//   AU-18 (Withdrawn; incorporated into AU-12)
//   CA-4  (Withdrawn; incorporated into CA-2)
//
// Note on baselines: controls with an empty baselineImpact array are part of
// the Rev 5 catalog but are not selected in any of the Low/Moderate/High
// baselines in SP 800-53B (some are privacy-only or "not selected"). They
// remain available for tailoring/overlay selection.

export interface Nist80053Control {
  controlId: string;              // "AC-1", "AC-2", ...
  controlName: string;            // official title
  description: string;            // 1-2 sentence summary of control statement
  family: "AC" | "AT" | "AU" | "CA" | "CM";
  familyName: string;             // "Access Control", etc.
  weight: 1 | 2 | 3;
  baselineImpact: ("low" | "moderate" | "high")[];  // which baselines include it
  reference: string;              // "NIST SP 800-53 Rev 5 AC-X"
}

export const nist80053_part1: Nist80053Control[] = [
  // =========================================================================
  // AC family (Access Control) - AC-1..AC-25 (AC-13, AC-15 withdrawn)
  // =========================================================================
  {
    controlId: "AC-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate access control policy and procedures, and review/update them at organization-defined frequencies.",
    family: "AC",
    familyName: "Access Control",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-1",
  },
  {
    controlId: "AC-2",
    controlName: "Account Management",
    description:
      "Manage system accounts including establishment, activation, modification, review, disabling, and removal across their lifecycle.",
    family: "AC",
    familyName: "Access Control",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-2",
  },
  {
    controlId: "AC-3",
    controlName: "Access Enforcement",
    description:
      "Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.",
    family: "AC",
    familyName: "Access Control",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-3",
  },
  {
    controlId: "AC-4",
    controlName: "Information Flow Enforcement",
    description:
      "Enforce approved authorizations for controlling the flow of information within the system and between connected systems.",
    family: "AC",
    familyName: "Access Control",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-4",
  },
  {
    controlId: "AC-5",
    controlName: "Separation of Duties",
    description:
      "Identify and separate duties of individuals to reduce the risk of malevolent activity without collusion; document and enforce separation via access authorizations.",
    family: "AC",
    familyName: "Access Control",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-5",
  },
  {
    controlId: "AC-6",
    controlName: "Least Privilege",
    description:
      "Employ the principle of least privilege, allowing only authorized accesses necessary to accomplish assigned organizational tasks.",
    family: "AC",
    familyName: "Access Control",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-6",
  },
  {
    controlId: "AC-7",
    controlName: "Unsuccessful Logon Attempts",
    description:
      "Enforce a limit on consecutive invalid logon attempts by a user and automatically lock the account or delay the next attempt per organization-defined parameters.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-7",
  },
  {
    controlId: "AC-8",
    controlName: "System Use Notification",
    description:
      "Display an approved system use notification message or banner before granting access, describing privacy and security notices consistent with applicable laws and policies.",
    family: "AC",
    familyName: "Access Control",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-8",
  },
  {
    controlId: "AC-9",
    controlName: "Previous Logon Notification",
    description:
      "Notify the user, upon successful logon, of the date and time of the last logon to aid in detection of unauthorized access.",
    family: "AC",
    familyName: "Access Control",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AC-9",
  },
  {
    controlId: "AC-10",
    controlName: "Concurrent Session Control",
    description:
      "Limit the number of concurrent sessions for each account or account type to an organization-defined number.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 AC-10",
  },
  {
    controlId: "AC-11",
    controlName: "Device Lock",
    description:
      "Prevent further access to the system by initiating a device lock after a defined period of inactivity or upon user request, retaining the lock until the user reauthenticates.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-11",
  },
  {
    controlId: "AC-12",
    controlName: "Session Termination",
    description:
      "Automatically terminate a user session after organization-defined conditions or trigger events requiring session disconnect.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-12",
  },
  {
    controlId: "AC-14",
    controlName: "Permitted Actions Without Identification or Authentication",
    description:
      "Identify and document user actions that can be performed on the system without identification or authentication, consistent with organizational mission and business functions.",
    family: "AC",
    familyName: "Access Control",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-14",
  },
  {
    controlId: "AC-16",
    controlName: "Security and Privacy Attributes",
    description:
      "Provide the means to associate organization-defined types of security and privacy attributes with information in storage, in process, and in transmission.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AC-16",
  },
  {
    controlId: "AC-17",
    controlName: "Remote Access",
    description:
      "Establish and document usage restrictions, configuration/connection requirements, and implementation guidance for each type of remote access allowed, and authorize remote access before permitting connections.",
    family: "AC",
    familyName: "Access Control",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-17",
  },
  {
    controlId: "AC-18",
    controlName: "Wireless Access",
    description:
      "Establish usage restrictions and configuration/connection requirements for wireless access and authorize wireless access before allowing connections to the system.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-18",
  },
  {
    controlId: "AC-19",
    controlName: "Access Control for Mobile Devices",
    description:
      "Establish usage restrictions, configuration requirements, connection requirements, and implementation guidance for organization-controlled mobile devices; authorize connection to systems.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-19",
  },
  {
    controlId: "AC-20",
    controlName: "Use of External Systems",
    description:
      "Establish terms and conditions permitting authorized individuals to access the system from external systems and process, store, or transmit organization-controlled information.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-20",
  },
  {
    controlId: "AC-21",
    controlName: "Information Sharing",
    description:
      "Enable authorized users to determine whether access authorizations match access restrictions on information prior to sharing or collaboration decisions.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-21",
  },
  {
    controlId: "AC-22",
    controlName: "Publicly Accessible Content",
    description:
      "Designate individuals authorized to post information onto publicly accessible systems, train them, review content for nonpublic information, and remove such information if discovered.",
    family: "AC",
    familyName: "Access Control",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AC-22",
  },
  {
    controlId: "AC-23",
    controlName: "Data Mining Protection",
    description:
      "Employ organization-defined data mining prevention and detection techniques for data storage objects to adequately detect and protect against unauthorized data mining.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AC-23",
  },
  {
    controlId: "AC-24",
    controlName: "Access Control Decisions",
    description:
      "Establish procedures to ensure access control decisions are applied to each access request prior to access enforcement.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AC-24",
  },
  {
    controlId: "AC-25",
    controlName: "Reference Monitor",
    description:
      "Implement a reference monitor for organization-defined access control policies that is tamperproof, always invoked, and small enough to be subject to analysis and testing.",
    family: "AC",
    familyName: "Access Control",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AC-25",
  },

  // =========================================================================
  // AT family (Awareness and Training) - AT-1..AT-6 (AT-5 withdrawn)
  // =========================================================================
  {
    controlId: "AT-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate awareness and training policy and procedures, and review/update them at organization-defined frequencies.",
    family: "AT",
    familyName: "Awareness and Training",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AT-1",
  },
  {
    controlId: "AT-2",
    controlName: "Literacy Training and Awareness",
    description:
      "Provide security and privacy literacy training to system users as part of initial training, when required by changes, and at organization-defined intervals.",
    family: "AT",
    familyName: "Awareness and Training",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AT-2",
  },
  {
    controlId: "AT-3",
    controlName: "Role-based Training",
    description:
      "Provide role-based security and privacy training to personnel with assigned roles and responsibilities before authorizing access and at organization-defined intervals.",
    family: "AT",
    familyName: "Awareness and Training",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AT-3",
  },
  {
    controlId: "AT-4",
    controlName: "Training Records",
    description:
      "Document and monitor individual system security and privacy training activities and retain training records for an organization-defined time period.",
    family: "AT",
    familyName: "Awareness and Training",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AT-4",
  },
  {
    controlId: "AT-6",
    controlName: "Training Feedback",
    description:
      "Provide feedback on organizational training results to organization-defined personnel at organization-defined frequencies.",
    family: "AT",
    familyName: "Awareness and Training",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AT-6",
  },

  // =========================================================================
  // AU family (Audit and Accountability) - AU-1..AU-16
  // (AU-15, AU-17, AU-18 withdrawn)
  // =========================================================================
  {
    controlId: "AU-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate audit and accountability policy and procedures, and review/update them at organization-defined frequencies.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-1",
  },
  {
    controlId: "AU-2",
    controlName: "Event Logging",
    description:
      "Identify the types of events the system is capable of logging, coordinate the event logging function with other entities requiring auditable events, and specify the events selected for logging.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-2",
  },
  {
    controlId: "AU-3",
    controlName: "Content of Audit Records",
    description:
      "Ensure that audit records contain information that establishes what type of event occurred, when, where, the source, outcome, and the identity of any individuals or subjects associated with the event.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-3",
  },
  {
    controlId: "AU-4",
    controlName: "Audit Log Storage Capacity",
    description:
      "Allocate audit log storage capacity to accommodate organization-defined audit log retention requirements.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-4",
  },
  {
    controlId: "AU-5",
    controlName: "Response to Audit Logging Process Failures",
    description:
      "Alert organization-defined personnel in the event of an audit logging process failure and take organization-defined actions in response.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-5",
  },
  {
    controlId: "AU-6",
    controlName: "Audit Record Review, Analysis, and Reporting",
    description:
      "Review and analyze system audit records at an organization-defined frequency for indications of inappropriate or unusual activity, and report findings to appropriate personnel.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-6",
  },
  {
    controlId: "AU-7",
    controlName: "Audit Record Reduction and Report Generation",
    description:
      "Provide an audit record reduction and report generation capability that supports on-demand analysis and reporting without altering the original content or time ordering of records.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-7",
  },
  {
    controlId: "AU-8",
    controlName: "Time Stamps",
    description:
      "Use internal system clocks to generate time stamps for audit records and record time stamps that meet organization-defined granularity and mapping to UTC or GMT.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-8",
  },
  {
    controlId: "AU-9",
    controlName: "Protection of Audit Information",
    description:
      "Protect audit information and audit logging tools from unauthorized access, modification, and deletion, and alert personnel upon detection of tampering.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-9",
  },
  {
    controlId: "AU-10",
    controlName: "Non-repudiation",
    description:
      "Provide irrefutable evidence that an individual (or process) has performed an organization-defined action, protecting against the individual falsely denying the action.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 AU-10",
  },
  {
    controlId: "AU-11",
    controlName: "Audit Record Retention",
    description:
      "Retain audit records for an organization-defined time period consistent with records retention policy to provide support for after-the-fact investigations and to meet regulatory requirements.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-11",
  },
  {
    controlId: "AU-12",
    controlName: "Audit Record Generation",
    description:
      "Provide audit record generation capability for the event types defined in AU-2 on all organization-defined system components; allow authorized personnel to select audited events.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 AU-12",
  },
  {
    controlId: "AU-13",
    controlName: "Monitoring for Information Disclosure",
    description:
      "Monitor organization-defined open-source information and sites for evidence of unauthorized disclosure of organizational information at organization-defined frequencies.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AU-13",
  },
  {
    controlId: "AU-14",
    controlName: "Session Audit",
    description:
      "Provide and implement the capability for authorized users to select a user session to capture or record, or view and hear the content of such a session.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AU-14",
  },
  {
    controlId: "AU-16",
    controlName: "Cross-organizational Audit Logging",
    description:
      "Employ organization-defined methods for coordinating audit information among external organizations when audit information is transmitted across organizational boundaries.",
    family: "AU",
    familyName: "Audit and Accountability",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 AU-16",
  },

  // =========================================================================
  // CA family (Assessment, Authorization, and Monitoring) - CA-1..CA-9
  // (CA-4 withdrawn; incorporated into CA-2)
  // =========================================================================
  {
    controlId: "CA-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate assessment, authorization, and monitoring policy and procedures, and review/update them at organization-defined frequencies.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-1",
  },
  {
    controlId: "CA-2",
    controlName: "Control Assessments",
    description:
      "Select assessors, develop a control assessment plan, assess the controls, and produce an assessment report documenting findings and recommendations.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-2",
  },
  {
    controlId: "CA-3",
    controlName: "Information Exchange",
    description:
      "Approve and manage the exchange of information between the system and other systems using organization-defined agreements (e.g., ISA, MOU/A), documenting interface characteristics and responsibilities.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-3",
  },
  {
    controlId: "CA-5",
    controlName: "Plan of Action and Milestones",
    description:
      "Develop and update a plan of action and milestones (POA&M) to document planned remediation actions for weaknesses or deficiencies found during control assessments.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-5",
  },
  {
    controlId: "CA-6",
    controlName: "Authorization",
    description:
      "Assign a senior official as authorizing official, ensure authorization of the system to operate or to provide common controls, and update the authorization at organization-defined frequencies.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-6",
  },
  {
    controlId: "CA-7",
    controlName: "Continuous Monitoring",
    description:
      "Develop a system-level continuous monitoring strategy and implement continuous monitoring including metrics, assessments, ongoing monitoring, correlation, response, and reporting.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-7",
  },
  {
    controlId: "CA-8",
    controlName: "Penetration Testing",
    description:
      "Conduct penetration testing at organization-defined frequencies on organization-defined systems or system components to identify exploitable vulnerabilities.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 3,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 CA-8",
  },
  {
    controlId: "CA-9",
    controlName: "Internal System Connections",
    description:
      "Authorize internal connections of organization-defined system components or classes of components to the system and document, for each connection, interface characteristics, security/privacy requirements, and the nature of information communicated.",
    family: "CA",
    familyName: "Assessment, Authorization, and Monitoring",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CA-9",
  },

  // =========================================================================
  // CM family (Configuration Management) - CM-1..CM-14
  // =========================================================================
  {
    controlId: "CM-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate configuration management policy and procedures, and review/update them at organization-defined frequencies.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-1",
  },
  {
    controlId: "CM-2",
    controlName: "Baseline Configuration",
    description:
      "Develop, document, and maintain a current baseline configuration of the system and review/update it at organization-defined frequencies and when required.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-2",
  },
  {
    controlId: "CM-3",
    controlName: "Configuration Change Control",
    description:
      "Determine and document the types of changes that are configuration-controlled; review, approve/disapprove, and retain records of configuration-controlled changes.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-3",
  },
  {
    controlId: "CM-4",
    controlName: "Impact Analyses",
    description:
      "Analyze changes to the system to determine potential security and privacy impacts prior to change implementation.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-4",
  },
  {
    controlId: "CM-5",
    controlName: "Access Restrictions for Change",
    description:
      "Define, document, approve, and enforce physical and logical access restrictions associated with changes to the system.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-5",
  },
  {
    controlId: "CM-6",
    controlName: "Configuration Settings",
    description:
      "Establish and document configuration settings for system components using organization-defined common secure configurations, implement settings, and identify/document/approve deviations.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-6",
  },
  {
    controlId: "CM-7",
    controlName: "Least Functionality",
    description:
      "Configure the system to provide only mission-essential capabilities and prohibit or restrict the use of organization-defined functions, ports, protocols, software, and services.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-7",
  },
  {
    controlId: "CM-8",
    controlName: "System Component Inventory",
    description:
      "Develop and document an inventory of system components that accurately reflects the system, includes all components within authorization boundaries, and is reviewed/updated at organization-defined frequencies.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-8",
  },
  {
    controlId: "CM-9",
    controlName: "Configuration Management Plan",
    description:
      "Develop, document, and implement a configuration management plan that addresses roles, responsibilities, processes, and procedures, and protects the plan from unauthorized disclosure and modification.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-9",
  },
  {
    controlId: "CM-10",
    controlName: "Software Usage Restrictions",
    description:
      "Use software and associated documentation in accordance with contract agreements and copyright laws, track use of software protected by quantity licenses, and control peer-to-peer file sharing.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-10",
  },
  {
    controlId: "CM-11",
    controlName: "User-installed Software",
    description:
      "Establish, enforce, and monitor policies governing the installation of software by users, including methods for compliance monitoring.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-11",
  },
  {
    controlId: "CM-12",
    controlName: "Information Location",
    description:
      "Identify and document the location of organization-defined information and the specific system components on which the information is processed and stored.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 CM-12",
  },
  {
    controlId: "CM-13",
    controlName: "Data Action Mapping",
    description:
      "Develop and document a map of system data actions, including elements of personally identifiable information being processed.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 CM-13",
  },
  {
    controlId: "CM-14",
    controlName: "Signed Components",
    description:
      "Prevent the installation of organization-defined software and firmware components without verification that the component has been digitally signed using a certificate that is recognized and approved.",
    family: "CM",
    familyName: "Configuration Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 CM-14",
  },
];

export default nist80053_part1;
