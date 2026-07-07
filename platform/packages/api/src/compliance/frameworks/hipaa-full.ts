// HIPAA - 45 CFR Part 164 (Security Rule + Privacy Rule + Breach Notification)
// Source: eCFR.gov / HHS.gov (public)
//
// Coverage:
//   - Security Rule (164.308, 164.310, 164.312, 164.314, 164.316): every Standard
//     and every Implementation Specification (Required / Addressable).
//   - Privacy Rule (164.500-534): core standards.
//   - Breach Notification Rule (164.400-414): core standards.
//
// R/A distinction (Security Rule):
//   - "Required Implementation"    = covered entity must implement the spec.
//   - "Addressable Implementation" = covered entity must assess whether the spec
//                                    is reasonable/appropriate; if not, implement
//                                    an equivalent alternative and document.
//
// Note on Privacy / Breach Rule entries:
//   These rules do not use the Security Rule's Standard + Implementation Spec
//   taxonomy. We map each Privacy / Breach standard to specType "Standard"
//   (and, for sub-requirements explicitly written into the rule as mandatory
//   elements, "Required Implementation"). Not applicable fields (e.g.,
//   safeguardType) are left undefined.

export interface HipaaControl {
  controlId: string;              // e.g., "164.312(a)(1)"
  controlName: string;            // short title
  description: string;            // 1-2 sentence summary
  rule: "Security" | "Privacy" | "Breach Notification";
  safeguardType?: "Administrative" | "Physical" | "Technical"; // for Security Rule
  specType: "Standard" | "Required Implementation" | "Addressable Implementation";
  category: string;
  weight: 1 | 2 | 3;
  reference: string;              // "45 CFR 164.312(a)(1)"
}

export const hipaa: HipaaControl[] = [
  // ===========================================================================
  // SECURITY RULE - ADMINISTRATIVE SAFEGUARDS (45 CFR 164.308)
  // ===========================================================================

  {
    controlId: "164.308(a)(1)(i)",
    controlName: "Security Management Process",
    description:
      "Implement policies and procedures to prevent, detect, contain, and correct security violations.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Security Management Process",
    weight: 3,
    reference: "45 CFR 164.308(a)(1)(i)",
  },
  {
    controlId: "164.308(a)(1)(ii)(A)",
    controlName: "Risk Analysis",
    description:
      "Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Security Management Process",
    weight: 3,
    reference: "45 CFR 164.308(a)(1)(ii)(A)",
  },
  {
    controlId: "164.308(a)(1)(ii)(B)",
    controlName: "Risk Management",
    description:
      "Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level to comply with 164.306(a).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Security Management Process",
    weight: 3,
    reference: "45 CFR 164.308(a)(1)(ii)(B)",
  },
  {
    controlId: "164.308(a)(1)(ii)(C)",
    controlName: "Sanction Policy",
    description:
      "Apply appropriate sanctions against workforce members who fail to comply with the security policies and procedures of the covered entity or business associate.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Security Management Process",
    weight: 2,
    reference: "45 CFR 164.308(a)(1)(ii)(C)",
  },
  {
    controlId: "164.308(a)(1)(ii)(D)",
    controlName: "Information System Activity Review",
    description:
      "Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Security Management Process",
    weight: 3,
    reference: "45 CFR 164.308(a)(1)(ii)(D)",
  },

  {
    controlId: "164.308(a)(2)",
    controlName: "Assigned Security Responsibility",
    description:
      "Identify the security official who is responsible for the development and implementation of the policies and procedures required by this subpart.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Assigned Security Responsibility",
    weight: 3,
    reference: "45 CFR 164.308(a)(2)",
  },

  {
    controlId: "164.308(a)(3)(i)",
    controlName: "Workforce Security",
    description:
      "Implement policies and procedures to ensure that all workforce members have appropriate access to ePHI and to prevent those who do not have access from obtaining access to ePHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Workforce Security",
    weight: 3,
    reference: "45 CFR 164.308(a)(3)(i)",
  },
  {
    controlId: "164.308(a)(3)(ii)(A)",
    controlName: "Authorization and/or Supervision",
    description:
      "Implement procedures for the authorization and/or supervision of workforce members who work with ePHI or in locations where it might be accessed.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Workforce Security",
    weight: 2,
    reference: "45 CFR 164.308(a)(3)(ii)(A)",
  },
  {
    controlId: "164.308(a)(3)(ii)(B)",
    controlName: "Workforce Clearance Procedure",
    description:
      "Implement procedures to determine that the access of a workforce member to ePHI is appropriate.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Workforce Security",
    weight: 2,
    reference: "45 CFR 164.308(a)(3)(ii)(B)",
  },
  {
    controlId: "164.308(a)(3)(ii)(C)",
    controlName: "Termination Procedures",
    description:
      "Implement procedures for terminating access to ePHI when the employment of, or other arrangement with, a workforce member ends, or as required by 164.308(a)(3)(ii)(B).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Workforce Security",
    weight: 3,
    reference: "45 CFR 164.308(a)(3)(ii)(C)",
  },

  {
    controlId: "164.308(a)(4)(i)",
    controlName: "Information Access Management",
    description:
      "Implement policies and procedures for authorizing access to ePHI that are consistent with the applicable requirements of subpart E (Privacy Rule).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Information Access Management",
    weight: 3,
    reference: "45 CFR 164.308(a)(4)(i)",
  },
  {
    controlId: "164.308(a)(4)(ii)(A)",
    controlName: "Isolating Health Care Clearinghouse Functions",
    description:
      "If a health care clearinghouse is part of a larger organization, implement policies and procedures that protect ePHI from unauthorized access by the larger organization.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Information Access Management",
    weight: 2,
    reference: "45 CFR 164.308(a)(4)(ii)(A)",
  },
  {
    controlId: "164.308(a)(4)(ii)(B)",
    controlName: "Access Authorization",
    description:
      "Implement policies and procedures for granting access to ePHI, for example, through access to a workstation, transaction, program, process, or other mechanism.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Information Access Management",
    weight: 3,
    reference: "45 CFR 164.308(a)(4)(ii)(B)",
  },
  {
    controlId: "164.308(a)(4)(ii)(C)",
    controlName: "Access Establishment and Modification",
    description:
      "Implement policies and procedures that, based upon the entity's access authorization policies, establish, document, review, and modify a user's right of access to a workstation, transaction, program, or process.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Information Access Management",
    weight: 2,
    reference: "45 CFR 164.308(a)(4)(ii)(C)",
  },

  {
    controlId: "164.308(a)(5)(i)",
    controlName: "Security Awareness and Training",
    description:
      "Implement a security awareness and training program for all members of its workforce (including management).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Security Awareness and Training",
    weight: 3,
    reference: "45 CFR 164.308(a)(5)(i)",
  },
  {
    controlId: "164.308(a)(5)(ii)(A)",
    controlName: "Security Reminders",
    description:
      "Implement periodic security updates and reminders for the workforce.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Security Awareness and Training",
    weight: 1,
    reference: "45 CFR 164.308(a)(5)(ii)(A)",
  },
  {
    controlId: "164.308(a)(5)(ii)(B)",
    controlName: "Protection from Malicious Software",
    description:
      "Implement procedures for guarding against, detecting, and reporting malicious software.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Security Awareness and Training",
    weight: 2,
    reference: "45 CFR 164.308(a)(5)(ii)(B)",
  },
  {
    controlId: "164.308(a)(5)(ii)(C)",
    controlName: "Log-in Monitoring",
    description:
      "Implement procedures for monitoring log-in attempts and reporting discrepancies.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Security Awareness and Training",
    weight: 2,
    reference: "45 CFR 164.308(a)(5)(ii)(C)",
  },
  {
    controlId: "164.308(a)(5)(ii)(D)",
    controlName: "Password Management",
    description:
      "Implement procedures for creating, changing, and safeguarding passwords.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Security Awareness and Training",
    weight: 2,
    reference: "45 CFR 164.308(a)(5)(ii)(D)",
  },

  {
    controlId: "164.308(a)(6)(i)",
    controlName: "Security Incident Procedures",
    description:
      "Implement policies and procedures to address security incidents.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Security Incident Procedures",
    weight: 3,
    reference: "45 CFR 164.308(a)(6)(i)",
  },
  {
    controlId: "164.308(a)(6)(ii)",
    controlName: "Response and Reporting",
    description:
      "Identify and respond to suspected or known security incidents; mitigate, to the extent practicable, harmful effects of security incidents; and document security incidents and their outcomes.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Security Incident Procedures",
    weight: 3,
    reference: "45 CFR 164.308(a)(6)(ii)",
  },

  {
    controlId: "164.308(a)(7)(i)",
    controlName: "Contingency Plan",
    description:
      "Establish (and implement as needed) policies and procedures for responding to an emergency or other occurrence (for example, fire, vandalism, system failure, and natural disaster) that damages systems that contain ePHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Contingency Plan",
    weight: 3,
    reference: "45 CFR 164.308(a)(7)(i)",
  },
  {
    controlId: "164.308(a)(7)(ii)(A)",
    controlName: "Data Backup Plan",
    description:
      "Establish and implement procedures to create and maintain retrievable exact copies of ePHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Contingency Plan",
    weight: 3,
    reference: "45 CFR 164.308(a)(7)(ii)(A)",
  },
  {
    controlId: "164.308(a)(7)(ii)(B)",
    controlName: "Disaster Recovery Plan",
    description:
      "Establish (and implement as needed) procedures to restore any loss of data.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Contingency Plan",
    weight: 3,
    reference: "45 CFR 164.308(a)(7)(ii)(B)",
  },
  {
    controlId: "164.308(a)(7)(ii)(C)",
    controlName: "Emergency Mode Operation Plan",
    description:
      "Establish (and implement as needed) procedures to enable continuation of critical business processes for protection of the security of ePHI while operating in emergency mode.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Contingency Plan",
    weight: 3,
    reference: "45 CFR 164.308(a)(7)(ii)(C)",
  },
  {
    controlId: "164.308(a)(7)(ii)(D)",
    controlName: "Testing and Revision Procedures",
    description:
      "Implement procedures for periodic testing and revision of contingency plans.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Contingency Plan",
    weight: 2,
    reference: "45 CFR 164.308(a)(7)(ii)(D)",
  },
  {
    controlId: "164.308(a)(7)(ii)(E)",
    controlName: "Applications and Data Criticality Analysis",
    description:
      "Assess the relative criticality of specific applications and data in support of other contingency plan components.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Addressable Implementation",
    category: "Contingency Plan",
    weight: 2,
    reference: "45 CFR 164.308(a)(7)(ii)(E)",
  },

  {
    controlId: "164.308(a)(8)",
    controlName: "Evaluation",
    description:
      "Perform a periodic technical and nontechnical evaluation, based initially upon the standards implemented under this rule and, subsequently, in response to environmental or operational changes affecting the security of ePHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Evaluation",
    weight: 3,
    reference: "45 CFR 164.308(a)(8)",
  },

  {
    controlId: "164.308(b)(1)",
    controlName: "Business Associate Contracts and Other Arrangements",
    description:
      "A covered entity may permit a business associate to create, receive, maintain, or transmit ePHI on its behalf only if the covered entity obtains satisfactory assurances that the business associate will appropriately safeguard the information.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Business Associate Contracts",
    weight: 3,
    reference: "45 CFR 164.308(b)(1)",
  },
  {
    controlId: "164.308(b)(3)",
    controlName: "Written Contract or Other Arrangement",
    description:
      "Document the satisfactory assurances required by this standard through a written contract or other arrangement with the business associate that meets the applicable requirements of 164.314(a).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Business Associate Contracts",
    weight: 3,
    reference: "45 CFR 164.308(b)(3)",
  },

  // ===========================================================================
  // SECURITY RULE - PHYSICAL SAFEGUARDS (45 CFR 164.310)
  // ===========================================================================

  {
    controlId: "164.310(a)(1)",
    controlName: "Facility Access Controls",
    description:
      "Implement policies and procedures to limit physical access to its electronic information systems and the facility or facilities in which they are housed, while ensuring that properly authorized access is allowed.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Standard",
    category: "Facility Access Controls",
    weight: 3,
    reference: "45 CFR 164.310(a)(1)",
  },
  {
    controlId: "164.310(a)(2)(i)",
    controlName: "Contingency Operations",
    description:
      "Establish (and implement as needed) procedures that allow facility access in support of restoration of lost data under the disaster recovery plan and emergency mode operations plan in the event of an emergency.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Addressable Implementation",
    category: "Facility Access Controls",
    weight: 2,
    reference: "45 CFR 164.310(a)(2)(i)",
  },
  {
    controlId: "164.310(a)(2)(ii)",
    controlName: "Facility Security Plan",
    description:
      "Implement policies and procedures to safeguard the facility and the equipment therein from unauthorized physical access, tampering, and theft.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Addressable Implementation",
    category: "Facility Access Controls",
    weight: 2,
    reference: "45 CFR 164.310(a)(2)(ii)",
  },
  {
    controlId: "164.310(a)(2)(iii)",
    controlName: "Access Control and Validation Procedures",
    description:
      "Implement procedures to control and validate a person's access to facilities based on their role or function, including visitor control, and control of access to software programs for testing and revision.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Addressable Implementation",
    category: "Facility Access Controls",
    weight: 2,
    reference: "45 CFR 164.310(a)(2)(iii)",
  },
  {
    controlId: "164.310(a)(2)(iv)",
    controlName: "Maintenance Records",
    description:
      "Implement policies and procedures to document repairs and modifications to the physical components of a facility which are related to security (for example, hardware, walls, doors, and locks).",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Addressable Implementation",
    category: "Facility Access Controls",
    weight: 1,
    reference: "45 CFR 164.310(a)(2)(iv)",
  },

  {
    controlId: "164.310(b)",
    controlName: "Workstation Use",
    description:
      "Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation or class of workstation that can access ePHI.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Standard",
    category: "Workstation Use",
    weight: 2,
    reference: "45 CFR 164.310(b)",
  },

  {
    controlId: "164.310(c)",
    controlName: "Workstation Security",
    description:
      "Implement physical safeguards for all workstations that access ePHI, to restrict access to authorized users.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Standard",
    category: "Workstation Security",
    weight: 3,
    reference: "45 CFR 164.310(c)",
  },

  {
    controlId: "164.310(d)(1)",
    controlName: "Device and Media Controls",
    description:
      "Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain ePHI, into and out of a facility, and the movement of these items within the facility.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Standard",
    category: "Device and Media Controls",
    weight: 3,
    reference: "45 CFR 164.310(d)(1)",
  },
  {
    controlId: "164.310(d)(2)(i)",
    controlName: "Disposal",
    description:
      "Implement policies and procedures to address the final disposition of ePHI, and/or the hardware or electronic media on which it is stored.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Required Implementation",
    category: "Device and Media Controls",
    weight: 3,
    reference: "45 CFR 164.310(d)(2)(i)",
  },
  {
    controlId: "164.310(d)(2)(ii)",
    controlName: "Media Re-use",
    description:
      "Implement procedures for removal of ePHI from electronic media before the media are made available for re-use.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Required Implementation",
    category: "Device and Media Controls",
    weight: 3,
    reference: "45 CFR 164.310(d)(2)(ii)",
  },
  {
    controlId: "164.310(d)(2)(iii)",
    controlName: "Accountability",
    description:
      "Maintain a record of the movements of hardware and electronic media and any person responsible therefore.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Addressable Implementation",
    category: "Device and Media Controls",
    weight: 2,
    reference: "45 CFR 164.310(d)(2)(iii)",
  },
  {
    controlId: "164.310(d)(2)(iv)",
    controlName: "Data Backup and Storage",
    description:
      "Create a retrievable, exact copy of ePHI, when needed, before movement of equipment.",
    rule: "Security",
    safeguardType: "Physical",
    specType: "Addressable Implementation",
    category: "Device and Media Controls",
    weight: 2,
    reference: "45 CFR 164.310(d)(2)(iv)",
  },

  // ===========================================================================
  // SECURITY RULE - TECHNICAL SAFEGUARDS (45 CFR 164.312)
  // ===========================================================================

  {
    controlId: "164.312(a)(1)",
    controlName: "Access Control",
    description:
      "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights as specified in 164.308(a)(4).",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Standard",
    category: "Access Control",
    weight: 3,
    reference: "45 CFR 164.312(a)(1)",
  },
  {
    controlId: "164.312(a)(2)(i)",
    controlName: "Unique User Identification",
    description:
      "Assign a unique name and/or number for identifying and tracking user identity.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Required Implementation",
    category: "Access Control",
    weight: 3,
    reference: "45 CFR 164.312(a)(2)(i)",
  },
  {
    controlId: "164.312(a)(2)(ii)",
    controlName: "Emergency Access Procedure",
    description:
      "Establish (and implement as needed) procedures for obtaining necessary ePHI during an emergency.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Required Implementation",
    category: "Access Control",
    weight: 3,
    reference: "45 CFR 164.312(a)(2)(ii)",
  },
  {
    controlId: "164.312(a)(2)(iii)",
    controlName: "Automatic Logoff",
    description:
      "Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Addressable Implementation",
    category: "Access Control",
    weight: 2,
    reference: "45 CFR 164.312(a)(2)(iii)",
  },
  {
    controlId: "164.312(a)(2)(iv)",
    controlName: "Encryption and Decryption",
    description:
      "Implement a mechanism to encrypt and decrypt ePHI.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Addressable Implementation",
    category: "Access Control",
    weight: 3,
    reference: "45 CFR 164.312(a)(2)(iv)",
  },

  {
    controlId: "164.312(b)",
    controlName: "Audit Controls",
    description:
      "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Standard",
    category: "Audit Controls",
    weight: 3,
    reference: "45 CFR 164.312(b)",
  },

  {
    controlId: "164.312(c)(1)",
    controlName: "Integrity",
    description:
      "Implement policies and procedures to protect ePHI from improper alteration or destruction.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Standard",
    category: "Integrity",
    weight: 3,
    reference: "45 CFR 164.312(c)(1)",
  },
  {
    controlId: "164.312(c)(2)",
    controlName: "Mechanism to Authenticate ePHI",
    description:
      "Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Addressable Implementation",
    category: "Integrity",
    weight: 2,
    reference: "45 CFR 164.312(c)(2)",
  },

  {
    controlId: "164.312(d)",
    controlName: "Person or Entity Authentication",
    description:
      "Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Standard",
    category: "Person or Entity Authentication",
    weight: 3,
    reference: "45 CFR 164.312(d)",
  },

  {
    controlId: "164.312(e)(1)",
    controlName: "Transmission Security",
    description:
      "Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Standard",
    category: "Transmission Security",
    weight: 3,
    reference: "45 CFR 164.312(e)(1)",
  },
  {
    controlId: "164.312(e)(2)(i)",
    controlName: "Integrity Controls",
    description:
      "Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection until disposed of.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Addressable Implementation",
    category: "Transmission Security",
    weight: 2,
    reference: "45 CFR 164.312(e)(2)(i)",
  },
  {
    controlId: "164.312(e)(2)(ii)",
    controlName: "Encryption",
    description:
      "Implement a mechanism to encrypt ePHI whenever deemed appropriate.",
    rule: "Security",
    safeguardType: "Technical",
    specType: "Addressable Implementation",
    category: "Transmission Security",
    weight: 3,
    reference: "45 CFR 164.312(e)(2)(ii)",
  },

  // ===========================================================================
  // SECURITY RULE - ORGANIZATIONAL REQUIREMENTS (45 CFR 164.314)
  // ===========================================================================

  {
    controlId: "164.314(a)(1)",
    controlName: "Business Associate Contracts or Other Arrangements",
    description:
      "The contract or other arrangement between the covered entity and its business associate required by 164.308(b) must meet the requirements of 164.314(a)(2).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Organizational Requirements",
    weight: 3,
    reference: "45 CFR 164.314(a)(1)",
  },
  {
    controlId: "164.314(a)(2)(i)",
    controlName: "Business Associate Contract Provisions",
    description:
      "The contract must provide that the business associate will comply with the applicable requirements of the Security Rule, ensure subcontractors agree to the same restrictions, and report security incidents including breaches of unsecured PHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 3,
    reference: "45 CFR 164.314(a)(2)(i)",
  },
  {
    controlId: "164.314(a)(2)(ii)",
    controlName: "Other Arrangements",
    description:
      "When a covered entity and its business associate are both governmental entities, the requirements of 164.314(a)(2)(i) may be satisfied by a memorandum of understanding or by other law/regulation containing equivalent requirements.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 2,
    reference: "45 CFR 164.314(a)(2)(ii)",
  },
  {
    controlId: "164.314(a)(2)(iii)",
    controlName: "Business Associate Contracts with Subcontractors",
    description:
      "The requirements of 164.314(a)(2)(i) and (ii) apply to the contract or other arrangement between a business associate and a subcontractor required by 164.308(b)(4) in the same manner as such requirements apply to contracts between covered entities and business associates.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 3,
    reference: "45 CFR 164.314(a)(2)(iii)",
  },

  {
    controlId: "164.314(b)(1)",
    controlName: "Requirements for Group Health Plans",
    description:
      "Except where the sole disclosure is of summary information or enrollment/disenrollment information, the plan documents of the group health plan must be amended to incorporate safeguards for ePHI as required by 164.314(b)(2).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Organizational Requirements",
    weight: 2,
    reference: "45 CFR 164.314(b)(1)",
  },
  {
    controlId: "164.314(b)(2)(i)",
    controlName: "Implement Safeguards (Group Health Plan)",
    description:
      "Plan documents must require the plan sponsor to reasonably and appropriately safeguard ePHI created, received, maintained, or transmitted to or by the plan sponsor on behalf of the group health plan.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 2,
    reference: "45 CFR 164.314(b)(2)(i)",
  },
  {
    controlId: "164.314(b)(2)(ii)",
    controlName: "Ensure Agent Safeguards (Group Health Plan)",
    description:
      "Plan documents must require the plan sponsor to ensure that any agent to whom it provides ePHI agrees to implement reasonable and appropriate security measures to protect the information.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 2,
    reference: "45 CFR 164.314(b)(2)(ii)",
  },
  {
    controlId: "164.314(b)(2)(iii)",
    controlName: "Separation of Plan Sponsor (Group Health Plan)",
    description:
      "Plan documents must require the plan sponsor to ensure adequate separation required by 164.504(f)(2)(iii) is supported by reasonable and appropriate security measures.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 2,
    reference: "45 CFR 164.314(b)(2)(iii)",
  },
  {
    controlId: "164.314(b)(2)(iv)",
    controlName: "Report Security Incidents (Group Health Plan)",
    description:
      "Plan documents must require the plan sponsor to report to the group health plan any security incident of which it becomes aware.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Organizational Requirements",
    weight: 2,
    reference: "45 CFR 164.314(b)(2)(iv)",
  },

  // ===========================================================================
  // SECURITY RULE - POLICIES & PROCEDURES AND DOCUMENTATION (45 CFR 164.316)
  // ===========================================================================

  {
    controlId: "164.316(a)",
    controlName: "Policies and Procedures",
    description:
      "Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, or other requirements of this subpart, taking into account the factors specified in 164.306(b)(2).",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Policies and Procedures and Documentation",
    weight: 3,
    reference: "45 CFR 164.316(a)",
  },
  {
    controlId: "164.316(b)(1)",
    controlName: "Documentation",
    description:
      "Maintain the policies and procedures implemented to comply with this subpart in written (which may be electronic) form; and if an action, activity, or assessment is required to be documented, maintain a written (which may be electronic) record of the action, activity, or assessment.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Standard",
    category: "Policies and Procedures and Documentation",
    weight: 3,
    reference: "45 CFR 164.316(b)(1)",
  },
  {
    controlId: "164.316(b)(2)(i)",
    controlName: "Time Limit (Documentation Retention)",
    description:
      "Retain the documentation required by 164.316(b)(1) for 6 years from the date of its creation or the date when it last was in effect, whichever is later.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Policies and Procedures and Documentation",
    weight: 2,
    reference: "45 CFR 164.316(b)(2)(i)",
  },
  {
    controlId: "164.316(b)(2)(ii)",
    controlName: "Availability (Documentation)",
    description:
      "Make documentation available to those persons responsible for implementing the procedures to which the documentation pertains.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Policies and Procedures and Documentation",
    weight: 2,
    reference: "45 CFR 164.316(b)(2)(ii)",
  },
  {
    controlId: "164.316(b)(2)(iii)",
    controlName: "Updates (Documentation)",
    description:
      "Review documentation periodically, and update as needed, in response to environmental or operational changes affecting the security of the ePHI.",
    rule: "Security",
    safeguardType: "Administrative",
    specType: "Required Implementation",
    category: "Policies and Procedures and Documentation",
    weight: 2,
    reference: "45 CFR 164.316(b)(2)(iii)",
  },

  // ===========================================================================
  // PRIVACY RULE - 45 CFR Part 164 Subpart E (164.500-534)
  // ===========================================================================

  {
    controlId: "164.502(a)",
    controlName: "Uses and Disclosures of PHI - General Rules",
    description:
      "A covered entity or business associate may not use or disclose PHI except as permitted or required by the Privacy Rule. Permitted uses/disclosures include to the individual, for treatment/payment/health care operations (TPO), pursuant to authorization, and as otherwise permitted or required.",
    rule: "Privacy",
    specType: "Standard",
    category: "Uses and Disclosures",
    weight: 3,
    reference: "45 CFR 164.502(a)",
  },
  {
    controlId: "164.502(b)",
    controlName: "Minimum Necessary",
    description:
      "When using or disclosing PHI, or when requesting PHI from another covered entity, a covered entity must make reasonable efforts to limit PHI to the minimum necessary to accomplish the intended purpose.",
    rule: "Privacy",
    specType: "Standard",
    category: "Minimum Necessary",
    weight: 3,
    reference: "45 CFR 164.502(b)",
  },
  {
    controlId: "164.502(e)",
    controlName: "Disclosures to Business Associates",
    description:
      "A covered entity may disclose PHI to a business associate and may allow a business associate to create, receive, maintain, or transmit PHI on its behalf only if the covered entity obtains satisfactory assurances that the business associate will appropriately safeguard the information.",
    rule: "Privacy",
    specType: "Standard",
    category: "Business Associates",
    weight: 3,
    reference: "45 CFR 164.502(e)",
  },
  {
    controlId: "164.502(g)",
    controlName: "Personal Representatives",
    description:
      "A covered entity must, except as otherwise provided, treat a personal representative as the individual for purposes of this subchapter with respect to PHI relevant to such personal representation.",
    rule: "Privacy",
    specType: "Standard",
    category: "Personal Representatives",
    weight: 2,
    reference: "45 CFR 164.502(g)",
  },

  {
    controlId: "164.504(e)",
    controlName: "Business Associate Contracts",
    description:
      "The contract between a covered entity and a business associate must establish permitted and required uses/disclosures of PHI by the business associate and include required provisions regarding safeguards, breach reporting, subcontractors, termination, and return/destruction of PHI.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Business Associates",
    weight: 3,
    reference: "45 CFR 164.504(e)",
  },
  {
    controlId: "164.504(f)",
    controlName: "Group Health Plan Requirements",
    description:
      "A group health plan may disclose PHI to the plan sponsor only if certain requirements are met, including amendment of the plan documents to restrict uses/disclosures and provide adequate separation.",
    rule: "Privacy",
    specType: "Standard",
    category: "Group Health Plans",
    weight: 2,
    reference: "45 CFR 164.504(f)",
  },

  {
    controlId: "164.506",
    controlName: "Uses and Disclosures for Treatment, Payment, and Health Care Operations",
    description:
      "A covered entity may use or disclose PHI for its own treatment, payment, and health care operations activities, and may disclose PHI to another covered entity for certain TPO activities, without an authorization.",
    rule: "Privacy",
    specType: "Standard",
    category: "Uses and Disclosures",
    weight: 3,
    reference: "45 CFR 164.506",
  },

  {
    controlId: "164.508(a)",
    controlName: "Authorization Required",
    description:
      "Except as otherwise permitted, a covered entity may not use or disclose PHI without a valid authorization. Uses and disclosures of psychotherapy notes and marketing communications (with limited exceptions) require authorization. Sale of PHI requires authorization.",
    rule: "Privacy",
    specType: "Standard",
    category: "Authorizations",
    weight: 3,
    reference: "45 CFR 164.508(a)",
  },
  {
    controlId: "164.508(c)",
    controlName: "Implementation Specifications - Core Elements of Authorization",
    description:
      "A valid authorization must contain, at minimum: specific description of information, identification of persons authorized to use/disclose and receive, description of each purpose, expiration date or event, signature and date, and required statements about revocation, re-disclosure, and conditioning.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Authorizations",
    weight: 3,
    reference: "45 CFR 164.508(c)",
  },

  {
    controlId: "164.510",
    controlName: "Uses and Disclosures Requiring Opportunity to Agree or Object",
    description:
      "A covered entity may use or disclose PHI, provided the individual is informed in advance and has the opportunity to agree to, prohibit, or restrict the use/disclosure, for facility directories and for disclosures to persons involved in the individual's care or notification purposes.",
    rule: "Privacy",
    specType: "Standard",
    category: "Uses and Disclosures",
    weight: 2,
    reference: "45 CFR 164.510",
  },

  {
    controlId: "164.512",
    controlName: "Uses and Disclosures Not Requiring Authorization",
    description:
      "A covered entity may use or disclose PHI without an authorization or opportunity to agree or object for 12 specified public-interest purposes, including: required by law, public health, victims of abuse, health oversight, judicial/administrative proceedings, law enforcement, decedents, organ donation, research, serious threat to health/safety, specialized government functions, and workers' compensation.",
    rule: "Privacy",
    specType: "Standard",
    category: "Uses and Disclosures",
    weight: 3,
    reference: "45 CFR 164.512",
  },

  {
    controlId: "164.514(a)",
    controlName: "De-identification of PHI",
    description:
      "Health information is not individually identifiable if it does not identify an individual and there is no reasonable basis to believe it can be used to identify the individual. Two methods are permitted: Expert Determination and Safe Harbor (removal of 18 specified identifiers).",
    rule: "Privacy",
    specType: "Standard",
    category: "De-identification",
    weight: 3,
    reference: "45 CFR 164.514(a)-(b)",
  },
  {
    controlId: "164.514(d)",
    controlName: "Minimum Necessary Requirements",
    description:
      "A covered entity must identify persons or classes of persons in its workforce who need access to PHI, the categories of PHI needed, and conditions of access; and establish policies for routine/recurring disclosures and requests limited to minimum necessary.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Minimum Necessary",
    weight: 3,
    reference: "45 CFR 164.514(d)",
  },
  {
    controlId: "164.514(e)",
    controlName: "Limited Data Set",
    description:
      "A covered entity may use or disclose a limited data set (PHI with 16 direct identifiers removed) for purposes of research, public health, or health care operations, pursuant to a data use agreement.",
    rule: "Privacy",
    specType: "Standard",
    category: "De-identification",
    weight: 2,
    reference: "45 CFR 164.514(e)",
  },
  {
    controlId: "164.514(f)",
    controlName: "Fundraising Communications",
    description:
      "A covered entity may use, or disclose to a business associate or institutionally related foundation, certain PHI for fundraising, subject to specified conditions including opt-out notice and opportunity.",
    rule: "Privacy",
    specType: "Standard",
    category: "Uses and Disclosures",
    weight: 1,
    reference: "45 CFR 164.514(f)",
  },
  {
    controlId: "164.514(g)",
    controlName: "Underwriting and Related Purposes",
    description:
      "A health plan that receives PHI for underwriting, premium rating, or other related activities, and does not enroll the individual, may use or disclose the PHI only for such purposes or as required by law (and may not use genetic information for underwriting).",
    rule: "Privacy",
    specType: "Standard",
    category: "Uses and Disclosures",
    weight: 2,
    reference: "45 CFR 164.514(g)",
  },

  {
    controlId: "164.520",
    controlName: "Notice of Privacy Practices (NPP)",
    description:
      "An individual has a right to adequate notice of the uses and disclosures of PHI that may be made by the covered entity, and of the individual's rights and the covered entity's legal duties with respect to PHI. The notice must contain specified content and be provided/posted as required.",
    rule: "Privacy",
    specType: "Standard",
    category: "Individual Rights",
    weight: 3,
    reference: "45 CFR 164.520",
  },

  {
    controlId: "164.522(a)",
    controlName: "Right to Request Restriction of Uses and Disclosures",
    description:
      "An individual has the right to request that a covered entity restrict uses/disclosures of PHI for TPO and to persons involved in the individual's care. The covered entity must agree to restrict disclosures to a health plan for items/services paid in full out of pocket.",
    rule: "Privacy",
    specType: "Standard",
    category: "Individual Rights",
    weight: 2,
    reference: "45 CFR 164.522(a)",
  },
  {
    controlId: "164.522(b)",
    controlName: "Confidential Communications Requirements",
    description:
      "A covered health care provider must permit individuals to request and accommodate reasonable requests by individuals to receive communications of PHI by alternative means or at alternative locations.",
    rule: "Privacy",
    specType: "Standard",
    category: "Individual Rights",
    weight: 2,
    reference: "45 CFR 164.522(b)",
  },

  {
    controlId: "164.524",
    controlName: "Access of Individuals to PHI",
    description:
      "An individual has a right of access to inspect and obtain a copy of PHI in a designated record set, for as long as maintained, including in electronic form if so maintained, within 30 days (one 30-day extension allowed), subject to limited grounds for denial.",
    rule: "Privacy",
    specType: "Standard",
    category: "Individual Rights",
    weight: 3,
    reference: "45 CFR 164.524",
  },

  {
    controlId: "164.526",
    controlName: "Amendment of PHI",
    description:
      "An individual has the right to have a covered entity amend PHI or a record about the individual in a designated record set. The covered entity must act within 60 days (one 30-day extension allowed) and may deny under specified grounds; denials trigger procedural rights for the individual.",
    rule: "Privacy",
    specType: "Standard",
    category: "Individual Rights",
    weight: 2,
    reference: "45 CFR 164.526",
  },

  {
    controlId: "164.528",
    controlName: "Accounting of Disclosures of PHI",
    description:
      "An individual has a right to receive an accounting of disclosures of PHI made by a covered entity in the six years prior to the date of the request, with specified exceptions (including TPO, authorized disclosures, to the individual, incidental, and others).",
    rule: "Privacy",
    specType: "Standard",
    category: "Individual Rights",
    weight: 2,
    reference: "45 CFR 164.528",
  },

  {
    controlId: "164.530(a)",
    controlName: "Privacy Personnel",
    description:
      "A covered entity must designate a privacy official responsible for the development and implementation of its privacy policies and procedures, and designate a contact person or office responsible for receiving complaints and providing further information about the NPP.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 3,
    reference: "45 CFR 164.530(a)",
  },
  {
    controlId: "164.530(b)",
    controlName: "Training",
    description:
      "A covered entity must train all members of its workforce on its privacy policies and procedures, as necessary and appropriate for workforce members to carry out their functions, including for new workforce members and when material changes occur.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 3,
    reference: "45 CFR 164.530(b)",
  },
  {
    controlId: "164.530(c)",
    controlName: "Safeguards (Privacy)",
    description:
      "A covered entity must have in place appropriate administrative, technical, and physical safeguards to protect the privacy of PHI, and reasonably safeguard PHI from any intentional or unintentional use or disclosure in violation of the Privacy Rule.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 3,
    reference: "45 CFR 164.530(c)",
  },
  {
    controlId: "164.530(d)",
    controlName: "Complaints to the Covered Entity",
    description:
      "A covered entity must provide a process for individuals to make complaints concerning its policies, procedures, or compliance with the Privacy Rule, and document all complaints received and their disposition.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 2,
    reference: "45 CFR 164.530(d)",
  },
  {
    controlId: "164.530(e)",
    controlName: "Sanctions (Privacy)",
    description:
      "A covered entity must have and apply appropriate sanctions against workforce members who fail to comply with the privacy policies and procedures of the covered entity or with the Privacy Rule, and document any sanctions that are applied.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 2,
    reference: "45 CFR 164.530(e)",
  },
  {
    controlId: "164.530(f)",
    controlName: "Mitigation",
    description:
      "A covered entity must mitigate, to the extent practicable, any harmful effect that is known to the covered entity of a use or disclosure of PHI in violation of its policies and procedures or the Privacy Rule by the covered entity or its business associate.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 2,
    reference: "45 CFR 164.530(f)",
  },
  {
    controlId: "164.530(g)",
    controlName: "Refraining from Intimidating or Retaliatory Acts",
    description:
      "A covered entity may not intimidate, threaten, coerce, discriminate against, or take other retaliatory action against any individual for the exercise of rights under, or participation in any process established by, the Privacy Rule; and must not require waiver of rights as a condition of service.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 2,
    reference: "45 CFR 164.530(g)-(h)",
  },
  {
    controlId: "164.530(i)",
    controlName: "Policies and Procedures (Privacy)",
    description:
      "A covered entity must implement policies and procedures with respect to PHI that are designed to comply with the standards, implementation specifications, or other requirements of the Privacy Rule.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 3,
    reference: "45 CFR 164.530(i)",
  },
  {
    controlId: "164.530(j)",
    controlName: "Documentation (Privacy)",
    description:
      "A covered entity must maintain the policies and procedures in written or electronic form, and any communication, action, activity, or designation required by the Privacy Rule in written/electronic form, for six years from the date of creation or the date last in effect, whichever is later.",
    rule: "Privacy",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 2,
    reference: "45 CFR 164.530(j)",
  },

  {
    controlId: "164.532",
    controlName: "Transition Provisions",
    description:
      "Specifies transition rules under which certain pre-existing authorizations, consents, and other express legal permissions remain effective for uses and disclosures of PHI.",
    rule: "Privacy",
    specType: "Standard",
    category: "Transition",
    weight: 1,
    reference: "45 CFR 164.532",
  },

  // ===========================================================================
  // BREACH NOTIFICATION RULE - 45 CFR Part 164 Subpart D (164.400-414)
  // ===========================================================================

  {
    controlId: "164.402",
    controlName: "Definition of Breach",
    description:
      "A breach is the acquisition, access, use, or disclosure of PHI in a manner not permitted by the Privacy Rule which compromises the security or privacy of the PHI. A breach is presumed unless the covered entity or business associate demonstrates a low probability that the PHI has been compromised based on a four-factor risk assessment.",
    rule: "Breach Notification",
    specType: "Standard",
    category: "Breach Definition",
    weight: 3,
    reference: "45 CFR 164.402",
  },

  {
    controlId: "164.404(a)",
    controlName: "Notification to Individuals - Standard",
    description:
      "A covered entity must, following the discovery of a breach of unsecured PHI, notify each individual whose unsecured PHI has been, or is reasonably believed to have been, accessed, acquired, used, or disclosed as a result of the breach.",
    rule: "Breach Notification",
    specType: "Standard",
    category: "Individual Notification",
    weight: 3,
    reference: "45 CFR 164.404(a)",
  },
  {
    controlId: "164.404(b)",
    controlName: "Timeliness of Notification to Individuals",
    description:
      "Notification to affected individuals must be made without unreasonable delay and in no case later than 60 calendar days after discovery of a breach.",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "Individual Notification",
    weight: 3,
    reference: "45 CFR 164.404(b)",
  },
  {
    controlId: "164.404(c)",
    controlName: "Content of Notification to Individuals",
    description:
      "Individual notification must include a brief description of what happened, the types of unsecured PHI involved, steps individuals should take to protect themselves, a brief description of what the covered entity is doing to investigate/mitigate/prevent, and contact procedures including a toll-free number, email, website, or postal address.",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "Individual Notification",
    weight: 3,
    reference: "45 CFR 164.404(c)",
  },
  {
    controlId: "164.404(d)",
    controlName: "Methods of Individual Notification",
    description:
      "Notification must be by first-class mail at the last known address (or by email if the individual has agreed). Substitute notice is required if contact information is insufficient/out-of-date; for 10+ affected individuals with stale contact info, substitute notice includes conspicuous posting on the covered entity's website for 90 days or major print/broadcast media notice, plus a toll-free number active for at least 90 days. Urgent notice by phone or other means may also be made.",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "Individual Notification",
    weight: 3,
    reference: "45 CFR 164.404(d)",
  },

  {
    controlId: "164.406",
    controlName: "Notification to the Media",
    description:
      "For a breach of unsecured PHI involving more than 500 residents of a state or jurisdiction, a covered entity must notify prominent media outlets serving the state or jurisdiction, without unreasonable delay and in no case later than 60 calendar days after discovery. Content must meet the requirements of 164.404(c).",
    rule: "Breach Notification",
    specType: "Standard",
    category: "Media Notification",
    weight: 3,
    reference: "45 CFR 164.406",
  },

  {
    controlId: "164.408(a)",
    controlName: "Notification to the Secretary - Standard",
    description:
      "Following the discovery of a breach of unsecured PHI, a covered entity must notify the Secretary of HHS in the manner specified on the HHS website.",
    rule: "Breach Notification",
    specType: "Standard",
    category: "HHS Notification",
    weight: 3,
    reference: "45 CFR 164.408(a)",
  },
  {
    controlId: "164.408(b)",
    controlName: "Notification to HHS for Breaches Involving 500+ Individuals",
    description:
      "For a breach involving 500 or more individuals, the covered entity must notify the Secretary contemporaneously with the notice to affected individuals (without unreasonable delay and in no case later than 60 calendar days after discovery).",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "HHS Notification",
    weight: 3,
    reference: "45 CFR 164.408(b)",
  },
  {
    controlId: "164.408(c)",
    controlName: "Notification to HHS for Breaches Involving Fewer than 500 Individuals",
    description:
      "For breaches involving fewer than 500 individuals, the covered entity must maintain a log or other documentation and submit notice to the Secretary annually, no later than 60 days after the end of the calendar year, for breaches discovered during that year.",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "HHS Notification",
    weight: 2,
    reference: "45 CFR 164.408(c)",
  },

  {
    controlId: "164.410",
    controlName: "Notification by a Business Associate",
    description:
      "A business associate must, following the discovery of a breach of unsecured PHI, notify the covered entity of the breach without unreasonable delay and in no case later than 60 calendar days after discovery, and provide (to the extent possible) the identification of each affected individual and any other available information required to be included in the notification to the individual.",
    rule: "Breach Notification",
    specType: "Standard",
    category: "Business Associate Notification",
    weight: 3,
    reference: "45 CFR 164.410",
  },

  {
    controlId: "164.412",
    controlName: "Law Enforcement Delay",
    description:
      "If a law enforcement official states that notification would impede a criminal investigation or cause damage to national security, the covered entity or business associate must delay notification for the time period specified in writing, or for 30 days if the statement is oral (with documentation).",
    rule: "Breach Notification",
    specType: "Standard",
    category: "Law Enforcement Delay",
    weight: 2,
    reference: "45 CFR 164.412",
  },

  {
    controlId: "164.414(a)",
    controlName: "Administrative Requirements (Breach)",
    description:
      "A covered entity must comply with the administrative requirements of 164.530(b), (d), (e), (g), (h), (i), and (j) with respect to the requirements of the Breach Notification Rule (training, complaints, sanctions, anti-retaliation, waiver prohibition, policies/procedures, and documentation).",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "Administrative Requirements",
    weight: 2,
    reference: "45 CFR 164.414(a)",
  },
  {
    controlId: "164.414(b)",
    controlName: "Burden of Proof",
    description:
      "In the event of a use or disclosure in violation of the Privacy Rule, the covered entity or business associate has the burden of demonstrating that all notifications were made as required, or that the use/disclosure did not constitute a breach (via the four-factor risk assessment in 164.402).",
    rule: "Breach Notification",
    specType: "Required Implementation",
    category: "Burden of Proof",
    weight: 3,
    reference: "45 CFR 164.414(b)",
  },
];
