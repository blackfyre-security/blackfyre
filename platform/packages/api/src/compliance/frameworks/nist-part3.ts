// NIST SP 800-53 Rev 5 - base controls for PM, PS, PT, RA, SA, SC, SI, SR
// Source: NIST SP 800-53 Rev 5 (public domain)

export interface Nist80053Control {
  controlId: string;
  controlName: string;
  description: string;
  family: "PM" | "PS" | "PT" | "RA" | "SA" | "SC" | "SI" | "SR";
  familyName: string;
  weight: 1 | 2 | 3;
  baselineImpact: ("low" | "moderate" | "high")[];
  reference: string;
}

export const nist80053_part3: Nist80053Control[] = [
  // ============================================================
  // PM: Program Management (PM-1 through PM-32)
  // PM controls are deployed organization-wide and are not associated with
  // specific impact baselines (they apply to all systems).
  // ============================================================
  {
    controlId: "PM-1",
    controlName: "Information Security Program Plan",
    description:
      "Develop and disseminate an organization-wide information security program plan; review and update the plan to address organizational changes and problems identified during plan implementation or security control assessments; protect the information security program plan from unauthorized disclosure and modification.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-1",
  },
  {
    controlId: "PM-2",
    controlName: "Information Security Program Leadership Role",
    description:
      "Appoint a senior agency information security officer with the mission and resources to coordinate, develop, implement, and maintain an organization-wide information security program.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-2",
  },
  {
    controlId: "PM-3",
    controlName: "Information Security and Privacy Resources",
    description:
      "Include the resources needed to implement the information security and privacy programs in capital planning and investment requests and document all exceptions; prepare documentation required for addressing information security and privacy programs in capital planning and investment requests; make available for expenditure the planned information security and privacy resources.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-3",
  },
  {
    controlId: "PM-4",
    controlName: "Plan of Action and Milestones Process",
    description:
      "Implement a process to ensure that plans of action and milestones for the information security, privacy, and supply chain risk management programs and associated organizational systems document remedial actions, are developed and maintained, and are reported in accordance with established reporting requirements.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-4",
  },
  {
    controlId: "PM-5",
    controlName: "System Inventory",
    description:
      "Develop and update an inventory of organizational systems.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-5",
  },
  {
    controlId: "PM-6",
    controlName: "Measures of Performance",
    description:
      "Develop, monitor, and report on the results of information security and privacy measures of performance.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-6",
  },
  {
    controlId: "PM-7",
    controlName: "Enterprise Architecture",
    description:
      "Develop and maintain an enterprise architecture with consideration for information security, privacy, and the resulting risk to organizational operations and assets, individuals, other organizations, and the Nation.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-7",
  },
  {
    controlId: "PM-8",
    controlName: "Critical Infrastructure Plan",
    description:
      "Address information security and privacy issues in the development, documentation, and updating of a critical infrastructure and key resources protection plan.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-8",
  },
  {
    controlId: "PM-9",
    controlName: "Risk Management Strategy",
    description:
      "Develop a comprehensive strategy to manage security risk to organizational operations and assets, individuals, other organizations, and the Nation; privacy risk to individuals resulting from the authorized processing of PII; and supply chain risks associated with the development, acquisition, maintenance, and disposal of systems, components, and services. Implement and review/update the strategy.",
    family: "PM",
    familyName: "Program Management",
    weight: 3,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-9",
  },
  {
    controlId: "PM-10",
    controlName: "Authorization Process",
    description:
      "Manage the security and privacy state of organizational systems and the environments in which those systems operate through authorization processes; designate individuals to fulfill specific roles and responsibilities within the organizational risk management process; and integrate the authorization processes into an organization-wide risk management program.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-10",
  },
  {
    controlId: "PM-11",
    controlName: "Mission and Business Process Definition",
    description:
      "Define organizational mission and business processes with consideration for information security and privacy and the resulting risk to organizational operations, organizational assets, individuals, other organizations, and the Nation; and determine information protection and personally identifiable information processing needs arising from the defined mission and business processes.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-11",
  },
  {
    controlId: "PM-12",
    controlName: "Insider Threat Program",
    description:
      "Implement an insider threat program that includes a cross-discipline insider threat incident handling team.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-12",
  },
  {
    controlId: "PM-13",
    controlName: "Security and Privacy Workforce",
    description:
      "Establish a security and privacy workforce development and improvement program.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-13",
  },
  {
    controlId: "PM-14",
    controlName: "Testing, Training, and Monitoring",
    description:
      "Implement a process for ensuring that organizational plans for conducting security and privacy testing, training, and monitoring activities associated with organizational systems are developed and maintained, and continue to be executed; and review testing, training, and monitoring plans for consistency with the organizational risk management strategy and organization-wide priorities for risk response actions.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-14",
  },
  {
    controlId: "PM-15",
    controlName: "Security and Privacy Groups and Associations",
    description:
      "Establish and institutionalize contact with selected groups and associations within the security and privacy communities to facilitate ongoing security and privacy education and training for organizational personnel; maintain currency with recommended security and privacy practices, techniques, and technologies; and share current security and privacy information, including threats, vulnerabilities, and incidents.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-15",
  },
  {
    controlId: "PM-16",
    controlName: "Threat Awareness Program",
    description:
      "Implement a threat awareness program that includes a cross-organization information-sharing capability for threat intelligence.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-16",
  },
  {
    controlId: "PM-17",
    controlName: "Protecting Controlled Unclassified Information on External Systems",
    description:
      "Establish policy and procedures to ensure that requirements for the protection of controlled unclassified information that is processed, stored, or transmitted on external systems are implemented; and review and update the policy and procedures.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-17",
  },
  {
    controlId: "PM-18",
    controlName: "Privacy Program Plan",
    description:
      "Develop and disseminate an organization-wide privacy program plan that provides an overview of the agency's privacy program, and review and update the plan to address changes in federal privacy laws and policy and organizational changes and problems identified during plan implementation or privacy control assessments.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-18",
  },
  {
    controlId: "PM-19",
    controlName: "Privacy Program Leadership Role",
    description:
      "Appoint a senior agency official for privacy with the authority, mission, accountability, and resources to coordinate, develop, and implement, applicable privacy requirements and manage privacy risks through the organization-wide privacy program.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-19",
  },
  {
    controlId: "PM-20",
    controlName: "Dissemination of Privacy Program Information",
    description:
      "Maintain a central resource webpage on the organization's principal public website that serves as a central source of information about the organization's privacy program and that ensures that the public has access to information about organizational privacy activities and can communicate with its senior agency official for privacy; ensures that organizational privacy practices and reports are publicly available; and employs publicly facing email addresses and/or phone lines to enable the public to provide feedback and/or direct questions to privacy offices regarding privacy practices.",
    family: "PM",
    familyName: "Program Management",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-20",
  },
  {
    controlId: "PM-21",
    controlName: "Accounting of Disclosures",
    description:
      "Develop and maintain an accurate accounting of disclosures of personally identifiable information, including date, nature, and purpose of each disclosure, and the name and address, or other contact information of the individual or organization to which the disclosure was made; retain the accounting of disclosures for the length of the time the PII is maintained or five years after the disclosure is made, whichever is longer; and make the accounting of disclosures available to the individual to whom the PII relates upon request.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-21",
  },
  {
    controlId: "PM-22",
    controlName: "Personally Identifiable Information Quality Management",
    description:
      "Develop and document organization-wide policies and procedures for reviewing for the accuracy, relevance, timeliness, and completeness of personally identifiable information across the information life cycle; correcting or deleting inaccurate or outdated personally identifiable information; disseminating notice of corrected or deleted personally identifiable information to individuals or other appropriate entities; and appeals of adverse decisions on correction or deletion requests.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-22",
  },
  {
    controlId: "PM-23",
    controlName: "Data Governance Body",
    description:
      "Establish a Data Governance Body consisting of roles with responsibilities and duties of the data governance body.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-23",
  },
  {
    controlId: "PM-24",
    controlName: "Data Integrity Board",
    description:
      "Establish a Data Integrity Board to review proposals to conduct or participate in a matching program; and conduct an annual review of all matching programs in which the agency has participated.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-24",
  },
  {
    controlId: "PM-25",
    controlName: "Minimization of Personally Identifiable Information Used in Testing, Training, and Research",
    description:
      "Develop, document, and implement policies and procedures that address the use of personally identifiable information for internal testing, training, and research; limit or minimize the amount of personally identifiable information used for internal testing, training, and research; authorize the use of personally identifiable information when such information is required for internal testing, training, and research; and review and update policies and procedures.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-25",
  },
  {
    controlId: "PM-26",
    controlName: "Complaint Management",
    description:
      "Implement a process for receiving and responding to complaints, concerns, or questions from individuals about the organizational security and privacy practices that includes mechanisms that are easy to use and readily accessible by the public; all information necessary for successfully filing complaints; tracking mechanisms to ensure all complaints received are reviewed and addressed within timeframes; acknowledgement of receipt of complaints, concerns, or questions from individuals within timeframes; and response to complaints, concerns, or questions from individuals within timeframes.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-26",
  },
  {
    controlId: "PM-27",
    controlName: "Privacy Reporting",
    description:
      "Develop and disseminate privacy reports to oversight bodies, senior management, and other personnel to demonstrate accountability with statutory, regulatory, and policy privacy mandates; and review and update privacy reports.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-27",
  },
  {
    controlId: "PM-28",
    controlName: "Risk Framing",
    description:
      "Identify and document assumptions affecting risk assessments, risk responses, and risk monitoring; constraints affecting risk assessments, risk responses, and risk monitoring; priorities and trade-offs considered by the organization for managing risk; and organizational risk tolerance. Distribute the results of risk framing activities and review and update risk framing considerations.",
    family: "PM",
    familyName: "Program Management",
    weight: 3,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-28",
  },
  {
    controlId: "PM-29",
    controlName: "Risk Management Program Leadership Roles",
    description:
      "Appoint a Senior Accountable Official for Risk Management to align organizational information security and privacy management processes with strategic, operational, and budgetary planning processes; and establish a Risk Executive (function) to view and analyze risk from an organization-wide perspective and ensure management of risk is consistent across the organization.",
    family: "PM",
    familyName: "Program Management",
    weight: 3,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-29",
  },
  {
    controlId: "PM-30",
    controlName: "Supply Chain Risk Management Strategy",
    description:
      "Develop an organization-wide strategy for managing supply chain risks associated with the development, acquisition, maintenance, and disposal of systems, system components, and system services; implement the supply chain risk management strategy consistently across the organization; and review and update the supply chain risk management strategy.",
    family: "PM",
    familyName: "Program Management",
    weight: 3,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-30",
  },
  {
    controlId: "PM-31",
    controlName: "Continuous Monitoring Strategy",
    description:
      "Develop an organization-wide continuous monitoring strategy and implement continuous monitoring programs that include establishment of system-level metrics to be monitored; establishment of frequencies for monitoring and assessments supporting such monitoring; ongoing monitoring of organizationally-defined metrics; correlation and analysis of information generated by control assessments and monitoring; response actions to address results; and reporting the security and privacy status of organizational systems to personnel or roles.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-31",
  },
  {
    controlId: "PM-32",
    controlName: "Purposing",
    description:
      "Analyze organizational systems to identify what the systems are being used for to ensure they support the organization's missions and business functions, and identify redundant systems.",
    family: "PM",
    familyName: "Program Management",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PM-32",
  },

  // ============================================================
  // PS: Personnel Security (PS-1 through PS-9)
  // ============================================================
  {
    controlId: "PS-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate personnel security policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-1",
  },
  {
    controlId: "PS-2",
    controlName: "Position Risk Designation",
    description:
      "Assign a risk designation to all organizational positions; establish screening criteria for individuals filling those positions; and review and update position risk designations.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-2",
  },
  {
    controlId: "PS-3",
    controlName: "Personnel Screening",
    description:
      "Screen individuals prior to authorizing access to the system; and rescreen individuals in accordance with conditions requiring rescreening and, where rescreening is so indicated, the frequency of rescreening.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-3",
  },
  {
    controlId: "PS-4",
    controlName: "Personnel Termination",
    description:
      "Upon termination of individual employment, disable system access within time period; terminate or revoke any authenticators and credentials associated with the individual; conduct exit interviews; retrieve all security-related organizational system-related property; retain access to organizational information and systems formerly controlled by terminated individual; and notify personnel or roles within time period.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-4",
  },
  {
    controlId: "PS-5",
    controlName: "Personnel Transfer",
    description:
      "Review and confirm ongoing operational need for current logical and physical access authorizations to systems and facilities when individuals are reassigned or transferred to other positions within the organization; initiate transfer or reassignment actions following the formal transfer action; modify access authorization as needed to correspond with any changes in operational need; and notify personnel or roles.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-5",
  },
  {
    controlId: "PS-6",
    controlName: "Access Agreements",
    description:
      "Develop and document access agreements for organizational systems; review and update the access agreements; and verify that individuals requiring access to organizational information and systems sign appropriate access agreements prior to being granted access and re-sign access agreements to maintain access to organizational systems when access agreements have been updated.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-6",
  },
  {
    controlId: "PS-7",
    controlName: "External Personnel Security",
    description:
      "Establish personnel security requirements, including security roles and responsibilities for external providers; require external providers to comply with personnel security policies and procedures established by the organization; document personnel security requirements; require external providers to notify personnel or roles of any personnel transfers or terminations of external personnel who possess organizational credentials and/or badges, or who have system privileges within time period; and monitor provider compliance with personnel security requirements.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-7",
  },
  {
    controlId: "PS-8",
    controlName: "Personnel Sanctions",
    description:
      "Employ a formal sanctions process for individuals failing to comply with established information security and privacy policies and procedures; and notify personnel or roles within time period when a formal employee sanctions process is initiated, identifying the individual sanctioned and the reason for the sanction.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-8",
  },
  {
    controlId: "PS-9",
    controlName: "Position Descriptions",
    description:
      "Incorporate security and privacy roles and responsibilities into organizational position descriptions.",
    family: "PS",
    familyName: "Personnel Security",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PS-9",
  },

  // ============================================================
  // PT: PII Processing and Transparency (PT-1 through PT-8)
  // New family in Rev 5
  // ============================================================
  {
    controlId: "PT-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate personally identifiable information processing and transparency policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PT-1",
  },
  {
    controlId: "PT-2",
    controlName: "Authority to Process Personally Identifiable Information",
    description:
      "Determine and document the authority that permits the processing of personally identifiable information; and restrict the processing of personally identifiable information to only that which is authorized.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PT-2",
  },
  {
    controlId: "PT-3",
    controlName: "Personally Identifiable Information Processing Purposes",
    description:
      "Identify and document the purpose(s) for processing personally identifiable information; describe the purpose(s) in the public privacy notices and policies of the organization; restrict the processing of personally identifiable information to only that which is compatible with the identified purpose(s); and monitor changes in processing personally identifiable information and implement procedures.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PT-3",
  },
  {
    controlId: "PT-4",
    controlName: "Consent",
    description:
      "Implement tools or mechanisms for individuals to consent to the processing of their personally identifiable information prior to its collection that facilitate individuals' informed decision-making.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PT-4",
  },
  {
    controlId: "PT-5",
    controlName: "Privacy Notice",
    description:
      "Provide notice to individuals about the processing of personally identifiable information that is available to individuals upon first interacting with an organization, and subsequently; is clear and easy-to-understand, expressing information about personally identifiable information processing in plain language; identifies the authority that authorizes the processing of personally identifiable information; identifies the purposes for which personally identifiable information is to be processed; and includes organization-defined information as required.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PT-5",
  },
  {
    controlId: "PT-6",
    controlName: "System of Records Notice",
    description:
      "For systems that process information that will be maintained in a Privacy Act system of records: draft system of records notices and submit new and significantly modified system of records notices to the OMB and appropriate congressional committees for advance review; publish system of records notices in the Federal Register; and keep system of records notices accurate, up-to-date, and scoped in accordance with policy.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PT-6",
  },
  {
    controlId: "PT-7",
    controlName: "Specific Categories of Personally Identifiable Information",
    description:
      "Apply processing conditions, including additional processing requirements, for specific categories of personally identifiable information.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 PT-7",
  },
  {
    controlId: "PT-8",
    controlName: "Computer Matching Requirements",
    description:
      "When a system or organization processes information for the purpose of conducting a matching program: publish a matching notice in the Federal Register; enter into a written agreement; independently verify the information produced by the matching program before taking adverse action against an individual, if required; and provide individuals with notice and an opportunity to contest the findings before taking adverse action against an individual.",
    family: "PT",
    familyName: "PII Processing and Transparency",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 PT-8",
  },

  // ============================================================
  // RA: Risk Assessment (RA-1 through RA-10)
  // ============================================================
  {
    controlId: "RA-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate risk assessment policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-1",
  },
  {
    controlId: "RA-2",
    controlName: "Security Categorization",
    description:
      "Categorize the system and information it processes, stores, and transmits; document the security categorization results, including supporting rationale, in the security plan for the system; and verify that the authorizing official or authorizing official designated representative reviews and approves the security categorization decision.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-2",
  },
  {
    controlId: "RA-3",
    controlName: "Risk Assessment",
    description:
      "Conduct a risk assessment, including the likelihood and magnitude of harm, from the unauthorized access, use, disclosure, disruption, modification, or destruction of the system, the information it processes, stores, or transmits, and any related information; integrate risk assessment results and risk management decisions from the organization and mission or business process perspectives with system-level risk assessments; document risk assessment results; review risk assessment results; disseminate risk assessment results to personnel or roles; and update the risk assessment.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-3",
  },
  // RA-4 was withdrawn and incorporated into RA-3
  {
    controlId: "RA-5",
    controlName: "Vulnerability Monitoring and Scanning",
    description:
      "Monitor and scan for vulnerabilities in the system and hosted applications with defined frequency and/or randomly in accordance with organization-defined process and when new vulnerabilities potentially affecting the system are identified and reported; employ vulnerability monitoring tools and techniques; analyze vulnerability scan reports and results from vulnerability monitoring; remediate legitimate vulnerabilities in accordance with an organizational assessment of risk; share information obtained from the vulnerability monitoring process and control assessments with personnel or roles to help eliminate similar vulnerabilities in other systems; and employ vulnerability monitoring tools that include the capability to readily update the vulnerabilities to be scanned.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-5",
  },
  {
    controlId: "RA-6",
    controlName: "Technical Surveillance Countermeasures Survey",
    description:
      "Employ a technical surveillance countermeasures survey at locations and at a frequency or when events or indicators occur.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 RA-6",
  },
  {
    controlId: "RA-7",
    controlName: "Risk Response",
    description:
      "Respond to findings from security and privacy assessments, monitoring, and audits in accordance with organizational risk tolerance.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-7",
  },
  {
    controlId: "RA-8",
    controlName: "Privacy Impact Assessments",
    description:
      "Conduct privacy impact assessments for systems, programs, or other activities before developing or procuring information technology that processes personally identifiable information; and initiating a new collection of personally identifiable information that will be processed using information technology and includes personally identifiable information in an identifiable form permitting physical or online contact with a specific individual, if identical questions have been posed to, or identical reporting requirements imposed on, 10 or more individuals, other than agencies, instrumentalities, or employees of the federal government.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-8",
  },
  {
    controlId: "RA-9",
    controlName: "Criticality Analysis",
    description:
      "Identify critical system components and functions by performing a criticality analysis for systems, system components, or system services at decision points in the system development life cycle.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 RA-9",
  },
  {
    controlId: "RA-10",
    controlName: "Threat Hunting",
    description:
      "Establish and maintain a cyber threat hunting capability to search for indicators of compromise in organizational systems; and detect, track, and disrupt threats that evade existing controls; and employ the threat hunting capability.",
    family: "RA",
    familyName: "Risk Assessment",
    weight: 3,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 RA-10",
  },

  // ============================================================
  // SA: System and Services Acquisition (SA-1 through SA-23)
  // ============================================================
  {
    controlId: "SA-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate system and services acquisition policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-1",
  },
  {
    controlId: "SA-2",
    controlName: "Allocation of Resources",
    description:
      "Determine the high-level information security and privacy requirements for the system or system service in mission and business process planning; determine, document, and allocate the resources required to protect the system or system service as part of the organizational capital planning and investment control process; and establish a discrete line item for information security and privacy in organizational programming and budgeting documentation.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-2",
  },
  {
    controlId: "SA-3",
    controlName: "System Development Life Cycle",
    description:
      "Acquire, develop, and manage the system using a system development life cycle that incorporates information security and privacy considerations; define and document information security and privacy roles and responsibilities throughout the system development life cycle; identify individuals having information security and privacy roles and responsibilities; and integrate the organizational information security and privacy risk management process into system development life cycle activities.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-3",
  },
  {
    controlId: "SA-4",
    controlName: "Acquisition Process",
    description:
      "Include the following requirements, descriptions, and criteria, explicitly or by reference, using standardized contract language in the acquisition contract for the system, system component, or system service: security and privacy functional requirements; strength of mechanism requirements; security and privacy assurance requirements; controls needed to satisfy the security and privacy requirements; security and privacy documentation requirements; requirements for protecting security and privacy documentation; description of the system development environment and environment in which the system is intended to operate; allocation of responsibility or identification of parties responsible for information security, privacy, and supply chain risk management; and acceptance criteria.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-4",
  },
  {
    controlId: "SA-5",
    controlName: "System Documentation",
    description:
      "Obtain or develop administrator and user documentation for the system, system component, or system service that describes secure configuration, installation, and operation of the system; effective use and maintenance of security and privacy functions/mechanisms; and known vulnerabilities regarding configuration and use of administrative or privileged functions. Document attempts to obtain documentation when such documentation is either unavailable or nonexistent, and take actions in response; protect documentation as required, in accordance with the risk management strategy; and distribute documentation to personnel or roles.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-5",
  },
  // SA-6 and SA-7 were withdrawn
  {
    controlId: "SA-8",
    controlName: "Security and Privacy Engineering Principles",
    description:
      "Apply systems security and privacy engineering principles in the specification, design, development, implementation, and modification of the system and system components.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-8",
  },
  {
    controlId: "SA-9",
    controlName: "External System Services",
    description:
      "Require that providers of external system services comply with organizational security and privacy requirements and employ the following controls; define and document organizational oversight and user roles and responsibilities with regard to external system services; and employ processes, methods, and techniques to monitor control compliance by external service providers on an ongoing basis.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-9",
  },
  {
    controlId: "SA-10",
    controlName: "Developer Configuration Management",
    description:
      "Require the developer of the system, system component, or system service to perform configuration management during system, component, or service design, development, implementation, operation, and disposal; document, manage, and control the integrity of changes to configuration items under configuration management; implement only organization-approved changes to the system, component, or service; document approved changes to the system, component, or service and the potential security and privacy impacts of such changes; and track security flaws and flaw resolution within the system, component, or service and report findings to personnel.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-10",
  },
  {
    controlId: "SA-11",
    controlName: "Developer Testing and Evaluation",
    description:
      "Require the developer of the system, system component, or system service, at all post-design stages of the system development life cycle, to: develop and implement a plan for ongoing security and privacy control assessments; perform unit, integration, system, and/or regression testing/evaluation at depth and coverage; produce evidence of the execution of the assessment plan and the results of the testing and evaluation; implement a verifiable flaw remediation process; and correct flaws identified during testing and evaluation.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-11",
  },
  // SA-12, SA-13, SA-14 were withdrawn (SA-12 moved to SR family)
  {
    controlId: "SA-15",
    controlName: "Development Process, Standards, and Tools",
    description:
      "Require the developer of the system, system component, or system service to follow a documented development process that explicitly addresses security and privacy requirements; identifies the standards and tools used in the development process; documents the specific tool options and tool configurations used in the development process; and documents, manages, and ensures the integrity of changes to the process and/or tools used in development. Review the development process, standards, tools, tool options, and tool configurations to determine if the process, standards, tools, tool options and tool configurations selected and employed can satisfy security and privacy requirements.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SA-15",
  },
  {
    controlId: "SA-16",
    controlName: "Developer-provided Training",
    description:
      "Require the developer of the system, system component, or system service to provide the following training on the correct use and operation of the implemented security and privacy functions, controls, and/or mechanisms.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 1,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SA-16",
  },
  {
    controlId: "SA-17",
    controlName: "Developer Security and Privacy Architecture and Design",
    description:
      "Require the developer of the system, system component, or system service to produce a design specification and security and privacy architecture that is consistent with the organization's security and privacy architecture that is an integral part of the organization's enterprise architecture; accurately and completely describes the required security and privacy functionality, and the allocation of controls among physical and logical components; and expresses how individual security and privacy functions, mechanisms, and services work together to provide required security and privacy capabilities and a unified approach to protection.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SA-17",
  },
  // SA-18, SA-19 were withdrawn and moved to SR family
  {
    controlId: "SA-20",
    controlName: "Customized Development of Critical Components",
    description:
      "Reimplement or custom develop critical system components.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SA-20",
  },
  {
    controlId: "SA-21",
    controlName: "Developer Screening",
    description:
      "Require that the developer of system, system component, or system service has appropriate access authorizations as determined by assigned organizational missions and business functions; and satisfies organization-defined additional personnel screening criteria.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SA-21",
  },
  {
    controlId: "SA-22",
    controlName: "Unsupported System Components",
    description:
      "Replace system components when support for the components is no longer available from the developer, vendor, or manufacturer; or provide the following options for alternative sources for continued support for unsupported components.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SA-22",
  },
  {
    controlId: "SA-23",
    controlName: "Specialization",
    description:
      "Employ diversification, randomization, customization, and other techniques in the implementation of the system and system components to reduce the susceptibility to cyber-attacks and increase the resiliency of the system.",
    family: "SA",
    familyName: "System and Services Acquisition",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SA-23",
  },

  // ============================================================
  // SC: System and Communications Protection (SC-1 through SC-51)
  // Note: Several SC controls (SC-9, SC-11, SC-14, SC-25, SC-26, SC-27, SC-30, SC-33)
  // were withdrawn. SC-6, SC-35, SC-48, SC-49, SC-50, SC-51 included.
  // ============================================================
  {
    controlId: "SC-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate system and communications protection policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-1",
  },
  {
    controlId: "SC-2",
    controlName: "Separation of System and User Functionality",
    description:
      "Separate user functionality, including user interface services, from system management functionality.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-2",
  },
  {
    controlId: "SC-3",
    controlName: "Security Function Isolation",
    description:
      "Isolate security functions from nonsecurity functions.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SC-3",
  },
  {
    controlId: "SC-4",
    controlName: "Information in Shared System Resources",
    description:
      "Prevent unauthorized and unintended information transfer via shared system resources.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-4",
  },
  {
    controlId: "SC-5",
    controlName: "Denial-of-service Protection",
    description:
      "Protect against or limit the effects of denial-of-service events; and employ controls to achieve the denial-of-service objective.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-5",
  },
  {
    controlId: "SC-6",
    controlName: "Resource Availability",
    description:
      "Protect the availability of resources by allocating resources by priority, quota, or other safeguards.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-6",
  },
  {
    controlId: "SC-7",
    controlName: "Boundary Protection",
    description:
      "Monitor and control communications at the external managed interfaces to the system and at key internal managed interfaces within the system; implement subnetworks for publicly accessible system components that are physically or logically separated from internal organizational networks; and connect to external networks or systems only through managed interfaces consisting of boundary protection devices arranged in accordance with an organizational security and privacy architecture.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-7",
  },
  {
    controlId: "SC-8",
    controlName: "Transmission Confidentiality and Integrity",
    description:
      "Protect the confidentiality and integrity of transmitted information.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-8",
  },
  // SC-9 withdrawn
  {
    controlId: "SC-10",
    controlName: "Network Disconnect",
    description:
      "Terminate the network connection associated with a communications session at the end of the session or after a period of inactivity.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-10",
  },
  // SC-11 withdrawn
  {
    controlId: "SC-12",
    controlName: "Cryptographic Key Establishment and Management",
    description:
      "Establish and manage cryptographic keys when cryptography is employed within the system in accordance with the following key management requirements: key generation, distribution, storage, access, and destruction.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-12",
  },
  {
    controlId: "SC-13",
    controlName: "Cryptographic Protection",
    description:
      "Determine the cryptographic uses; and implement the following types of cryptography required for each specified cryptographic use.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-13",
  },
  // SC-14 withdrawn
  {
    controlId: "SC-15",
    controlName: "Collaborative Computing Devices and Applications",
    description:
      "Prohibit remote activation of collaborative computing devices and applications with the following exceptions; and provide an explicit indication of use to users physically present at the devices.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-15",
  },
  {
    controlId: "SC-16",
    controlName: "Transmission of Security and Privacy Attributes",
    description:
      "Associate security and privacy attributes with information exchanged between systems and between system components.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-16",
  },
  {
    controlId: "SC-17",
    controlName: "Public Key Infrastructure Certificates",
    description:
      "Issue public key certificates under an organization-defined certificate policy or obtain public key certificates from an approved service provider; and include only approved trust anchors in trust stores or certificate stores managed by the organization.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-17",
  },
  {
    controlId: "SC-18",
    controlName: "Mobile Code",
    description:
      "Define acceptable and unacceptable mobile code and mobile code technologies; and authorize, monitor, and control the use of mobile code within the system.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-18",
  },
  // SC-19 withdrawn (VoIP moved into SC-7 enhancements)
  {
    controlId: "SC-20",
    controlName: "Secure Name/Address Resolution Service (Authoritative Source)",
    description:
      "Provide additional data origin authentication and integrity verification artifacts along with the authoritative name resolution data the system returns in response to external name/address resolution queries; and provide the means to indicate the security status of child zones and (if the child supports secure resolution services) to enable verification of a chain of trust among parent and child domains, when operating as part of a distributed, hierarchical namespace.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-20",
  },
  {
    controlId: "SC-21",
    controlName: "Secure Name/Address Resolution Service (Recursive or Caching Resolver)",
    description:
      "Request and perform data origin authentication and data integrity verification on the name/address resolution responses the system receives from authoritative sources.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-21",
  },
  {
    controlId: "SC-22",
    controlName: "Architecture and Provisioning for Name/Address Resolution Service",
    description:
      "Ensure the systems that collectively provide name/address resolution service for an organization are fault-tolerant and implement internal and external role separation.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-22",
  },
  {
    controlId: "SC-23",
    controlName: "Session Authenticity",
    description:
      "Protect the authenticity of communications sessions.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-23",
  },
  {
    controlId: "SC-24",
    controlName: "Fail in Known State",
    description:
      "Fail to a known system state for the following failures on the indicated components while preserving system state information in failure.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SC-24",
  },
  {
    controlId: "SC-25",
    controlName: "Thin Nodes",
    description:
      "Employ minimal functionality and information storage on the following system components.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-25",
  },
  {
    controlId: "SC-26",
    controlName: "Decoys",
    description:
      "Include components within organizational systems specifically designed to be the target of malicious attacks for detecting, deflecting, and analyzing such attacks.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-26",
  },
  {
    controlId: "SC-27",
    controlName: "Platform-independent Applications",
    description:
      "Include within organizational systems the following platform-independent applications.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 1,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-27",
  },
  {
    controlId: "SC-28",
    controlName: "Protection of Information at Rest",
    description:
      "Protect the confidentiality and integrity of information at rest.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-28",
  },
  {
    controlId: "SC-29",
    controlName: "Heterogeneity",
    description:
      "Employ a diverse set of information technologies for the following system components in the implementation of the system.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-29",
  },
  {
    controlId: "SC-30",
    controlName: "Concealment and Misdirection",
    description:
      "Employ concealment and misdirection techniques for systems at specific time periods to confuse and mislead adversaries.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-30",
  },
  {
    controlId: "SC-31",
    controlName: "Covert Channel Analysis",
    description:
      "Perform a covert channel analysis to identify those aspects of communications within the system that are potential avenues for covert storage channels and/or covert timing channels; and estimate the maximum bandwidth of those channels.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-31",
  },
  {
    controlId: "SC-32",
    controlName: "System Partitioning",
    description:
      "Partition the system into components residing in separate physical domains or environments based on rationale for physical separation of components.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-32",
  },
  // SC-33 withdrawn
  {
    controlId: "SC-34",
    controlName: "Non-modifiable Executable Programs",
    description:
      "For system components, load and execute the operating environment from hardware-enforced, read-only media; and load and execute the following applications from hardware-enforced, read-only media.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-34",
  },
  {
    controlId: "SC-35",
    controlName: "External Malicious Code Identification",
    description:
      "Include system components that proactively identify and report on external malicious code in support of active defense objectives.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-35",
  },
  {
    controlId: "SC-36",
    controlName: "Distributed Processing and Storage",
    description:
      "Distribute processing and storage across multiple physical locations.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-36",
  },
  {
    controlId: "SC-37",
    controlName: "Out-of-band Channels",
    description:
      "Employ the following out-of-band channels for the physical delivery or electronic transmission of information, system components, or devices to individuals or systems.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-37",
  },
  {
    controlId: "SC-38",
    controlName: "Operations Security",
    description:
      "Employ the following operations security controls to protect key organizational information throughout the system development life cycle.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-38",
  },
  {
    controlId: "SC-39",
    controlName: "Process Isolation",
    description:
      "Maintain a separate execution domain for each executing system process.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SC-39",
  },
  {
    controlId: "SC-40",
    controlName: "Wireless Link Protection",
    description:
      "Protect external and internal wireless links from the following signal parameter attacks.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-40",
  },
  {
    controlId: "SC-41",
    controlName: "Port and I/O Device Access",
    description:
      "Physically or logically disable the connection of ports and input/output devices on the following systems or system components.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-41",
  },
  {
    controlId: "SC-42",
    controlName: "Sensor Capability and Data",
    description:
      "Prohibit the remote activation of environmental sensing capabilities on organizational systems or system components with the following exceptions or prohibitions; and provide an explicit indication of sensor use to the individuals.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-42",
  },
  {
    controlId: "SC-43",
    controlName: "Usage Restrictions",
    description:
      "Establish usage restrictions and implementation guidelines for the following system components; and authorize, monitor, and control the use of such components within the system.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-43",
  },
  {
    controlId: "SC-44",
    controlName: "Detonation Chambers",
    description:
      "Employ a detonation chamber capability within system components.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-44",
  },
  {
    controlId: "SC-45",
    controlName: "System Time Synchronization",
    description:
      "Synchronize system clocks within and between systems and system components.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-45",
  },
  {
    controlId: "SC-46",
    controlName: "Cross Domain Policy Enforcement",
    description:
      "Implement a policy enforcement mechanism physically or logically between the physical and/or network interfaces of the connecting security domains.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-46",
  },
  {
    controlId: "SC-47",
    controlName: "Alternate Communications Paths",
    description:
      "Establish alternate communications paths for system operations organizational command and control.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-47",
  },
  {
    controlId: "SC-48",
    controlName: "Sensor Relocation",
    description:
      "Relocate sensors and monitoring capabilities to specified locations under specified circumstances.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-48",
  },
  {
    controlId: "SC-49",
    controlName: "Hardware-enforced Separation and Policy Enforcement",
    description:
      "Implement hardware-enforced separation and policy enforcement between security domains.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-49",
  },
  {
    controlId: "SC-50",
    controlName: "Software-enforced Separation and Policy Enforcement",
    description:
      "Implement software-enforced separation and policy enforcement between security domains.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-50",
  },
  {
    controlId: "SC-51",
    controlName: "Hardware-based Protection",
    description:
      "Employ hardware-based, write-protect for system firmware components; and implement specific procedures for authorized individuals to manually disable hardware write-protect for firmware modifications and re-enable the write-protect prior to returning to operational mode.",
    family: "SC",
    familyName: "System and Communications Protection",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SC-51",
  },

  // ============================================================
  // SI: System and Information Integrity (SI-1 through SI-23)
  // ============================================================
  {
    controlId: "SI-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate system and information integrity policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-1",
  },
  {
    controlId: "SI-2",
    controlName: "Flaw Remediation",
    description:
      "Identify, report, and correct system flaws; test software and firmware updates related to flaw remediation for effectiveness and potential side effects before installation; install security-relevant software and firmware updates within time period of the release of the updates; and incorporate flaw remediation into the organizational configuration management process.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-2",
  },
  {
    controlId: "SI-3",
    controlName: "Malicious Code Protection",
    description:
      "Implement signature based and non-signature based malicious code protection mechanisms at system entry and exit points to detect and eradicate malicious code; automatically update malicious code protection mechanisms as new releases are available in accordance with organizational configuration management policy and procedures; configure malicious code protection mechanisms to perform periodic scans of the system and real-time scans of files from external sources as the files are downloaded, opened, or executed; and address the receipt of false positives during malicious code detection and eradication and the resulting potential impact on the availability of the system.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-3",
  },
  {
    controlId: "SI-4",
    controlName: "System Monitoring",
    description:
      "Monitor the system to detect attacks and indicators of potential attacks and unauthorized local, network, and remote connections; identify unauthorized use of the system; invoke internal monitoring capabilities or deploy monitoring devices strategically within the system to collect organization-determined essential information and at ad hoc locations to track specific types of transactions of interest; analyze detected events and anomalies; adjust the level of system monitoring activity when there is a change in risk; obtain legal opinion regarding system monitoring activities; and provide system monitoring information to personnel.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-4",
  },
  {
    controlId: "SI-5",
    controlName: "Security Alerts, Advisories, and Directives",
    description:
      "Receive system security alerts, advisories, and directives from external organizations on an ongoing basis; generate internal security alerts, advisories, and directives as deemed necessary; disseminate security alerts, advisories, and directives to personnel, elements within the organization, or external organizations; and implement security directives in accordance with established time frames, or notify the issuing organization of the degree of noncompliance.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-5",
  },
  {
    controlId: "SI-6",
    controlName: "Security and Privacy Function Verification",
    description:
      "Verify the correct operation of security and privacy functions; perform the verification of the functions specified at defined system transitional states, upon command by user with appropriate privilege, and/or defined frequency; alert personnel or roles to failed security and privacy verification tests; and shut the system down, restart the system, and/or perform actions when anomalies are discovered.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SI-6",
  },
  {
    controlId: "SI-7",
    controlName: "Software, Firmware, and Information Integrity",
    description:
      "Employ integrity verification tools to detect unauthorized changes to software, firmware, and information; and take actions when unauthorized changes to the software, firmware, and information are detected.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-7",
  },
  {
    controlId: "SI-8",
    controlName: "Spam Protection",
    description:
      "Employ spam protection mechanisms at system entry and exit points to detect and act on unsolicited messages; and update spam protection mechanisms when new releases are available in accordance with organizational configuration management policy and procedures.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-8",
  },
  // SI-9 withdrawn (incorporated into AC-2, AC-3, AC-5, AC-6)
  {
    controlId: "SI-10",
    controlName: "Information Input Validation",
    description:
      "Check the validity of the following information inputs.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-10",
  },
  {
    controlId: "SI-11",
    controlName: "Error Handling",
    description:
      "Generate error messages that provide information necessary for corrective actions without revealing information that could be exploited; and reveal error messages only to personnel or roles.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-11",
  },
  {
    controlId: "SI-12",
    controlName: "Information Management and Retention",
    description:
      "Manage and retain information within the system and information output from the system in accordance with applicable laws, executive orders, directives, regulations, policies, standards, guidelines and operational requirements.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-12",
  },
  {
    controlId: "SI-13",
    controlName: "Predictable Failure Prevention",
    description:
      "Determine mean time to failure (MTTF) for system components in specific environments of operation; and provide substitute system components and a means to exchange active and standby components in accordance with MTTF substitution criteria.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-13",
  },
  {
    controlId: "SI-14",
    controlName: "Non-persistence",
    description:
      "Implement non-persistent system components and services that are initiated in a known state and terminated upon end of session of use or periodically.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SI-14",
  },
  {
    controlId: "SI-15",
    controlName: "Information Output Filtering",
    description:
      "Validate information output from the following software programs and/or applications to ensure that the information is consistent with the expected content.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SI-15",
  },
  {
    controlId: "SI-16",
    controlName: "Memory Protection",
    description:
      "Implement the following controls to protect the system memory from unauthorized code execution.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-16",
  },
  {
    controlId: "SI-17",
    controlName: "Fail-safe Procedures",
    description:
      "Implement the indicated fail-safe procedures when the indicated failures occur.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-17",
  },
  {
    controlId: "SI-18",
    controlName: "Personally Identifiable Information Quality Operations",
    description:
      "Check the accuracy, relevance, timeliness, and completeness of personally identifiable information across the information life cycle with defined frequency; and correct or delete inaccurate or outdated personally identifiable information.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SI-18",
  },
  {
    controlId: "SI-19",
    controlName: "De-identification",
    description:
      "Remove the following elements of personally identifiable information from datasets; and evaluate defined frequency for effectiveness of de-identification.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-19",
  },
  {
    controlId: "SI-20",
    controlName: "Tainting",
    description:
      "Embed data or capabilities in the following systems or system components to determine if organizational data has been exfiltrated or improperly removed from the organization.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-20",
  },
  {
    controlId: "SI-21",
    controlName: "Information Refresh",
    description:
      "Refresh information in the system and system components with defined frequency or generate the information on demand and delete the information when no longer needed.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-21",
  },
  {
    controlId: "SI-22",
    controlName: "Information Diversity",
    description:
      "Identify the following alternative sources of information for essential functions and services; and use an alternative information source for the execution of essential functions or services on systems when the primary source of information is corrupted or unavailable.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-22",
  },
  {
    controlId: "SI-23",
    controlName: "Information Fragmentation",
    description:
      "Based on circumstances, fragment the information into specified fragments; and distribute the fragmented information across the specified systems or system components.",
    family: "SI",
    familyName: "System and Information Integrity",
    weight: 2,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SI-23",
  },

  // ============================================================
  // SR: Supply Chain Risk Management (SR-1 through SR-12)
  // New family in Rev 5
  // ============================================================
  {
    controlId: "SR-1",
    controlName: "Policy and Procedures",
    description:
      "Develop, document, and disseminate supply chain risk management policy and procedures; designate an official to manage the development, documentation, and dissemination of the policy and procedures; and review and update the policy and procedures.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 1,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-1",
  },
  {
    controlId: "SR-2",
    controlName: "Supply Chain Risk Management Plan",
    description:
      "Develop a plan for managing supply chain risks associated with the research and development, design, manufacturing, acquisition, delivery, integration, operations and maintenance, and disposal of the following systems, system components or system services; review and update the supply chain risk management plan; and protect the supply chain risk management plan from unauthorized disclosure and modification.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-2",
  },
  {
    controlId: "SR-3",
    controlName: "Supply Chain Controls and Processes",
    description:
      "Establish a process or processes to identify and address weaknesses or deficiencies in the supply chain elements and processes in coordination with supply chain personnel; employ the following controls to protect against supply chain risks to the system, system component, or system service and to limit the harm or consequences from supply chain-related events; and document the selected and implemented supply chain processes and controls in the security and privacy plans, supply chain risk management plan, or other document.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-3",
  },
  {
    controlId: "SR-4",
    controlName: "Provenance",
    description:
      "Document, monitor, and maintain valid provenance of the following systems, system components, and associated data.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SR-4",
  },
  {
    controlId: "SR-5",
    controlName: "Acquisition Strategies, Tools, and Methods",
    description:
      "Employ the following acquisition strategies, contract tools, and procurement methods to protect against, identify, and mitigate supply chain risks.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-5",
  },
  {
    controlId: "SR-6",
    controlName: "Supplier Assessments and Reviews",
    description:
      "Assess and review the supply chain-related risks associated with suppliers or contractors and the system, system component, or system service they provide with defined frequency.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-6",
  },
  {
    controlId: "SR-7",
    controlName: "Supply Chain Operations Security",
    description:
      "Employ the following Operations Security (OPSEC) controls to protect supply chain-related information for the system, system component, or system service.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: [],
    reference: "NIST SP 800-53 Rev 5 SR-7",
  },
  {
    controlId: "SR-8",
    controlName: "Notification Agreements",
    description:
      "Establish agreements and procedures with entities involved in the supply chain for the system, system component, or system service for the notification of supply chain compromises and results of assessments or audits.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-8",
  },
  {
    controlId: "SR-9",
    controlName: "Tamper Resistance and Detection",
    description:
      "Implement a tamper protection program for the system, system component, or system service.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["high"],
    reference: "NIST SP 800-53 Rev 5 SR-9",
  },
  {
    controlId: "SR-10",
    controlName: "Inspection of Systems or Components",
    description:
      "Inspect the following systems or system components at defined frequency, at random, and/or upon the following indications of need for inspection to detect tampering.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-10",
  },
  {
    controlId: "SR-11",
    controlName: "Component Authenticity",
    description:
      "Develop and implement anti-counterfeit policy and procedures that include the means to detect and prevent counterfeit components from entering the system; and report counterfeit system components to source of counterfeit component, external reporting organizations, and personnel or roles.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-11",
  },
  {
    controlId: "SR-12",
    controlName: "Component Disposal",
    description:
      "Dispose of data, documentation, tools, or system components using the following techniques and methods.",
    family: "SR",
    familyName: "Supply Chain Risk Management",
    weight: 3,
    baselineImpact: ["low", "moderate", "high"],
    reference: "NIST SP 800-53 Rev 5 SR-12",
  },
];
