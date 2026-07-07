import { eq, and, desc } from "drizzle-orm";
import { generatedPolicies } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { getFrameworkRegistry } from "../compliance/control-registry.js";
import { notFound, badRequest } from "../utils/errors.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyCategory =
  | "access_control"
  | "data_protection"
  | "incident_response"
  | "asset_management"
  | "risk_management"
  | "network_security"
  | "change_management"
  | "business_continuity"
  | "vendor_management"
  | "employee_security";

export type PolicyTier = "comply" | "protect" | "defend";

export interface PolicySection {
  heading: string;
  content: string;
  controls: string[];
}

export interface PolicyTemplate {
  id: string;
  framework: string[];
  category: PolicyCategory;
  title: string;
  description: string;
  sections: PolicySection[];
  applicableIndustries: string[];
  requiredForTier: PolicyTier;
}

export interface PolicyCustomization {
  companyName: string;
  industry: string;
  effectiveDate: string;
  reviewFrequency: string;
  dataTypes?: string[];
  jurisdictions?: string[];
  policyOwner?: string;
  approvedBy?: string;
}

export interface GeneratedPolicy {
  id: string;
  tenantId: string;
  templateId: string;
  title: string;
  framework: string[];
  category: PolicyCategory;
  content: string;
  customization: PolicyCustomization;
  version: string;
  createdAt: Date;
}

export interface GapAnalysisResult {
  required: PolicyTemplate[];
  existing: string[];
  gaps: PolicyTemplate[];
  coverage: number;
}

export interface FrameworkComplianceResult {
  framework: string;
  score: number;
  coveredControls: string[];
  uncoveredControls: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Policy Template Library
// ---------------------------------------------------------------------------

const POLICY_TEMPLATES: PolicyTemplate[] = [
  // 1. Information Security Policy
  {
    id: "infosec-policy",
    framework: ["iso27001"],
    category: "risk_management",
    title: "Information Security Policy",
    description:
      "The master information security policy establishing the organization's commitment to protecting information assets in compliance with ISO 27001.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Purpose and Scope",
        content: `## 1. Purpose and Scope

This Information Security Policy ("Policy") establishes the framework by which {{company_name}} manages, protects, and controls information assets across the entire organization. This Policy applies to all employees, contractors, consultants, temporary workers, and other personnel who access {{company_name}}'s information systems, networks, and data — regardless of location or employment type.

The purpose of this Policy is to:

- Protect the confidentiality, integrity, and availability of all information assets owned or processed by {{company_name}}
- Establish clear roles, responsibilities, and accountability for information security
- Ensure compliance with applicable laws, regulations, and contractual obligations including ISO/IEC 27001:2022
- Provide a basis for the {{company_name}} Information Security Management System (ISMS)
- Minimize business risk through the systematic identification and treatment of information security risks

This Policy is effective as of **{{effective_date}}** and supersedes all previous information security policies. All personnel are required to read, understand, and comply with this Policy as a condition of their engagement with {{company_name}}.`,
        controls: ["A.5.1", "A.5.15"],
      },
      {
        heading: "2. Information Security Objectives",
        content: `## 2. Information Security Objectives

{{company_name}} is committed to the following information security objectives, which are reviewed annually or upon significant organizational change:

**Confidentiality**: Ensuring that information is accessible only to those authorized to have access. {{company_name}} implements access controls, encryption, and data classification to prevent unauthorized disclosure of sensitive information.

**Integrity**: Safeguarding the accuracy and completeness of information and processing methods. {{company_name}} employs checksums, digital signatures, audit logging, and change management procedures to detect and prevent unauthorized modification of information.

**Availability**: Ensuring that authorized users have access to information and associated assets when required. {{company_name}} maintains redundant systems, business continuity plans, and disaster recovery capabilities to meet defined recovery time objectives.

**Risk Management**: Information security risks are identified, assessed, and treated in a structured manner consistent with {{company_name}}'s risk appetite. Risk assessments are conducted at minimum annually and upon material changes to the business or technical environment.

**Legal Compliance**: {{company_name}} maintains compliance with all applicable laws and regulations governing information security, data privacy, and the protection of personal information in all jurisdictions where we operate.

The Chief Information Security Officer (CISO) or equivalent designee is responsible for maintaining these objectives and reporting on their achievement to executive leadership on a quarterly basis.`,
        controls: ["A.5.15", "A.8.3"],
      },
      {
        heading: "3. Roles and Responsibilities",
        content: `## 3. Roles and Responsibilities

**Executive Leadership**: The Chief Executive Officer holds ultimate accountability for information security and approves the annual information security budget and risk appetite statement. Executive leadership ensures that information security receives adequate resources and organizational priority.

**Chief Information Security Officer (CISO)**: The CISO is responsible for developing, implementing, maintaining, and overseeing the ISMS. The CISO reports directly to executive leadership and is empowered to enforce information security requirements across all business units.

**Information Security Team**: The Information Security Team is responsible for day-to-day security operations, incident response, vulnerability management, security monitoring, and assisting business units with security controls implementation.

**System Owners**: Each information system has a designated owner responsible for ensuring appropriate security controls are implemented, maintained, and reviewed. System owners must authorize access to their systems and conduct periodic access reviews.

**All Personnel**: Every individual with access to {{company_name}} information systems is personally responsible for understanding and complying with this Policy, completing required security training, reporting security incidents, and protecting information assets from unauthorized access, modification, or disclosure.

**Third-Party Suppliers**: Vendors and third parties who process {{company_name}} information must comply with equivalent security standards as defined in applicable contracts and the Vendor Risk Management Policy.`,
        controls: ["A.5.15", "A.8.3", "A.5.9"],
      },
      {
        heading: "4. Policy Enforcement and Review",
        content: `## 4. Policy Enforcement and Review

**Compliance Monitoring**: {{company_name}} conducts regular compliance assessments to verify adherence to this Policy. These include internal audits, automated security monitoring, vulnerability assessments, and penetration testing conducted at minimum annually.

**Policy Violations**: Violations of this Policy may result in disciplinary action up to and including termination of employment or contract, legal action, and/or notification to relevant regulatory authorities. The severity of the response will be commensurate with the nature and impact of the violation.

**Exceptions**: Exceptions to this Policy must be formally documented, risk-assessed, approved by the CISO, and reviewed quarterly. All approved exceptions are time-limited and subject to compensating controls.

**Policy Review**: This Policy is reviewed and updated at minimum annually, following significant security incidents, material changes to the business or technical environment, or changes to applicable laws and regulations. Reviews are conducted by the CISO with input from key stakeholders.

**Effective Date**: {{effective_date}}
**Next Review Date**: {{review_date}}
**Policy Owner**: {{policy_owner}}
**Approved By**: {{approved_by}}`,
        controls: ["A.5.15", "A.5.24"],
      },
    ],
  },

  // 2. Access Control Policy
  {
    id: "access-control-policy",
    framework: ["soc2", "iso27001"],
    category: "access_control",
    title: "Access Control Policy",
    description:
      "Defines requirements for controlling logical and physical access to information systems, applications, and data to ensure only authorized individuals can access company resources.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Purpose and Scope",
        content: `## 1. Purpose and Scope

This Access Control Policy ("Policy") establishes the requirements for managing access to {{company_name}}'s information systems, applications, networks, and data. Access control is a foundational security control that prevents unauthorized access to sensitive information and reduces the risk of data breaches.

This Policy applies to:

- All information systems, applications, and databases owned or operated by {{company_name}}
- All user accounts including employee accounts, service accounts, administrator accounts, and third-party accounts
- Both on-premises and cloud-hosted systems
- All personnel including employees, contractors, consultants, and vendors with access to {{company_name}} systems

Access to {{company_name}} information systems is a privilege, not a right, and is granted only when there is a legitimate business need. This Policy is effective as of **{{effective_date}}** and is reviewed **{{review_frequency}}**.`,
        controls: ["CC6.1", "CC6.2", "A.5.15", "A.8.3", "7.1"],
      },
      {
        heading: "2. Access Provisioning and Authorization",
        content: `## 2. Access Provisioning and Authorization

**Principle of Least Privilege**: All access rights are granted based on the minimum permissions required to perform a specific job function. Users are never granted broader access than strictly necessary for their role.

**Need-to-Know Basis**: Access to sensitive or confidential information is restricted to individuals with a demonstrable business need. Access to classified data requires explicit approval from the data owner or CISO.

**Access Request Process**: All access requests must be submitted through the designated access management system and include: the systems or data requiring access, the business justification, the required permission level, and the expected duration. Requests must be approved by the requester's direct manager and the relevant system owner before provisioning.

**New Employee Onboarding**: Access for new employees is provisioned only after completion of the background check process, signing of the confidentiality agreement, and completion of information security training. Access is provisioned using a role-based template aligned to the employee's job function, with any deviations requiring documented approval.

**Privileged Access**: Administrator and privileged accounts require additional approvals and are issued separately from standard user accounts. Privileged accounts must not be used for routine, non-administrative tasks. Privileged access is logged, monitored, and reviewed monthly.`,
        controls: ["CC6.1", "CC6.2", "CC6.3", "A.8.3", "A.8.5", "7.1", "8.2.1"],
      },
      {
        heading: "3. Authentication Requirements",
        content: `## 3. Authentication Requirements

**Password Standards**: All user passwords must meet the following minimum requirements: minimum 12 characters in length; contain at least one uppercase letter, one lowercase letter, one number, and one special character; not reuse the last 12 passwords; changed at minimum every 90 days for privileged accounts. Passwords must not be shared, written down, or transmitted via unencrypted channels.

**Multi-Factor Authentication (MFA)**: MFA is mandatory for all user accounts accessing {{company_name}} systems from outside the corporate network, all administrator and privileged accounts regardless of network location, all access to systems classified as Confidential or Restricted, and all cloud management console access. MFA must use an approved second factor: authenticator application (TOTP), hardware security key (FIDO2), or SMS as a fallback only where stronger methods are unavailable.

**Single Sign-On (SSO)**: {{company_name}} uses SSO for all supported applications to centralize authentication, reduce password fatigue, and enable centralized access revocation. Applications not supporting SSO require documented exception approval.

**Session Management**: User sessions must automatically time out after 15 minutes of inactivity for web applications and 30 minutes for desktop applications. Re-authentication is required following session timeout. Concurrent sessions from multiple locations may be flagged for review.`,
        controls: ["CC6.2", "CC6.3", "A.8.5", "164.312(d)", "8.3.1"],
      },
      {
        heading: "4. Access Review and Termination",
        content: `## 4. Access Review and Termination

**Periodic Access Reviews**: System owners must conduct access reviews for their systems at minimum quarterly for privileged accounts and semi-annually for standard user accounts. Reviews must verify that all access grants remain appropriate for current job functions. Inappropriate access must be revoked within 5 business days of identification.

**Employee Offboarding**: Upon termination of employment or contract, all system access must be revoked within 4 hours for involuntary separations and by end of the last working day for voluntary separations. The HR system initiates an automated offboarding workflow. Physical access credentials, devices, and company-owned equipment must be returned on the final working day.

**Role Changes**: When an employee changes roles, access associated with the previous role must be revoked before or simultaneously with granting new role access. Accumulation of access rights across roles ("access creep") is prohibited. Managers must submit access change requests at least one week before effective date of role change where possible.

**Service Account Management**: Service accounts are created with the minimum permissions required, use strong randomly generated passwords, are not shared between applications, and have their credentials rotated at minimum annually. All service accounts must have a designated human owner.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["CC6.1", "CC6.3", "A.5.15", "A.8.3", "164.308(a)(3)(i)"],
      },
    ],
  },

  // 3. Data Protection & Privacy Policy
  {
    id: "data-protection-privacy-policy",
    framework: ["gdpr", "dpdpa"],
    category: "data_protection",
    title: "Data Protection & Privacy Policy",
    description:
      "Comprehensive policy governing the collection, processing, storage, and disposal of personal data in compliance with GDPR, DPDPA, and applicable privacy regulations.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Introduction and Legal Basis",
        content: `## 1. Introduction and Legal Basis

{{company_name}} is committed to protecting the privacy and personal data of all individuals whose information we collect and process. This Data Protection & Privacy Policy ("Policy") describes how {{company_name}} collects, uses, stores, transfers, and disposes of personal data, and the rights available to individuals with respect to their data.

This Policy is established in compliance with:

- **GDPR** (General Data Protection Regulation — EU 2016/679) for processing personal data of EU/EEA residents
- **DPDPA** (Digital Personal Data Protection Act, 2023) for processing personal data of Indian residents
- Additional applicable privacy laws in the jurisdictions where {{company_name}} operates: {{jurisdictions}}

**Data Controller**: {{company_name}} acts as a data controller for personal data collected directly from individuals. Where {{company_name}} processes personal data on behalf of customers, we act as a data processor subject to applicable data processing agreements.

**Lawful Basis for Processing**: {{company_name}} processes personal data only when there is a valid lawful basis, which may include: consent freely given by the data subject; performance of a contract; compliance with a legal obligation; protection of vital interests; performance of a task in the public interest; or legitimate interests pursued by {{company_name}} where not overridden by individual rights.

This Policy is effective as of **{{effective_date}}** and is reviewed **{{review_frequency}}**.`,
        controls: ["Art.7", "Art.25(1)", "Art.25(2)", "DPDPA-S10-1"],
      },
      {
        heading: "2. Data Collection and Processing",
        content: `## 2. Data Collection and Processing

**Data Minimization**: {{company_name}} collects and processes only the minimum personal data necessary for the specified, explicit, and legitimate purposes. We do not process personal data in ways incompatible with those purposes.

**Types of Personal Data Processed**: {{company_name}} may process the following categories of personal data depending on our relationship with you: identity data (name, username, identifier); contact data (email, phone, address); financial data (payment information, transaction history); technical data (IP addresses, device identifiers, usage logs); profile data (preferences, feedback, survey responses); and special category data only where explicit consent has been obtained and documented.

**Special Categories of Data**: Processing of special category data (health, biometric, genetic, religious, political, racial, or sexual orientation data) requires explicit consent or another specific legal basis, is logged in the data processing registry, and is subject to enhanced security controls including encryption at rest and in transit.

**Data Classification**: Personal data processed by {{company_name}} is classified as follows:
- **Restricted**: Special category data, financial credentials, health records — encrypted at rest and in transit, access strictly limited
- **Confidential**: Standard personal data including contact information, account data — encrypted, access on need-to-know basis
- **Internal**: Aggregated or anonymized data — standard access controls apply

**Data Processing Register**: {{company_name}} maintains a comprehensive register of all data processing activities as required by Article 30 of GDPR and applicable DPDPA provisions. This register is reviewed quarterly and updated within 30 days of any material change to processing activities.`,
        controls: ["Art.25(1)", "Art.25(2)", "Art.30", "Art.35", "DPDPA-S8-1"],
      },
      {
        heading: "3. Individual Rights",
        content: `## 3. Individual Rights

{{company_name}} respects and upholds the rights of data subjects under applicable privacy law. Individuals may exercise the following rights by submitting a request to our Data Protection Officer at the contact details provided at the end of this Policy:

**Right of Access**: Individuals have the right to obtain confirmation of whether their personal data is being processed and to receive a copy of that data along with supplementary information about how it is used.

**Right to Rectification**: Individuals have the right to have inaccurate or incomplete personal data corrected or completed without undue delay.

**Right to Erasure**: Individuals have the right to request erasure of their personal data where it is no longer necessary for the purpose collected, consent has been withdrawn, they object to processing and there are no overriding legitimate grounds, or the data has been unlawfully processed.

**Right to Restriction**: Individuals may request restriction of processing where accuracy is contested, processing is unlawful, or the data is needed for legal claims even if no longer required for the original purpose.

**Right to Data Portability**: Individuals have the right to receive their personal data in a structured, commonly used, machine-readable format and to transmit that data to another controller where technically feasible.

**Right to Object**: Individuals may object to processing based on legitimate interests or for direct marketing purposes. Objections to direct marketing will be honored immediately and without exception.

{{company_name}} will respond to all rights requests within **30 days** of receipt. Where requests are complex or numerous, the response period may be extended by an additional 60 days with written notification. All requests are logged in our rights request register.`,
        controls: ["Art.7", "Art.17", "Art.20", "DPDPA-S10-1"],
      },
      {
        heading: "4. Data Security and Breach Response",
        content: `## 4. Data Security and Breach Response

**Security Measures**: {{company_name}} implements appropriate technical and organizational measures to protect personal data against unauthorized access, disclosure, alteration, or destruction. These include: AES-256 encryption for data at rest; TLS 1.2 or higher for data in transit; access controls with multi-factor authentication; regular security assessments and penetration testing; employee security training; and vendor security assessments.

**Data Breach Response**: In the event of a personal data breach, {{company_name}} will:

1. Identify and contain the breach within 1 hour of detection
2. Assess the nature, scope, and likely consequences of the breach within 24 hours
3. Notify the relevant supervisory authority within **72 hours** of becoming aware, where the breach is likely to result in a risk to individuals' rights and freedoms (Article 33 GDPR)
4. Notify affected data subjects without undue delay where the breach is likely to result in a **high risk** to their rights and freedoms (Article 34 GDPR)
5. Notify the Data Protection Board of India within **72 hours** where required under DPDPA
6. Document the breach, its effects, and remedial actions taken in the breach register

**Data Retention**: Personal data is retained only for as long as necessary for the purpose collected, as required by law, or as defined in our Data Retention Schedule. Upon expiry of the retention period, data is securely deleted or anonymized in accordance with our Data Retention & Disposal Policy.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Data Protection Officer**: {{policy_owner}}`,
        controls: ["Art.32(1)", "Art.33", "Art.34", "DPDPA-S8-5", "DPDPA-S9-1"],
      },
    ],
  },

  // 4. Incident Response Plan
  {
    id: "incident-response-plan",
    framework: ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa"],
    category: "incident_response",
    title: "Incident Response Plan",
    description:
      "Structured plan for detecting, containing, eradicating, and recovering from security incidents, with defined roles, escalation paths, and communication procedures.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Purpose, Scope, and Incident Classification",
        content: `## 1. Purpose, Scope, and Incident Classification

This Incident Response Plan ("Plan") establishes the structured approach {{company_name}} will follow when responding to information security incidents. The goal is to minimize the impact of security events through rapid detection, effective containment, thorough eradication of threats, and systematic recovery.

This Plan applies to all information systems, networks, data, and personnel at {{company_name}}, including cloud environments, third-party systems processing company data, and any system containing personal data of customers or employees.

**Incident Severity Classification**:

| Severity | Definition | Initial Response | Executive Notification |
|----------|-----------|-----------------|----------------------|
| **P1 — Critical** | Active breach or ransomware, mass data exfiltration, system-wide outage, regulatory breach | 15 minutes | Immediate |
| **P2 — High** | Suspected breach, privilege escalation, targeted phishing success, single-system compromise | 1 hour | Within 2 hours |
| **P3 — Medium** | Malware detected and contained, failed intrusion attempt, policy violation, minor data exposure | 4 hours | Same business day |
| **P4 — Low** | Suspicious activity, failed login spikes, minor policy violations | Next business day | Weekly summary |

**Incident Reporting**: Any person who discovers or suspects a security incident must report it immediately to the Security Operations Center at security@{{company_name}}.com or the 24/7 incident hotline. Do not attempt to investigate or remediate independently. Preserve all logs and evidence. Do not power off affected systems unless explicitly directed by the security team.`,
        controls: ["CC7.2", "A.5.24", "A.5.25", "164.308(a)(1)(i)", "DPDPA-S8-5"],
      },
      {
        heading: "2. Incident Response Team and Roles",
        content: `## 2. Incident Response Team and Roles

The Incident Response Team (IRT) is activated for P1 and P2 incidents and may be partially activated for P3 incidents at the CISO's discretion.

**Incident Commander (IC)**: The CISO or designated deputy serves as Incident Commander for P1/P2 incidents. The IC has authority to mobilize resources, authorize containment actions, and make all decisions related to the incident response. The IC chairs all incident briefings and approves all external communications.

**Security Lead**: The senior security engineer directing technical investigation, forensic analysis, and remediation. The Security Lead maintains a real-time incident timeline and coordinates the technical response team.

**Communications Lead**: Responsible for all internal and external communications, including regulatory notifications, customer communications, press statements, and law enforcement liaison. No public statement may be issued without IC approval.

**Legal Counsel**: Advises on legal obligations, regulatory notifications, evidence preservation, and potential litigation. Legal counsel must be notified immediately for all P1 incidents and any incident involving personal data.

**HR Representative**: Required for incidents involving insider threats or employee misconduct. HR manages the employee-facing aspects of the investigation.

**System Owner**: The owner of affected system(s) participates in containment decisions, coordinates restoration activities, and has authority over their systems subject to IC direction.

**External Contacts**: {{company_name}} maintains relationships with: forensic investigation firm (retainer), cyber insurance carrier (policy #: [maintained separately]), law enforcement liaisons, and regulatory notification contacts for applicable jurisdictions.`,
        controls: ["CC7.2", "A.5.24", "164.308(a)(1)(i)"],
      },
      {
        heading: "3. Response Procedures",
        content: `## 3. Response Procedures

**Phase 1 — Detection and Analysis** (Target: P1 within 15 min, P2 within 1 hr):
- Receive and validate the incident report
- Assign severity level and activate appropriate IRT members
- Begin preserving logs and evidence — do not modify or delete
- Identify affected systems, data, and potentially impacted individuals
- Establish a secure incident communication channel (separate from potentially compromised systems)
- Initiate the incident log with timestamp, reporter, initial assessment, and assigned IC

**Phase 2 — Containment** (Target: P1 within 1 hr of detection):
- Short-term containment: isolate affected systems from the network to prevent lateral movement. This may include: blocking IP addresses, disabling user accounts, isolating network segments, or taking snapshots of affected systems for forensic analysis before remediation.
- Long-term containment: where immediate restoration is not feasible, implement alternative controls to maintain business continuity while investigation continues. Document all containment actions with timestamps.
- Evidence preservation: capture forensic images of affected systems, preserve network logs, system logs, and application logs with chain-of-custody documentation.

**Phase 3 — Eradication and Recovery**:
- Remove malicious code, unauthorized access vectors, or compromised credentials
- Patch or remediate exploited vulnerabilities before restoration
- Restore systems from known-good backups with integrity verification
- Re-enable services in a controlled, staged manner with enhanced monitoring
- Confirm restoration of normal operations with system owner sign-off

**Phase 4 — Post-Incident Review**:
- Conduct a formal post-incident review within 5 business days of incident closure
- Document root cause, timeline, response effectiveness, and lessons learned
- Identify and track remediation actions to prevent recurrence
- Update this Plan based on lessons learned`,
        controls: ["CC7.2", "A.5.24", "A.5.25", "164.308(a)(1)(i)", "DPDPA-S8-5"],
      },
      {
        heading: "4. Regulatory Notification Requirements",
        content: `## 4. Regulatory Notification Requirements

{{company_name}} operates under multiple regulatory frameworks with distinct notification obligations. The Communications Lead and Legal Counsel jointly manage regulatory notifications.

**GDPR Obligations** (where applicable):
- Notify the relevant Data Protection Authority within **72 hours** of becoming aware of a personal data breach likely to result in risk to individuals
- Notify affected data subjects without undue delay where the breach is likely to result in **high risk** to their rights and freedoms
- Document all breaches in the breach register regardless of notification obligation

**DPDPA Obligations** (for Indian residents' data):
- Notify the Data Protection Board of India within **72 hours** of a personal data breach
- Notify affected data principals as soon as practicable
- Maintain breach records for a minimum of 5 years

**HIPAA Obligations** (for protected health information):
- Notify affected individuals within **60 days** of discovering a breach
- Notify the Secretary of HHS simultaneously with individual notice (or annually for breaches affecting fewer than 500 individuals)
- Notify prominent media outlets if breach affects more than **500 residents** of a state

**PCI-DSS Obligations** (for cardholder data):
- Notify the acquiring bank and card brands immediately upon discovering a potential compromise of cardholder data
- Cooperate fully with the card brand's forensic investigation requirements

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Plan Owner**: {{policy_owner}}`,
        controls: ["Art.33", "Art.34", "DPDPA-S8-5", "164.308(a)(1)(i)", "CC7.2"],
      },
    ],
  },

  // 5. Change Management Policy
  {
    id: "change-management-policy",
    framework: ["soc2", "pcidss"],
    category: "change_management",
    title: "Change Management Policy",
    description:
      "Controls the authorization, testing, approval, and deployment of changes to production systems to prevent unauthorized modifications and minimize service disruption.",
    requiredForTier: "protect",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing"],
    sections: [
      {
        heading: "1. Purpose and Change Classification",
        content: `## 1. Purpose and Change Classification

This Change Management Policy ("Policy") governs the process for requesting, reviewing, approving, implementing, and documenting changes to {{company_name}}'s production information systems, infrastructure, applications, databases, and network components. Effective change management prevents unauthorized modifications, reduces service disruptions, and maintains the integrity of production environments.

This Policy applies to all changes affecting production systems regardless of whether the change is initiated internally or by a third party. Development and test environment changes are excluded but should follow equivalent processes.

**Change Classification**:

| Type | Definition | Approval Required | Change Window |
|------|-----------|------------------|---------------|
| **Standard** | Pre-approved, low-risk changes with documented procedures (e.g., routine patching, certificate renewal) | Change Manager pre-approval | Scheduled maintenance |
| **Normal** | Planned changes with assessed risk — full CAB review required | CAB approval | Scheduled maintenance |
| **Emergency** | Unplanned changes required to restore service or address critical security vulnerability | CISO + Change Manager | Emergency window — ASAP |

All changes must be documented in the Change Management System before implementation. Undocumented changes to production are a policy violation.`,
        controls: ["CC8.1", "1.2", "6.2"],
      },
      {
        heading: "2. Change Request and Approval Process",
        content: `## 2. Change Request and Approval Process

**Change Request Submission**: All change requests must include: description of the change and business justification; risk assessment including potential impact on security controls, compliance posture, and service availability; rollback plan with estimated rollback time; test plan and evidence of successful testing in non-production; implementation steps with timing estimates; communication plan for affected users or stakeholders; and assigned change owner responsible for implementation.

**Risk Assessment**: Each change undergoes a risk assessment scoring the likelihood and impact of: service disruption, security degradation, compliance impact, and data integrity risk. High-risk changes require additional compensating controls or phased implementation.

**Change Advisory Board (CAB)**: The CAB reviews and approves Normal changes. The CAB meets weekly and is composed of the Change Manager, CISO or security representative, operations lead, relevant system owner(s), and application owner(s). CAB decisions are documented in the change record.

**Separation of Duties**: No individual may both develop and deploy a change to production without a second reviewer. Code changes must pass peer code review. Infrastructure changes must be reviewed by a second engineer. Database changes must be reviewed by the database administrator.

**Testing Requirements**: All changes must be tested in a non-production environment that mirrors production. Evidence of testing (test plans, results, sign-off) must be attached to the change record before CAB approval. Security-relevant changes must include security testing evidence.`,
        controls: ["CC8.1", "6.2", "1.2"],
      },
      {
        heading: "3. Implementation and Post-Change Review",
        content: `## 3. Implementation and Post-Change Review

**Change Windows**: Production changes are implemented during approved maintenance windows — typically off-peak hours and weekends — unless emergency changes are required. Change windows are published in advance and stakeholders are notified at least 48 hours before scheduled downtime.

**Emergency Changes**: Emergency changes follow an expedited approval process: verbal approval from CISO and Change Manager, implementation by the most qualified available engineer, documentation completed retrospectively within 24 hours, CAB review at the next scheduled meeting. Emergency changes are tracked separately and trends are reviewed monthly.

**Rollback Procedures**: Every change must have a documented rollback plan. Rollback must be initiated if: the change causes unacceptable service degradation; security controls are compromised; the implementation exceeds the approved change window by more than 50%; or the change owner determines implementation is not proceeding as planned. Rollback decisions are made by the change owner in consultation with the Change Manager.

**Post-Implementation Review**: Changes are monitored for 24 hours post-implementation. A post-implementation review is conducted for all Normal and Emergency changes, assessing: whether the change achieved its objective; actual versus estimated impact; whether the rollback plan would have been adequate; and lessons learned.

**Audit Trail**: All change records, approvals, implementation evidence, and post-implementation reviews are retained for a minimum of 3 years and are available for compliance audits.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["CC8.1", "6.2"],
      },
    ],
  },

  // 6. Encryption Policy
  {
    id: "encryption-policy",
    framework: ["pcidss", "hipaa"],
    category: "data_protection",
    title: "Encryption Policy",
    description:
      "Mandates the use of cryptographic controls for protecting sensitive data at rest and in transit, defining approved algorithms, key lengths, and key management procedures.",
    requiredForTier: "protect",
    applicableIndustries: ["finance", "healthcare", "saas", "retail"],
    sections: [
      {
        heading: "1. Purpose and Cryptographic Standards",
        content: `## 1. Purpose and Cryptographic Standards

This Encryption Policy ("Policy") establishes the requirements for the use of cryptographic controls at {{company_name}} to protect the confidentiality, integrity, and authenticity of sensitive information. Cryptography is a critical control for protecting data from unauthorized disclosure and for ensuring data integrity.

This Policy applies to all {{company_name}} systems, applications, storage media, and communications channels that process, store, or transmit: cardholder data (CHD) or sensitive authentication data (SAD); protected health information (ePHI); personal data as defined by applicable privacy regulations; and any data classified as Confidential or Restricted.

**Approved Symmetric Encryption Algorithms**:
- AES-256-GCM for data at rest (preferred)
- AES-256-CBC with HMAC-SHA256 for legacy compatibility
- ChaCha20-Poly1305 for constrained environments

**Approved Asymmetric / Public Key Algorithms**:
- RSA with minimum 2048-bit keys (3072-bit or higher preferred for new implementations)
- ECDSA with P-256 or P-384 curves
- Ed25519 for digital signatures

**Approved Hash Functions**:
- SHA-256 or SHA-384 for general hashing
- SHA-3 family for new implementations
- Argon2id for password hashing (PBKDF2-SHA256 as fallback)

**Prohibited Algorithms**: The following algorithms are prohibited and must not be used: MD5, SHA-1 (except for legacy protocol compatibility with documented exception), DES, 3DES, RC4, SSL 2.0/3.0, TLS 1.0/1.1.`,
        controls: ["4.1", "A.8.24", "164.312(e)(1)", "DPDPA-S8-1"],
      },
      {
        heading: "2. Data at Rest Encryption",
        content: `## 2. Data at Rest Encryption

**Database Encryption**: All databases containing Confidential or Restricted data must use transparent database encryption (TDE) or equivalent field-level encryption. Database encryption keys must be managed separately from the database and rotated annually or upon suspected compromise.

**Disk and Volume Encryption**: All laptops, desktops, and portable storage devices must use full-disk encryption. Cloud storage volumes containing sensitive data must be encrypted at rest using provider-managed or customer-managed keys meeting approved algorithm standards.

**File-Level Encryption**: Individual files classified as Restricted must be encrypted at the file level in addition to volume encryption. Backup media and archives containing sensitive data must be encrypted before transport or storage.

**Cardholder Data (CHD)**: Primary Account Numbers (PANs) must be rendered unreadable anywhere they are stored using strong one-way hashing, truncation, index tokens with securely stored pads, or strong cryptography. The full PAN must never be stored on any system within the cardholder data environment unless absolutely necessary and specifically documented with a compensating control.

**ePHI**: All systems storing ePHI must implement encryption of data at rest as a required implementation specification under HIPAA 164.312(a)(2)(iv). Encryption keys must be managed using an approved key management system.`,
        controls: ["3.5", "4.1", "164.312(e)(1)", "A.8.24", "DPDPA-S8-1"],
      },
      {
        heading: "3. Data in Transit Encryption and Key Management",
        content: `## 3. Data in Transit Encryption and Key Management

**Transport Layer Security**: All data transmitted across untrusted networks must be encrypted using TLS 1.2 or higher. TLS 1.3 is required for new implementations. Mutual TLS (mTLS) is required for service-to-service communications containing sensitive data. All TLS implementations must: use certificates from approved certificate authorities; validate certificate chains; implement certificate pinning for mobile applications; and disable insecure cipher suites.

**API Security**: All external API endpoints must use HTTPS with TLS 1.2+. API authentication tokens, keys, and credentials must be transmitted only in encrypted channels. Sensitive data in API payloads must be minimized through data minimization design.

**Email and Messaging**: Sensitive data must not be transmitted via standard email without additional encryption. Approved secure email solutions or encrypted file transfer protocols (SFTP, FTPS, AS2) must be used for transmitting Confidential or Restricted data.

**Key Management**: {{company_name}} maintains a formal key management lifecycle covering key generation, distribution, storage, usage, rotation, and destruction. Key management procedures include:
- Cryptographic keys are generated using approved hardware or software random number generators
- Private keys and symmetric keys are never stored in plaintext; use approved key management systems (KMS)
- Key rotation is performed at minimum annually for data encryption keys, and every 2 years for key-encrypting keys
- Key custodians must not have sole control of any key used to encrypt sensitive data — dual control required for master keys
- Compromised or suspected-compromised keys must be immediately rotated and the incident reported

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["4.1", "3.5", "A.8.24", "164.312(e)(1)"],
      },
    ],
  },

  // 7. Network Security Policy
  {
    id: "network-security-policy",
    framework: ["pcidss", "iso27001"],
    category: "network_security",
    title: "Network Security Policy",
    description:
      "Establishes requirements for designing, configuring, and maintaining secure network architectures, including segmentation, firewall management, and wireless security.",
    requiredForTier: "protect",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Network Architecture and Segmentation",
        content: `## 1. Network Architecture and Segmentation

This Network Security Policy ("Policy") defines the requirements for designing, implementing, operating, and maintaining {{company_name}}'s network infrastructure in a secure manner. Network security is foundational to protecting systems and data from unauthorized access and cyberattacks.

**Network Segmentation**: {{company_name}}'s network is segmented into security zones based on data sensitivity and functional requirements:

- **Untrusted Zone (Internet)**: External internet — no direct access to internal systems
- **DMZ (Demilitarized Zone)**: Public-facing services (web servers, mail relays, API gateways) — strictly controlled access to internal zones
- **Internal Network**: Standard business systems and user workstations — separated from sensitive data zones
- **Restricted Zone**: Systems processing Confidential or Restricted data — access requires explicit firewall rules and MFA
- **Cardholder Data Environment (CDE)**: Isolated zone for systems in scope for PCI-DSS — network access strictly controlled to only necessary communications
- **Management Network**: Out-of-band management access — access restricted to authorized administrators

**Zone Access Rules**: Traffic between zones is controlled by firewalls with default-deny rules. All zone-to-zone communication requires documented business justification, explicit firewall rules, and periodic review. Network diagrams documenting all zones, flows, and boundary controls are maintained and reviewed quarterly.`,
        controls: ["1.1", "1.2", "A.8.20", "CC6.6"],
      },
      {
        heading: "2. Firewall and Network Device Management",
        content: `## 2. Firewall and Network Device Management

**Firewall Configuration Standards**: All firewalls must be configured with explicit deny-by-default rules for all inbound and outbound traffic. Permitted traffic must be explicitly defined with the minimum required ports, protocols, and source/destination addresses. "Any/any" rules are prohibited. All firewall rules must document: business justification, date approved, approving authority, and scheduled review date.

**Firewall Rule Review**: Firewall rulesets are reviewed every 6 months to verify continued business justification for each rule. Rules with no recent traffic or expired justification are removed. Reviews are documented and retained for audit purposes.

**Network Device Hardening**: All routers, switches, load balancers, and network appliances must be hardened per industry-standard benchmarks (CIS Benchmarks). This includes: changing all default credentials before deployment; disabling all unnecessary services, ports, and protocols; applying vendor security patches within 30 days of release for critical vulnerabilities; enabling logging for administrative actions and security events; using SSH (not Telnet) for remote management; and enforcing time synchronization via NTP.

**Remote Access**: VPN access to internal networks requires MFA. Remote access sessions are logged and monitored. Split tunneling configurations must be reviewed and approved by the security team. VPN concentrators are subject to the same security standards as other network devices.`,
        controls: ["1.1", "1.2", "A.8.20", "A.8.21", "CC6.6"],
      },
      {
        heading: "3. Wireless Security and Monitoring",
        content: `## 3. Wireless Security and Monitoring

**Wireless Network Standards**: Corporate wireless networks must use WPA3-Enterprise with 802.1X authentication against a RADIUS server, or WPA2-Enterprise at minimum with a documented exception. Pre-shared key (PSK) wireless networks are prohibited for corporate use. Guest wireless networks must be isolated from the corporate network on a separate VLAN with internet-only access and bandwidth throttling.

**Wireless Security Scanning**: {{company_name}} conducts quarterly scans to detect unauthorized wireless access points (rogue APs) within facilities. Any unauthorized wireless access point must be immediately disabled and an incident raised. Wireless network configuration is audited annually.

**Network Monitoring and Detection**: {{company_name}} maintains continuous monitoring of network traffic for security events using:
- Intrusion Detection/Prevention Systems (IDS/IPS) at network boundaries and critical internal segments
- Security Information and Event Management (SIEM) correlating network, system, and application logs
- NetFlow or equivalent traffic analysis for anomaly detection
- DNS security monitoring to detect malicious domains and data exfiltration

**Network Logging**: All network devices must forward logs to the central SIEM. Logs must include at minimum: all administrative access, all network boundary crossings, all failed connection attempts, all changes to firewall rules, and all DHCP assignments. Logs are retained for a minimum of 12 months.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["1.1", "1.2", "A.8.20", "A.8.15", "A.8.16", "CC6.6"],
      },
    ],
  },

  // 8. Business Continuity Policy
  {
    id: "business-continuity-policy",
    framework: ["iso27001"],
    category: "business_continuity",
    title: "Business Continuity Policy",
    description:
      "Ensures that critical business functions can continue operating during and after a significant disruption, with defined recovery time and recovery point objectives.",
    requiredForTier: "protect",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Business Continuity Framework",
        content: `## 1. Business Continuity Framework

This Business Continuity Policy ("Policy") establishes {{company_name}}'s framework for maintaining essential business operations during and recovering from significant disruptions. Business continuity planning ensures that {{company_name}} can deliver critical services to customers even when faced with severe and unexpected events.

**Scope**: This Policy applies to all critical business processes, supporting systems, personnel, and locations. A critical business process is one whose disruption would: prevent {{company_name}} from delivering contracted services; create material financial loss exceeding defined thresholds; result in regulatory penalties or compliance failures; or create significant harm to customers or third parties.

**Recovery Objectives**:

| Criticality | Recovery Time Objective (RTO) | Recovery Point Objective (RPO) |
|------------|------------------------------|-------------------------------|
| Tier 1 — Mission Critical | 1 hour | 15 minutes |
| Tier 2 — Business Critical | 4 hours | 1 hour |
| Tier 3 — Important | 24 hours | 4 hours |
| Tier 4 — Normal | 72 hours | 24 hours |

**Business Impact Analysis (BIA)**: {{company_name}} conducts a formal BIA annually to identify critical business processes, assess the impact of disruption, determine RTOs and RPOs, and prioritize recovery activities. The BIA is reviewed following significant organizational changes, after a business continuity event, or at minimum annually.`,
        controls: ["A1.1", "A1.2"],
      },
      {
        heading: "2. Continuity Planning and Recovery Procedures",
        content: `## 2. Continuity Planning and Recovery Procedures

**Business Continuity Plans (BCPs)**: Each critical business function has a documented BCP maintained by the function's senior manager. BCPs must include: activation criteria and decision authority; roles and responsibilities during an event; communication procedures including customer and regulatory notifications; alternative working arrangements; manual process workarounds; and recovery procedures specific to the function.

**Disaster Recovery**: {{company_name}} maintains a Disaster Recovery Plan (DRP) for IT systems that supports the BCP. The DRP specifies: recovery procedures for all Tier 1 and Tier 2 systems; failover procedures for primary to secondary environments; backup validation procedures; and system restoration sequence to respect dependencies.

**Data Backup**: All systems are backed up according to their criticality tier. Tier 1 and Tier 2 systems use continuous replication to a geographically separate site. Backups include: automated daily backups with 30-day retention; weekly full backups with 90-day retention; monthly backups with 1-year retention. Backup integrity is verified through automated restoration tests monthly and a full restoration test annually.

**Crisis Management**: {{company_name}} maintains a Crisis Management Team (CMT) activated for significant disruptions. The CMT is chaired by the CEO or designee and includes the CISO, Head of Operations, Legal Counsel, and Head of Communications. The CMT has authority to: declare a business continuity event; authorize emergency expenditure; make decisions affecting customer commitments; and activate crisis communications.`,
        controls: ["A1.1", "A1.2"],
      },
      {
        heading: "3. Testing and Maintenance",
        content: `## 3. Testing and Maintenance

**Testing Requirements**: Business continuity and disaster recovery plans must be tested to validate their effectiveness and identify gaps. {{company_name}} conducts the following tests:

- **Tabletop Exercise**: Quarterly — discussion-based walkthrough of plan with key personnel. Tests understanding of roles, procedures, and decision-making.
- **Technical Recovery Test**: Semi-annually — actual execution of system recovery procedures in a test environment. Validates RTOs and RPOs for all Tier 1 systems.
- **Full Simulation**: Annually — comprehensive simulation of a major disruption, testing all plan components including communications, manual processes, and IT recovery.

**Test Documentation**: All tests are documented with: test scenario and scope; participants; outcomes and identified gaps; corrective actions with assigned owners and target dates. Test results are reported to executive leadership.

**Plan Maintenance**: BCPs and the DRP are reviewed and updated: following any test that identifies significant gaps; after a real business continuity event; when there are material changes to business processes, systems, or personnel; and at minimum annually. The Business Continuity Manager coordinates plan updates and ensures all stakeholders have access to current plan versions.

**Supplier Dependencies**: Critical suppliers and third-party service providers are assessed for their business continuity capabilities. Contractual requirements for business continuity and disaster recovery are included in all agreements with critical suppliers.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["A1.1", "A1.2"],
      },
    ],
  },

  // 9. Vendor / Third-Party Risk Policy
  {
    id: "vendor-risk-policy",
    framework: ["soc2"],
    category: "vendor_management",
    title: "Vendor & Third-Party Risk Management Policy",
    description:
      "Establishes requirements for assessing, monitoring, and managing security risks introduced by third-party vendors, suppliers, and service providers.",
    requiredForTier: "protect",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Vendor Risk Management Framework",
        content: `## 1. Vendor Risk Management Framework

This Vendor & Third-Party Risk Management Policy ("Policy") establishes {{company_name}}'s approach to identifying, assessing, managing, and monitoring risks introduced by vendors, suppliers, cloud service providers, and other third parties. Third-party relationships can introduce material security, compliance, and operational risks that must be managed proactively.

**Scope**: This Policy applies to all third parties who: have access to {{company_name}}'s systems, networks, or facilities; process, store, or transmit {{company_name}} data or customer data; provide critical services where their failure could materially impact {{company_name}}'s operations; or develop software or systems on behalf of {{company_name}}.

**Vendor Criticality Classification**:

| Tier | Definition | Due Diligence Level | Review Frequency |
|------|-----------|---------------------|-----------------|
| **Critical** | Access to sensitive data, critical infrastructure, or customer data | Full security assessment + onsite audit | Annually |
| **High** | Access to internal systems or significant operational dependency | Comprehensive questionnaire + evidence review | Annually |
| **Medium** | Limited system access or business process dependency | Standard questionnaire | Every 2 years |
| **Low** | No system access, minimal operational dependency | Self-certification | Every 3 years |

All new vendors must be classified and assessed before being granted access to {{company_name}} systems or data.`,
        controls: ["CC2.1", "CC1.1"],
      },
      {
        heading: "2. Vendor Assessment and Contracting",
        content: `## 2. Vendor Assessment and Contracting

**Pre-Engagement Assessment**: Before engaging a new vendor, the Procurement team must initiate a vendor risk assessment. Critical and High-tier vendors must complete {{company_name}}'s security questionnaire covering: information security policies and governance; access control and authentication practices; encryption and data protection; incident response and breach notification capabilities; business continuity and disaster recovery; employee security training; and sub-processor management. Evidence of security certifications (ISO 27001, SOC 2 Type II) or equivalent third-party assessments may substitute for portions of the questionnaire.

**Contract Requirements**: All vendor contracts must include: defined security requirements aligned to this Policy; data processing agreements (DPA) where personal data is shared; incident notification obligations with defined timelines (typically 24-48 hours for security incidents involving {{company_name}} data); right-to-audit clauses for Critical and High-tier vendors; data return/destruction obligations on contract termination; sub-processor approval requirements; and liability provisions for security breaches.

**Sub-Processor Management**: Vendors who engage sub-processors to fulfill their obligations to {{company_name}} must obtain {{company_name}}'s prior approval. Vendors remain liable for sub-processors' compliance with security requirements. {{company_name}} maintains a register of approved sub-processors.`,
        controls: ["CC2.1", "CC1.1"],
      },
      {
        heading: "3. Ongoing Vendor Monitoring",
        content: `## 3. Ongoing Vendor Monitoring

**Continuous Monitoring**: Critical vendors are monitored continuously using security rating tools and public breach monitoring. Significant changes to a vendor's security posture (new vulnerabilities, public breach, certification lapse) trigger an immediate review.

**Periodic Reviews**: Vendor relationships are reviewed at the frequency specified for their criticality tier. Reviews assess: changes to the vendor's security posture since last review; incidents or breaches involving the vendor; changes to the scope of data or access; and whether the relationship remains necessary and proportionate.

**Incident Response**: When a vendor reports a security incident that may affect {{company_name}} or customer data, the CISO must be notified immediately. The Incident Response Plan is activated for incidents affecting Critical or High-tier vendors. {{company_name}} may suspend vendor access pending investigation.

**Vendor Offboarding**: When a vendor relationship ends, {{company_name}} must: revoke all vendor access within 24 hours of contract expiry; obtain confirmation of data deletion or return within 30 days; verify completion through the Vendor Offboarding Checklist; and retain vendor records per the Data Retention Schedule.

**Register Maintenance**: The Third-Party Vendor Register is maintained by the Procurement team with input from IT and Security. The register tracks vendor contact details, criticality tier, last assessment date, contract expiry, and any active risk exceptions.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["CC2.1", "CC1.1"],
      },
    ],
  },

  // 10. Employee Security Awareness Policy
  {
    id: "employee-security-awareness-policy",
    framework: ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa"],
    category: "employee_security",
    title: "Employee Security Awareness & Training Policy",
    description:
      "Mandates security awareness training for all personnel, covering recognition of social engineering attacks, secure data handling, and reporting obligations.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Training Requirements and Scope",
        content: `## 1. Training Requirements and Scope

This Employee Security Awareness & Training Policy ("Policy") establishes {{company_name}}'s requirements for ensuring that all personnel have the knowledge and skills to protect information assets, recognize security threats, and fulfill their security responsibilities.

Security awareness is not optional — it is a mandatory condition of employment and engagement at {{company_name}}. Failure to complete required training may result in suspension of system access, disciplinary action, or termination of employment or contract.

This Policy applies to all full-time and part-time employees, contractors, consultants, temporary staff, and board members with access to {{company_name}} systems or data.

**Mandatory Training Schedule**:

| Training | Audience | Frequency | Completion Deadline |
|----------|----------|-----------|-------------------|
| Security Awareness Fundamentals | All personnel | Annual | Within 30 days of hire, then annually |
| Phishing Simulation | All personnel | Quarterly | N/A (simulated) |
| Data Protection & Privacy | All personnel | Annual | Within 30 days of hire, then annually |
| Role-Based Security Training | Technical staff | Annual | Role-specific |
| PCI-DSS Awareness | CDE staff | Annual | Within 30 days of CDE access |
| HIPAA Training | Healthcare staff | Annual | Within 30 days of access to ePHI |
| Secure Development | Developers | Annual | Before production access |
| Incident Response | Security & IT | Semi-annual | Before being on-call |`,
        controls: ["164.308(a)(5)(i)", "A.5.10", "CC1.1", "10.2"],
      },
      {
        heading: "2. Training Content and Delivery",
        content: `## 2. Training Content and Delivery

**Security Awareness Fundamentals** training must cover, at minimum:

- **Social Engineering**: Recognition of phishing, spear-phishing, vishing, smishing, and pretexting attacks. Red flags, verification procedures, and reporting mechanisms. Includes hands-on simulated phishing exercises.
- **Password Security**: Creating strong passphrases; using password managers; dangers of password reuse; MFA importance and setup.
- **Secure Data Handling**: Classifying information correctly; handling Confidential and Restricted data; clean desk and clear screen practices; secure printing and document disposal; safe file sharing.
- **Device Security**: Locking screens when away; encrypting laptops; avoiding public Wi-Fi or using VPN; physical security of devices; BYOD acceptable use.
- **Incident Reporting**: How to recognize and report a security incident; the value of early reporting; the non-punitive reporting culture at {{company_name}}.
- **Acceptable Use**: Permitted uses of {{company_name}} systems; prohibition on unapproved software; personal use guidelines; monitoring disclosure.
- **Remote Working**: Securing home networks; visitor awareness; physical security of documents; approved remote collaboration tools.

**Training Delivery**: Training is delivered through {{company_name}}'s Learning Management System (LMS) and must include knowledge checks with passing scores of 80% or higher. Training completions are logged and accessible to HR and Compliance for audit purposes.`,
        controls: ["164.308(a)(5)(i)", "A.5.10", "CC1.1"],
      },
      {
        heading: "3. Phishing Simulations and Metrics",
        content: `## 3. Phishing Simulations, Enforcement, and Metrics

**Phishing Simulation Program**: {{company_name}} conducts unannounced simulated phishing attacks at least quarterly. Simulations vary in sophistication and topic to represent real-world threats. Results are tracked per individual and department.

- Personnel who click simulated phishing links or submit credentials in simulations are automatically enrolled in targeted remedial training
- Persistent high-risk behavior (clicking 3+ simulations in a rolling 12-month period) is escalated to the individual's manager and HR
- Department-level results are reported to department heads quarterly
- Company-wide phishing metrics are reviewed by the CISO and reported to leadership semi-annually

**Training Completion Enforcement**: Completion of mandatory training is tracked in the LMS. Personnel who have not completed mandatory training by the deadline receive automated reminders at 7 days, 3 days, and 1 day before the deadline. Overdue training is escalated to the individual's manager and HR. System access may be suspended for personnel who are more than 30 days overdue on mandatory training.

**Security Culture Metrics**: {{company_name}} measures the effectiveness of the security awareness program through: phishing simulation click rates (target: <5%); training completion rates (target: 100% within deadline); security incident reports from employees (trend monitoring); and annual security culture survey results.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["164.308(a)(5)(i)", "A.5.10", "CC1.1"],
      },
    ],
  },

  // 11. Data Retention & Disposal Policy
  {
    id: "data-retention-disposal-policy",
    framework: ["gdpr", "dpdpa", "hipaa"],
    category: "data_protection",
    title: "Data Retention & Disposal Policy",
    description:
      "Defines retention schedules for different data categories and mandates secure disposal procedures to minimize data exposure and meet legal obligations.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Retention Principles and Schedule",
        content: `## 1. Retention Principles and Schedule

This Data Retention & Disposal Policy ("Policy") establishes {{company_name}}'s requirements for retaining information for appropriate periods and disposing of it securely when no longer required. Retaining data beyond its useful life unnecessarily increases {{company_name}}'s exposure to data breaches, regulatory penalties, and litigation.

**Retention Principles**:
- Data is retained only as long as necessary for its original business purpose, legal obligation, or contractual requirement
- Retention periods begin from the date the data was last modified or the triggering event (e.g., end of contract, resolution of dispute)
- Data subject to litigation hold or regulatory investigation is retained until the hold is lifted regardless of standard retention schedule
- All data retention and disposal activities are logged for compliance verification

**Retention Schedule**:

| Data Category | Retention Period | Legal Basis |
|--------------|-----------------|-------------|
| Customer personal data | Duration of relationship + 3 years | Contractual / GDPR Art.5(1)(e) |
| Employee HR records | Duration of employment + 7 years | Legal obligation |
| Financial records | 7 years | Tax / accounting regulations |
| Audit logs | 12 months minimum; 3 years for SOC 2 scope | SOC 2, PCI-DSS requirement |
| Security incident records | 5 years | Risk management / DPDPA |
| Health records (ePHI) | 6 years from date of creation or last use | HIPAA 45 CFR 164.530(j) |
| Consent records | Duration of relationship + 5 years | GDPR Art.7 / DPDPA |
| Contract records | Duration of contract + 7 years | Legal obligation |
| Payment card data | Do not retain beyond authorization; logs 12 months | PCI-DSS Req 3.1 |

Data types not listed in this schedule should default to a 3-year retention period unless a longer period is required by law.`,
        controls: ["Art.5", "DPDPA-S9-1", "164.530(j)"],
      },
      {
        heading: "2. Secure Disposal Procedures",
        content: `## 2. Secure Disposal Procedures

**Digital Data Disposal**: When digital data reaches the end of its retention period, it must be disposed of using methods that prevent recovery:

- **Electronic Files and Databases**: Data is purged using approved secure deletion tools that overwrite all data with random patterns (minimum DoD 5220.22-M standard or NIST SP 800-88 guidelines). Simply deleting files or formatting drives is not sufficient.
- **Cloud Data**: For cloud-hosted data, deletion must be confirmed through provider APIs with deletion confirmation logs retained. Cryptographic erasure (destroying encryption keys) is an approved method for cloud storage where supported.
- **Backup Media**: Backup media containing expired data must be sanitized before reuse or physically destroyed before disposal. Media destruction is performed by approved vendors with certificates of destruction.

**Physical Media Destruction**: Physical storage media (hard drives, USB drives, tapes, CDs) must be physically destroyed using approved methods: shredding, degaussing, or incineration by a certified media destruction vendor. Destruction certificates are retained for a minimum of 3 years.

**Paper Documents**: Confidential and Restricted paper documents must be cross-cut shredded or disposed of via a certified secure document disposal service. Shred bins are provided in all office areas. Bulk paper disposal uses an approved vendor providing certificates of destruction.

**Disposal Verification**: All disposal activities are documented in the Data Disposal Log including: what was disposed, the disposal method used, the date of disposal, who authorized the disposal, and (for physical media) the certificate of destruction reference. The disposal log is reviewed quarterly by the Compliance team.`,
        controls: ["Art.5", "DPDPA-S9-1", "164.310(d)(1)"],
      },
      {
        heading: "3. Litigation Hold and Exceptions",
        content: `## 3. Litigation Hold and Exceptions

**Litigation Hold**: When {{company_name}} anticipates or is involved in litigation, regulatory investigation, or audit, a litigation hold must be placed on all potentially relevant data. Litigation holds are issued by Legal Counsel and override standard retention schedules. Personnel notified of a litigation hold must:

- Immediately cease any disposal of documents or data covered by the hold
- Preserve all relevant data in its current form, including metadata
- Report any accidental disposal to Legal Counsel immediately
- Not modify data covered by the hold without Legal Counsel's written approval

Litigation holds remain in effect until explicitly lifted by Legal Counsel.

**Retention Exceptions**: Exceptions to standard retention periods require: written approval from Legal Counsel and the CISO; documentation of the business, legal, or regulatory justification; defined extended retention period and review date; and enrollment in the Exception Register.

**Data Minimization at Collection**: Consistent with data minimization principles, {{company_name}} regularly evaluates whether the data being collected is still necessary and proportionate. Collections that no longer serve their original purpose should be discontinued.

**Annual Disposal Review**: The Compliance team conducts an annual review of data holdings to identify data that has reached or exceeded its retention period and must be disposed of. Department heads are responsible for completing disposal of out-of-retention data within 60 days of identification.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["Art.5", "DPDPA-S9-1", "164.530(j)"],
      },
    ],
  },

  // 12. Password & Authentication Policy
  {
    id: "password-authentication-policy",
    framework: ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa"],
    category: "access_control",
    title: "Password & Authentication Policy",
    description:
      "Sets minimum standards for password complexity, lifecycle management, and multi-factor authentication across all systems and user account types.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Password Standards",
        content: `## 1. Password Standards

This Password & Authentication Policy ("Policy") establishes minimum standards for credentials used to access {{company_name}}'s information systems, applications, and data. Strong authentication controls are a foundational defense against unauthorized access.

**Password Complexity Requirements**:

| Account Type | Minimum Length | Complexity | Maximum Age | History |
|-------------|---------------|------------|-------------|---------|
| Standard User | 12 characters | Upper, lower, digit, special | 365 days | Last 12 |
| Privileged / Admin | 16 characters | Upper, lower, digit, special | 90 days | Last 24 |
| Service Account | 32 characters | Randomly generated | 365 days (or automated rotation) | Last 12 |
| Shared Account | 20 characters | Randomly generated | 90 days | Last 24 |

Passwords must not: contain the user's name, username, or common dictionary words; be reused across different systems; be shared with any other person under any circumstances; be transmitted in plaintext via email or messaging systems.

**Password Manager**: {{company_name}} provides an approved enterprise password manager for all staff. Use of the approved password manager is strongly encouraged to enable unique, complex passwords for all accounts without the cognitive burden of memorization.

**Default Credentials**: All default vendor credentials must be changed before a system is placed in production. Systems that cannot change default credentials require a documented exception and compensating controls.`,
        controls: ["CC6.2", "CC6.3", "A.8.5", "8.2.1", "8.3.1", "164.312(d)"],
      },
      {
        heading: "2. Multi-Factor Authentication",
        content: `## 2. Multi-Factor Authentication Requirements

**MFA Mandate**: Multi-factor authentication is mandatory for the following access scenarios:

- All user accounts accessing any system from outside the corporate network via VPN or direct internet access
- All accounts with administrative or privileged access, regardless of network location
- All access to cloud management consoles (AWS, Azure, GCP) and infrastructure management tools
- All access to systems classified as Confidential or Restricted
- All remote desktop or terminal access to servers
- All access to source code repositories and CI/CD pipelines
- All access to password management systems

**Approved MFA Methods** (in order of preference):
1. Hardware security keys (FIDO2/WebAuthn — YubiKey or equivalent) — Required for all privileged accounts
2. Time-based One-Time Password (TOTP) authenticator app (Microsoft Authenticator, Google Authenticator) — Standard for all other accounts
3. Push notification authentication (where the authenticator app supports approval) — Acceptable with phishing resistance measures
4. SMS OTP — Permitted only as a fallback where stronger methods are not supported; not permitted for privileged accounts

**MFA Enrollment**: MFA must be enrolled before or simultaneously with granting account access. IT Helpdesk assists with enrollment. MFA backup codes must be stored securely — {{company_name}} recommends the enterprise password manager.`,
        controls: ["CC6.2", "A.8.5", "8.3.1", "164.312(d)"],
      },
      {
        heading: "3. Account Lockout and Recovery",
        content: `## 3. Account Lockout, Monitoring, and Recovery

**Account Lockout Policy**: User accounts must be locked after a maximum of 10 consecutive failed authentication attempts. Privileged accounts lock after 5 consecutive failed attempts. Lockout duration is a minimum of 15 minutes, after which accounts automatically unlock. IT Helpdesk can unlock accounts manually after verifying the user's identity.

**Authentication Monitoring**: All authentication events — successful and failed — are logged to the SIEM. Monitoring alerts are configured for:
- More than 5 failed login attempts in 10 minutes from a single source
- Successful login from an unusual geographic location or IP reputation
- Successful login outside of normal business hours for privileged accounts
- Multiple concurrent sessions from different geographic locations
- Account lockouts exceeding the daily average by a significant margin

**Password Reset Procedures**: Self-service password resets require verification via MFA or a secondary email address. Helpdesk-assisted resets require verification of the user's identity through a defined identity proofing process (manager confirmation, government ID, or video call). Emergency access procedures are documented and reviewed quarterly. Temporary passwords issued during resets must be changed on first use.

**Credential Breach Response**: {{company_name}} monitors threat intelligence feeds for compromised credentials. If an employee's credentials appear in a public breach database, the employee's password is immediately forced to reset. Enterprise password health monitoring checks for reused or compromised passwords.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["CC6.2", "CC6.3", "A.8.5", "8.2.1", "164.312(d)"],
      },
    ],
  },

  // 13. Physical Security Policy
  {
    id: "physical-security-policy",
    framework: ["iso27001", "pcidss"],
    category: "asset_management",
    title: "Physical Security Policy",
    description:
      "Protects information processing facilities, equipment, and sensitive areas from unauthorized physical access, damage, and environmental threats.",
    requiredForTier: "protect",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Physical Access Controls",
        content: `## 1. Physical Access Controls

This Physical Security Policy ("Policy") establishes {{company_name}}'s requirements for controlling physical access to facilities, equipment, and sensitive areas. Physical security is the first line of defense for information systems and must complement technical security controls.

**Facility Zones**: {{company_name}} facilities are divided into security zones with progressively stricter access controls:

- **Public Areas**: Lobbies, reception, meeting rooms for external visitors — no badge required; visitors must be accompanied
- **General Office Areas**: Standard working areas — requires employee badge; visitors require escort
- **Restricted Areas**: Data rooms, server rooms, network equipment rooms — requires specific badge authorization; no visitors without advance approval and escort
- **High Security Areas**: Primary data center, CDE areas, secure storage — requires badge plus PIN; biometric access where supported; logged entry; no visitor access except with CISO/facility manager approval

**Access Provisioning**: Physical access badges are provisioned as part of employee onboarding. Badge access levels are assigned based on job role and business need. Managers request access for their team members via the facilities management system. All physical access grants are documented.

**Visitor Management**: All visitors must register at reception, present valid photo ID, wear a visitor badge, and be escorted by an authorized employee at all times. Visitor logs are maintained for a minimum of 90 days. Visitors are never permitted unescorted access to Restricted or High Security areas.`,
        controls: ["164.310(a)(1)", "A.5.9"],
      },
      {
        heading: "2. Environmental and Equipment Controls",
        content: `## 2. Environmental and Equipment Controls

**Data Center / Server Room Security**: {{company_name}}'s server rooms and data center areas require:
- Electronic access control with audit trail on all entry points
- CCTV coverage of all entry points, active 24/7 with 90-day footage retention
- Motion-activated lighting
- Smoke detection and automatic fire suppression (data center safe)
- Uninterruptible power supply (UPS) with minimum 2-hour runtime
- Backup generator for extended outages
- Environmental monitoring: temperature, humidity, water leak detection
- Regular alarm testing — at minimum annually

**Equipment Security**: All server and network equipment must be physically secured (rack-mounted and locked, or bolted down). Equipment labels must not identify the function or sensitivity of the device externally. Removal of equipment from secure areas requires documented approval and is logged.

**Clean Desk Policy**: Personnel must maintain a clean desk when away from their workspace and at the end of each business day. Confidential documents must not be left unattended on desks or in unlocked drawers. Whiteboards containing sensitive information must be erased before leaving meeting rooms.

**Clear Screen Policy**: Workstations automatically lock after 5 minutes of inactivity. Employees must manually lock their workstation (Windows+L) when leaving their desk. Laptop screens must be closed or locked when in public areas. Privacy screens are provided for employees who regularly work in public spaces.`,
        controls: ["164.310(a)(1)", "164.310(d)(1)", "A.5.9", "11.1"],
      },
      {
        heading: "3. Device Management and Disposal",
        content: `## 3. Device Management and Disposal

**Asset Inventory**: All physical assets containing data (servers, workstations, laptops, mobile devices, storage media) are recorded in the Asset Register with asset owner, location, and classification. The Asset Register is audited semi-annually.

**Mobile Device Security**: Company-issued mobile devices are enrolled in Mobile Device Management (MDM) before first use. MDM enforces: PIN/biometric lock; full-device encryption; remote wipe capability; restriction of non-approved applications; and automatic enrollment in security monitoring. Employees must report lost or stolen devices immediately to enable remote wipe.

**Device Decommissioning**: Devices removed from service must undergo approved sanitization before disposal or repurposing: hard drives are overwritten using approved tools or physically destroyed; solid-state storage is cryptographically erased; mobile devices are factory reset via MDM. Evidence of sanitization is retained for each device. Decommissioned devices are not donated, sold, or discarded until sanitization is confirmed.

**Physical Media Handling**: Removable media (USB drives, external hard drives) is prohibited unless explicitly authorized for specific business purposes. Authorized removable media must be encrypted and registered. Media used to transfer data between systems must be sanitized or destroyed after use.

**Tailgating Prevention**: Employees must not allow others to follow them through controlled access points (tailgating/piggybacking). Any individual without a visible badge attempting to enter secure areas must be politely challenged and directed to reception.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["164.310(a)(1)", "164.310(d)(1)", "A.5.9", "A.5.10"],
      },
    ],
  },

  // 14. Acceptable Use Policy
  {
    id: "acceptable-use-policy",
    framework: ["soc2", "iso27001"],
    category: "employee_security",
    title: "Acceptable Use Policy",
    description:
      "Defines permitted and prohibited uses of company information systems, equipment, and data by employees and contractors.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Permitted and Prohibited Uses",
        content: `## 1. Permitted and Prohibited Uses

This Acceptable Use Policy ("Policy") defines the conditions under which {{company_name}} personnel may use company information systems, computing devices, networks, and data. The purpose is to protect {{company_name}}'s assets, maintain system security, and ensure that technology resources are used effectively for business purposes.

This Policy applies to all employees, contractors, consultants, and other authorized users of {{company_name}}'s technology resources.

**Permitted Uses**: {{company_name}}'s technology resources are provided for business purposes. Incidental personal use is permitted provided it: does not interfere with job responsibilities; does not consume significant system resources; does not involve accessing inappropriate content; does not create legal or security risks for {{company_name}}; and complies with all other provisions of this Policy.

**Prohibited Uses**: The following activities are strictly prohibited on {{company_name}} systems and devices:

- Accessing, downloading, or distributing illegal content, including material that infringes copyright, is obscene, or violates laws in applicable jurisdictions
- Harassment, bullying, discrimination, or threatening communications of any kind
- Unauthorized access to or disclosure of confidential information
- Using {{company_name}} systems to conduct personal business activities or commercial activities unrelated to employment
- Installing unauthorized software, applications, or browser extensions
- Circumventing security controls, including using VPNs to bypass content filtering without authorization
- Mining cryptocurrency or other computationally intensive personal activities
- Accessing systems or data beyond authorized access levels
- Sharing {{company_name}} credentials with any other person`,
        controls: ["A.5.10", "CC1.1"],
      },
      {
        heading: "2. Monitoring and Privacy",
        content: `## 2. Monitoring and Privacy

**Monitoring Disclosure**: {{company_name}} reserves the right to monitor, log, and audit the use of all company-provided technology resources, including computers, mobile devices, network traffic, email, and applications. By using {{company_name}} technology resources, all users acknowledge and consent to this monitoring.

**What Is Monitored**: {{company_name}} may monitor: network traffic and internet browsing activity on company networks; email and instant messaging communications on company systems; authentication events, system access logs, and file access logs; application usage and data transfers; and endpoint activity through endpoint detection and response (EDR) tools.

**Privacy Expectations**: While {{company_name}} respects the privacy of its employees, there is no expectation of privacy when using company-owned systems, networks, or devices. Personal use of company technology resources may be visible to {{company_name}}'s IT and security teams during the course of their monitoring activities.

**Bring Your Own Device (BYOD)**: If employees use personal devices to access company resources, they consent to the installation of a Mobile Device Management (MDM) profile on that device for the purpose of managing company data. The MDM profile applies only to the company work profile and does not monitor personal applications or data. Employees may remove the MDM profile by unenrolling from the BYOD program, which will result in loss of access to company resources.

**Investigation**: {{company_name}} may conduct investigations into potential policy violations, which may include more detailed review of user activity logs, device contents, or communications. Investigations are conducted in compliance with applicable law and with appropriate privacy protections.`,
        controls: ["A.5.10", "CC1.1", "CC7.1"],
      },
      {
        heading: "3. Consequences and Reporting",
        content: `## 3. Consequences and Reporting

**Policy Violations**: Violations of this Policy will be investigated and may result in disciplinary action up to and including termination of employment or contract, legal action, and/or reporting to appropriate authorities. The severity of the response will be proportionate to the nature and impact of the violation.

**Reporting Violations**: Employees who become aware of potential violations of this Policy — by themselves or others — are encouraged to report them promptly. Reports can be made to: the direct manager (where appropriate); the IT Help Desk for technical issues; the CISO or Information Security team for security-related concerns; or the Ethics Hotline for anonymous reporting. {{company_name}} has a non-retaliation policy — reporting in good faith will not result in adverse consequences.

**Software Licensing**: Users are responsible for complying with software license agreements. Installing unlicensed or pirated software on {{company_name}} systems is a violation of this Policy and may constitute a legal violation. All software installed on company devices must be approved by IT and properly licensed.

**Social Media**: Employees must not disclose confidential {{company_name}} information, customer information, or unpublished business information on social media platforms. Employees representing {{company_name}} on social media in a professional capacity must follow the Social Media Guidelines. Employees are responsible for their personal social media activities and must make clear that personal opinions do not represent {{company_name}}'s views.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["A.5.10", "CC1.1"],
      },
    ],
  },

  // 15. Risk Assessment Policy
  {
    id: "risk-assessment-policy",
    framework: ["iso27001", "soc2"],
    category: "risk_management",
    title: "Risk Assessment Policy",
    description:
      "Establishes the methodology for identifying, analyzing, evaluating, and treating information security risks on a continuous basis.",
    requiredForTier: "comply",
    applicableIndustries: ["finance", "healthcare", "saas", "retail", "manufacturing", "government"],
    sections: [
      {
        heading: "1. Risk Assessment Methodology",
        content: `## 1. Risk Assessment Methodology

This Risk Assessment Policy ("Policy") establishes {{company_name}}'s approach to identifying, analyzing, and evaluating information security risks as part of the Information Security Management System (ISMS). Effective risk management enables {{company_name}} to make informed decisions about where to invest in security controls and how to prioritize remediation activities.

**Risk Assessment Framework**: {{company_name}} uses a risk-based approach aligned to ISO/IEC 27005 and NIST SP 800-30. Risk assessments are conducted using the following methodology:

**Risk Identification**: Identify assets within scope, including information assets, systems, processes, and people. For each asset, identify threats (natural, human, environmental) and vulnerabilities that could be exploited. Sources of risk identification include: threat intelligence feeds; vulnerability scan results; security incident analysis; employee and system owner input; industry and regulatory guidance; and third-party security assessments.

**Risk Analysis**: For each identified risk, assess:
- **Likelihood**: The probability that the threat will successfully exploit the vulnerability (rated 1-5: Very Low, Low, Medium, High, Very High)
- **Impact**: The consequence to {{company_name}} if the risk materializes, considering confidentiality, integrity, availability, financial, reputational, and regulatory dimensions (rated 1-5: Negligible, Minor, Moderate, Major, Critical)
- **Risk Level**: Calculated as Likelihood × Impact, producing a risk score of 1-25

**Risk Evaluation**: Risks are categorized:
- Score 20-25: **Critical** — Immediate treatment required; escalate to CISO
- Score 12-19: **High** — Treatment plan required within 30 days
- Score 6-11: **Medium** — Treatment plan required within 90 days
- Score 1-5: **Low** — Accept with monitoring or treat in next planning cycle`,
        controls: ["CC3.1", "CC3.2", "A.5.15"],
      },
      {
        heading: "2. Risk Treatment and Acceptance",
        content: `## 2. Risk Treatment and Acceptance

**Risk Treatment Options**: For each identified risk, a treatment option is selected:

- **Mitigate (Reduce)**: Implement or improve controls to reduce the likelihood or impact of the risk to an acceptable level. This is the most common treatment for High and Critical risks.
- **Transfer (Share)**: Transfer the financial consequence to a third party, typically through cyber insurance or contractual indemnification. Risk transfer does not eliminate the underlying risk.
- **Avoid (Eliminate)**: Discontinue the activity that gives rise to the risk. Appropriate where the risk cannot be reduced to an acceptable level and the activity is not essential.
- **Accept (Tolerate)**: Formally accept the risk without additional treatment where: the risk falls within the defined risk appetite; the cost of treatment exceeds the benefit; or no effective treatment option is available. Risk acceptance requires formal documentation and CISO approval. Critical risks may not be accepted without executive sign-off.

**Risk Appetite**: {{company_name}}'s risk appetite is defined annually by executive leadership. Risks with a residual score exceeding the defined risk appetite threshold require executive approval to accept and are reported to the Board of Directors.

**Risk Register**: {{company_name}} maintains a Risk Register documenting all identified risks, their assessment scores, treatment decisions, assigned owners, and remediation status. The Risk Register is maintained by the CISO and reviewed monthly by the Information Security team and quarterly by executive leadership.

**Residual Risk**: After treatment, risks are re-assessed to determine the residual risk level. Where residual risk exceeds the risk appetite, additional treatment is required until the residual risk is acceptable or the risk is formally accepted with appropriate approvals.`,
        controls: ["CC3.1", "CC3.2"],
      },
      {
        heading: "3. Risk Assessment Schedule and Governance",
        content: `## 3. Risk Assessment Schedule and Governance

**Assessment Frequency**: Risk assessments are conducted at the following intervals:

- **Enterprise-Wide Risk Assessment**: Annually, covering all in-scope information assets and processes
- **Project Risk Assessments**: For all new systems, major system changes, new third-party relationships, and material changes to business processes — assessed before go-live
- **Targeted Assessments**: Triggered by material security incidents, significant threat intelligence, or regulatory changes
- **Continuous Risk Monitoring**: Ongoing monitoring of the Risk Register with monthly review of all High and Critical risks

**Risk Assessment Governance**: The CISO is responsible for maintaining the risk assessment methodology, facilitating enterprise-wide risk assessments, and reporting to executive leadership. System and process owners are responsible for identifying risks in their domains and implementing agreed treatment plans. All personnel are encouraged to report new or emerging risks through the standard incident/risk reporting process.

**Risk Reporting**: Risk reporting is provided to: the CISO (weekly — operational risk updates); executive leadership (quarterly — risk posture summary, trend analysis, residual risk against appetite); Board of Directors (annually — information security risk summary); external auditors (as required — risk register and treatment evidence).

**Integration with Business Planning**: Information security risk assessments are integrated into business planning cycles. Material unmitigated risks are factored into budget planning. New business initiatives include security risk assessment as a required step in the approval process.

**Effective Date**: {{effective_date}} | **Next Review**: {{review_date}} | **Policy Owner**: {{policy_owner}}`,
        controls: ["CC3.1", "CC3.2", "A.5.15"],
      },
    ],
  },

  // =========================================================================
  // ISO 42001 — AI Management System Policies
  // =========================================================================

  {
    id: "ai-governance-policy",
    framework: ["iso42001"],
    category: "risk_management" as PolicyCategory,
    title: "AI Governance Policy",
    description: "Establishes governance framework for responsible AI management per ISO 42001",
    applicableIndustries: ["saas", "finance", "healthcare", "government", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. Purpose and Scope", content: "## 1. Purpose and Scope\n\nThis policy establishes the governance framework for artificial intelligence (AI) systems at {{company_name}}. It applies to all AI systems developed, deployed, or procured by the organization. The policy ensures AI systems are managed responsibly, ethically, and in compliance with ISO 42001:2023.\n\n**Effective Date**: {{effective_date}} | **Policy Owner**: {{policy_owner}}", controls: ["AI-5.1", "AI-4.1"] },
      { heading: "2. AI Governance Structure", content: "## 2. AI Governance Structure\n\nThe organization maintains an AI Governance Committee responsible for overseeing AI strategy, risk management, and ethical considerations. The committee includes representatives from technology, legal, compliance, and business units.\n\n**AI Officer**: Designated individual responsible for AI governance implementation.\n**Review Board**: Reviews high-risk AI deployments before production.", controls: ["AI-5.2", "AI-5.1"] },
      { heading: "3. AI System Lifecycle", content: "## 3. AI System Lifecycle\n\nAll AI systems follow a defined lifecycle: Design → Development → Testing → Validation → Deployment → Monitoring → Retirement. Each phase requires documented approvals and compliance checks.\n\n**Approved By**: {{approved_by}} | **Next Review**: {{review_date}}", controls: ["AI-8.1", "AI-8.3"] },
    ],
  },
  {
    id: "ai-risk-management-policy",
    framework: ["iso42001"],
    category: "risk_management" as PolicyCategory,
    title: "AI Risk Management Policy",
    description: "Systematic approach to identifying, assessing, and treating AI-specific risks",
    applicableIndustries: ["saas", "finance", "healthcare", "government", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. AI Risk Framework", content: "## 1. AI Risk Framework\n\n{{company_name}} implements a systematic AI risk management process aligned with ISO 42001. Risks are identified across technical, ethical, legal, and operational dimensions for all AI systems.\n\n**Risk Categories**: Model risk, data risk, bias risk, privacy risk, security risk, operational risk.", controls: ["AI-6.1"] },
      { heading: "2. Risk Assessment Process", content: "## 2. Risk Assessment Process\n\nAI risk assessments are conducted before deployment and at regular intervals. High-risk AI systems undergo enhanced assessment including impact analysis on affected individuals and groups.\n\n**Assessment Frequency**: Before deployment, quarterly for high-risk, annually for standard-risk systems.", controls: ["AI-6.1", "AI-A.2"] },
      { heading: "3. Risk Treatment", content: "## 3. Risk Treatment\n\nIdentified risks are treated through: avoidance, mitigation, transfer, or acceptance. All treatment plans require documented approval. Residual risk must be within organizational risk appetite.\n\n**Effective Date**: {{effective_date}} | **Policy Owner**: {{policy_owner}}", controls: ["AI-6.2"] },
    ],
  },
  {
    id: "ai-ethics-policy",
    framework: ["iso42001"],
    category: "risk_management" as PolicyCategory,
    title: "AI Ethics and Responsible Use Policy",
    description: "Ensures AI systems are developed and used ethically with respect for human rights",
    applicableIndustries: ["saas", "finance", "healthcare", "government", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. Ethical Principles", content: "## 1. Ethical Principles\n\n{{company_name}} commits to the following AI ethical principles:\n- **Fairness**: AI systems shall not discriminate based on protected characteristics\n- **Transparency**: AI decision-making processes shall be explainable\n- **Accountability**: Clear ownership for AI system outcomes\n- **Human Dignity**: AI shall respect human autonomy and rights\n- **Privacy**: AI shall minimize data collection and protect individual privacy", controls: ["AI-A.3", "AI-A.4", "AI-A.5"] },
      { heading: "2. Bias Prevention", content: "## 2. Bias Prevention\n\nAll AI models undergo bias testing before deployment. Regular bias audits are conducted on production systems. Detected bias triggers mandatory remediation within defined SLAs.\n\n**Testing Frequency**: Pre-deployment and quarterly.", controls: ["AI-A.4"] },
      { heading: "3. Human Oversight", content: "## 3. Human Oversight\n\nHigh-impact AI decisions require human review before execution. Override mechanisms must be available for all automated decisions. Human oversight rates are monitored and reported.\n\n**Effective Date**: {{effective_date}} | **Approved By**: {{approved_by}}", controls: ["AI-A.5"] },
    ],
  },
  {
    id: "ai-data-quality-policy",
    framework: ["iso42001"],
    category: "data_protection" as PolicyCategory,
    title: "AI Data Quality Policy",
    description: "Standards for data quality, provenance, and management in AI systems",
    applicableIndustries: ["saas", "finance", "healthcare", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. Data Quality Standards", content: "## 1. Data Quality Standards\n\nData used in AI systems at {{company_name}} must meet defined quality standards for accuracy, completeness, timeliness, and representativeness. Data quality metrics are monitored continuously.", controls: ["AI-8.2"] },
      { heading: "2. Data Provenance", content: "## 2. Data Provenance\n\nAll training data must have documented provenance including source, collection method, consent basis, and any transformations applied. Data lineage is tracked through the full lifecycle.", controls: ["AI-A.7"] },
      { heading: "3. Data Governance", content: "## 3. Data Governance\n\nA Data Steward is assigned for each AI dataset. Regular quality assessments are conducted. Data drift is monitored in production.\n\n**Effective Date**: {{effective_date}} | **Policy Owner**: {{policy_owner}}", controls: ["AI-8.2", "AI-A.7"] },
    ],
  },
  {
    id: "ai-transparency-policy",
    framework: ["iso42001"],
    category: "risk_management" as PolicyCategory,
    title: "AI Transparency and Explainability Policy",
    description: "Requirements for AI decision transparency and model explainability",
    applicableIndustries: ["saas", "finance", "healthcare", "government", "aitech"],
    requiredForTier: "protect" as PolicyTier,
    sections: [
      { heading: "1. Transparency Requirements", content: "## 1. Transparency Requirements\n\n{{company_name}} ensures stakeholders are informed when AI systems are used in decisions that affect them. Documentation includes model purpose, capabilities, limitations, and performance metrics.", controls: ["AI-A.3"] },
      { heading: "2. Explainability Standards", content: "## 2. Explainability Standards\n\nAI decisions must be explainable to the appropriate level for each stakeholder group. Technical explanations for developers, business explanations for operators, and plain-language explanations for affected individuals.", controls: ["AI-A.3", "AI-9.1"] },
      { heading: "3. Documentation", content: "## 3. Documentation\n\nAll AI models maintain model cards documenting architecture, training data, performance metrics, known limitations, and intended use cases.\n\n**Effective Date**: {{effective_date}}", controls: ["AI-A.3", "AI-4.1"] },
    ],
  },
  {
    id: "ai-third-party-policy",
    framework: ["iso42001"],
    category: "vendor_management" as PolicyCategory,
    title: "AI Third-Party Management Policy",
    description: "Managing risks from third-party AI components, APIs, and services",
    applicableIndustries: ["saas", "finance", "healthcare", "aitech"],
    requiredForTier: "protect" as PolicyTier,
    sections: [
      { heading: "1. Third-Party AI Assessment", content: "## 1. Third-Party AI Assessment\n\nAll third-party AI components used by {{company_name}} undergo risk assessment before procurement. Assessment covers: data handling, bias risk, security posture, compliance certifications, and contractual protections.", controls: ["AI-A.6"] },
      { heading: "2. Vendor Monitoring", content: "## 2. Vendor Monitoring\n\nThird-party AI vendors are monitored continuously for: service quality, model changes, data handling practices, and compliance status. Annual reassessment is mandatory.\n\n**Effective Date**: {{effective_date}} | **Policy Owner**: {{policy_owner}}", controls: ["AI-A.6", "AI-8.4"] },
    ],
  },
  {
    id: "ai-incident-response-policy",
    framework: ["iso42001"],
    category: "incident_response" as PolicyCategory,
    title: "AI Incident Response Policy",
    description: "Procedures for managing AI-related incidents, failures, and near-misses",
    applicableIndustries: ["saas", "finance", "healthcare", "government", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. AI Incident Classification", content: "## 1. AI Incident Classification\n\nAI incidents at {{company_name}} are classified by severity:\n- **Critical**: AI system causes harm, discrimination, or significant financial loss\n- **High**: AI produces consistently incorrect outputs affecting business decisions\n- **Medium**: AI performance degradation detected\n- **Low**: Minor anomalies in AI behavior", controls: ["AI-10.1"] },
      { heading: "2. Response Procedures", content: "## 2. Response Procedures\n\nCritical AI incidents trigger immediate model shutdown. Root cause analysis is mandatory for all High+ incidents. Near-misses are tracked and analyzed for preventive improvements.\n\n**Response SLA**: Critical=1hr, High=4hr, Medium=24hr, Low=72hr.\n\n**Effective Date**: {{effective_date}} | **Approved By**: {{approved_by}}", controls: ["AI-10.1", "AI-10.2"] },
    ],
  },
  {
    id: "ai-training-competence-policy",
    framework: ["iso42001"],
    category: "employee_security" as PolicyCategory,
    title: "AI Training and Competence Policy",
    description: "Ensuring personnel have required AI competencies and awareness",
    applicableIndustries: ["saas", "finance", "healthcare", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. Competence Requirements", content: "## 1. Competence Requirements\n\n{{company_name}} defines competence requirements for all roles involved in AI development, deployment, and oversight. Training programs are provided to address gaps.\n\n**Roles**: AI Developer, AI Reviewer, Data Scientist, AI Governance Officer, Business User.", controls: ["AI-7.1"] },
      { heading: "2. Awareness Program", content: "## 2. Awareness Program\n\nAll employees receive AI awareness training covering: responsible AI use, bias awareness, data privacy in AI, and reporting procedures for AI concerns.\n\n**Frequency**: Annual for all staff, quarterly for AI teams.\n\n**Effective Date**: {{effective_date}} | **Policy Owner**: {{policy_owner}}", controls: ["AI-7.1", "AI-7.2"] },
    ],
  },
  {
    id: "ai-privacy-protection-policy",
    framework: ["iso42001", "gdpr"],
    category: "data_protection" as PolicyCategory,
    title: "AI Privacy and Data Protection Policy",
    description: "Protecting individual privacy in AI data collection, processing, and decision-making",
    applicableIndustries: ["saas", "finance", "healthcare", "government", "aitech"],
    requiredForTier: "comply" as PolicyTier,
    sections: [
      { heading: "1. Privacy by Design", content: "## 1. Privacy by Design\n\n{{company_name}} implements privacy by design in all AI systems. Data minimization, purpose limitation, and consent management are built into the AI lifecycle.", controls: ["AI-A.8", "Art.25(1)"] },
      { heading: "2. AI-Specific Privacy Controls", content: "## 2. AI-Specific Privacy Controls\n\nAI systems implement: differential privacy where applicable, data anonymization for training, consent verification before personal data processing, and right-to-explanation for automated decisions.\n\n**Effective Date**: {{effective_date}} | **Approved By**: {{approved_by}}", controls: ["AI-A.8", "Art.32(1)"] },
    ],
  },
  {
    id: "ai-model-lifecycle-policy",
    framework: ["iso42001"],
    category: "change_management" as PolicyCategory,
    title: "AI Model Lifecycle Management Policy",
    description: "Managing AI models from development through retirement with validation gates",
    applicableIndustries: ["saas", "finance", "healthcare", "aitech"],
    requiredForTier: "protect" as PolicyTier,
    sections: [
      { heading: "1. Model Development Standards", content: "## 1. Model Development Standards\n\n{{company_name}} follows defined standards for AI model development including: version control, reproducibility requirements, documentation, and peer review before deployment.", controls: ["AI-8.1", "AI-8.3"] },
      { heading: "2. Validation and Testing", content: "## 2. Validation and Testing\n\nAll models undergo validation testing including: accuracy benchmarks, bias assessment, adversarial robustness testing, and performance under load. Results must meet defined thresholds before promotion.", controls: ["AI-8.3", "AI-9.1"] },
      { heading: "3. Production Monitoring", content: "## 3. Production Monitoring\n\nDeployed models are monitored for: performance drift, data distribution changes, fairness metric degradation, and operational anomalies. Alerts trigger automatic review workflows.\n\n**Effective Date**: {{effective_date}} | **Policy Owner**: {{policy_owner}}", controls: ["AI-8.4", "AI-9.1"] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Industry Presets
// ---------------------------------------------------------------------------

const INDUSTRY_PRESETS: Record<string, string[]> = {
  finance: [
    "infosec-policy",
    "access-control-policy",
    "data-protection-privacy-policy",
    "incident-response-plan",
    "change-management-policy",
    "encryption-policy",
    "network-security-policy",
    "vendor-risk-policy",
    "employee-security-awareness-policy",
    "password-authentication-policy",
    "risk-assessment-policy",
  ],
  healthcare: [
    "infosec-policy",
    "access-control-policy",
    "data-protection-privacy-policy",
    "incident-response-plan",
    "encryption-policy",
    "data-retention-disposal-policy",
    "employee-security-awareness-policy",
    "password-authentication-policy",
    "physical-security-policy",
    "risk-assessment-policy",
  ],
  saas: [
    "infosec-policy",
    "access-control-policy",
    "data-protection-privacy-policy",
    "incident-response-plan",
    "change-management-policy",
    "encryption-policy",
    "network-security-policy",
    "vendor-risk-policy",
    "employee-security-awareness-policy",
    "acceptable-use-policy",
    "password-authentication-policy",
    "risk-assessment-policy",
  ],
  retail: [
    "infosec-policy",
    "access-control-policy",
    "data-protection-privacy-policy",
    "incident-response-plan",
    "encryption-policy",
    "network-security-policy",
    "employee-security-awareness-policy",
    "password-authentication-policy",
    "physical-security-policy",
    "data-retention-disposal-policy",
  ],
  manufacturing: [
    "infosec-policy",
    "access-control-policy",
    "incident-response-plan",
    "change-management-policy",
    "network-security-policy",
    "business-continuity-policy",
    "employee-security-awareness-policy",
    "password-authentication-policy",
    "physical-security-policy",
    "vendor-risk-policy",
  ],
  government: [
    "infosec-policy",
    "access-control-policy",
    "data-protection-privacy-policy",
    "incident-response-plan",
    "change-management-policy",
    "encryption-policy",
    "network-security-policy",
    "business-continuity-policy",
    "employee-security-awareness-policy",
    "password-authentication-policy",
    "physical-security-policy",
    "risk-assessment-policy",
    "data-retention-disposal-policy",
  ],
  aitech: [
    "ai-governance-policy",
    "ai-risk-management-policy",
    "ai-ethics-policy",
    "ai-data-quality-policy",
    "ai-transparency-policy",
    "ai-third-party-policy",
    "ai-incident-response-policy",
    "ai-training-competence-policy",
    "ai-privacy-protection-policy",
    "ai-model-lifecycle-policy",
    "infosec-policy",
    "access-control-policy",
    "data-protection-privacy-policy",
  ],
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fillPlaceholders(content: string, customization: PolicyCustomization): string {
  const reviewDate = computeReviewDate(customization.effectiveDate, customization.reviewFrequency);

  return content
    .replace(/\{\{company_name\}\}/g, customization.companyName)
    .replace(/\{\{effective_date\}\}/g, customization.effectiveDate)
    .replace(/\{\{review_date\}\}/g, reviewDate)
    .replace(/\{\{review_frequency\}\}/g, customization.reviewFrequency)
    .replace(/\{\{policy_owner\}\}/g, customization.policyOwner ?? "CISO")
    .replace(/\{\{approved_by\}\}/g, customization.approvedBy ?? "Chief Executive Officer")
    .replace(/\{\{data_types\}\}/g, (customization.dataTypes ?? []).join(", ") || "personal data")
    .replace(
      /\{\{jurisdictions\}\}/g,
      (customization.jurisdictions ?? []).join(", ") || "all applicable jurisdictions",
    );
}

function computeReviewDate(effectiveDate: string, reviewFrequency: string): string {
  const d = new Date(effectiveDate);
  if (!isNaN(d.getTime())) {
    const freq = reviewFrequency.toLowerCase();
    if (freq.includes("annual") || freq.includes("year")) {
      d.setFullYear(d.getFullYear() + 1);
    } else if (freq.includes("semi") || freq.includes("6 month")) {
      d.setMonth(d.getMonth() + 6);
    } else if (freq.includes("quarter")) {
      d.setMonth(d.getMonth() + 3);
    } else {
      d.setFullYear(d.getFullYear() + 1);
    }
    return d.toISOString().split("T")[0];
  }
  return "See policy owner";
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PolicyDesignerService {
  constructor(private db: Db) {}

  // --- Template accessors ---

  listTemplates(filters: {
    framework?: string;
    category?: string;
    industry?: string;
  }): PolicyTemplate[] {
    let templates = POLICY_TEMPLATES;

    if (filters.framework) {
      templates = templates.filter((t) => t.framework.includes(filters.framework!));
    }
    if (filters.category) {
      templates = templates.filter((t) => t.category === filters.category);
    }
    if (filters.industry) {
      templates = templates.filter((t) => t.applicableIndustries.includes(filters.industry!));
    }

    return templates;
  }

  getTemplate(templateId: string): PolicyTemplate {
    const tpl = POLICY_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) throw notFound(`Policy template '${templateId}'`);
    return tpl;
  }

  // --- Generation ---

  generatePolicy(templateId: string, customization: PolicyCustomization): string {
    const tpl = this.getTemplate(templateId);

    const header = [
      `# ${tpl.title}`,
      ``,
      `**Organization**: ${customization.companyName}`,
      `**Effective Date**: ${customization.effectiveDate}`,
      `**Policy Owner**: ${customization.policyOwner ?? "CISO"}`,
      `**Approved By**: ${customization.approvedBy ?? "Chief Executive Officer"}`,
      `**Review Frequency**: ${customization.reviewFrequency}`,
      `**Framework(s)**: ${tpl.framework.join(", ").toUpperCase()}`,
      `**Version**: 1.0`,
      ``,
      `---`,
      ``,
    ].join("\n");

    const body = tpl.sections
      .map((section) => fillPlaceholders(section.content, customization))
      .join("\n\n");

    const footer = [
      ``,
      `---`,
      ``,
      `*This policy was generated by BLACKFYRE Automatic Policy Designer on ${new Date().toISOString().split("T")[0]}.*`,
      `*Review and customize before formal adoption. Consult qualified legal and compliance counsel for jurisdiction-specific requirements.*`,
    ].join("\n");

    return header + body + footer;
  }

  // --- Persistence ---

  async saveGeneratedPolicy(
    tenantId: string,
    templateId: string,
    customization: PolicyCustomization,
    content: string,
  ): Promise<typeof generatedPolicies.$inferSelect> {
    const tpl = this.getTemplate(templateId);

    const [created] = await this.db
      .insert(generatedPolicies)
      .values({
        tenantId,
        templateId,
        title: tpl.title,
        framework: tpl.framework,
        category: tpl.category,
        content,
        customization: customization as unknown as Record<string, unknown>,
        version: "1.0",
      })
      .returning();

    return created;
  }

  async listGeneratedPolicies(tenantId: string): Promise<typeof generatedPolicies.$inferSelect[]> {
    return this.db
      .select()
      .from(generatedPolicies)
      .where(eq(generatedPolicies.tenantId, tenantId))
      .orderBy(desc(generatedPolicies.createdAt));
  }

  async getGeneratedPolicy(
    tenantId: string,
    policyId: string,
  ): Promise<typeof generatedPolicies.$inferSelect> {
    const [policy] = await this.db
      .select()
      .from(generatedPolicies)
      .where(and(eq(generatedPolicies.id, policyId), eq(generatedPolicies.tenantId, tenantId)));

    if (!policy) throw notFound("Policy");
    return policy;
  }

  async deleteGeneratedPolicy(tenantId: string, policyId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(generatedPolicies)
      .where(and(eq(generatedPolicies.id, policyId), eq(generatedPolicies.tenantId, tenantId)))
      .returning({ id: generatedPolicies.id });

    if (!deleted) throw notFound("Policy");
  }

  // --- Gap Analysis ---

  async analyzeGaps(tenantId: string, frameworks: string[]): Promise<GapAnalysisResult> {
    // Get existing policy template IDs for this tenant
    const existing = await this.db
      .select({ templateId: generatedPolicies.templateId })
      .from(generatedPolicies)
      .where(eq(generatedPolicies.tenantId, tenantId));

    const existingIds = new Set(existing.map((e) => e.templateId));

    // Determine required templates for the given frameworks
    const required = POLICY_TEMPLATES.filter((t) =>
      frameworks.some((fw) => t.framework.includes(fw)),
    );

    const gaps = required.filter((t) => !existingIds.has(t.id));
    const coverage = required.length === 0
      ? 100
      : Math.round(((required.length - gaps.length) / required.length) * 100);

    return {
      required,
      existing: Array.from(existingIds),
      gaps,
      coverage,
    };
  }

  // --- Compliance Check ---

  async checkCompliance(tenantId: string, framework: string): Promise<FrameworkComplianceResult> {
    const registry = getFrameworkRegistry(framework);
    if (!registry) throw badRequest("UNKNOWN_FRAMEWORK", `Framework '${framework}' is not supported`);

    // Get policies generated for this framework
    const policies = await this.db
      .select()
      .from(generatedPolicies)
      .where(eq(generatedPolicies.tenantId, tenantId));

    const frameworkPolicies = policies.filter((p) =>
      (p.framework as string[]).includes(framework),
    );

    // Determine which control IDs are covered by existing policies
    const relevantTemplates = POLICY_TEMPLATES.filter((t) => t.framework.includes(framework));

    const coveredControlIds = new Set<string>();
    for (const policy of frameworkPolicies) {
      const tpl = POLICY_TEMPLATES.find((t) => t.id === policy.templateId);
      if (tpl) {
        for (const section of tpl.sections) {
          section.controls.forEach((c) => coveredControlIds.add(c));
        }
      }
    }

    const allControlIds = registry.controls.map((c) => c.controlId);
    const coveredControls = allControlIds.filter((id) => coveredControlIds.has(id));
    const uncoveredControls = allControlIds.filter((id) => !coveredControlIds.has(id));

    const score = allControlIds.length === 0
      ? 0
      : Math.round((coveredControls.length / allControlIds.length) * 100);

    // Generate actionable recommendations
    const recommendations: string[] = [];
    const missingTemplates = relevantTemplates.filter(
      (t) => !frameworkPolicies.some((p) => p.templateId === t.id),
    );

    for (const missing of missingTemplates.slice(0, 5)) {
      recommendations.push(
        `Generate a "${missing.title}" to cover ${missing.sections.flatMap((s) => s.controls).filter((c) => uncoveredControls.includes(c)).length} uncovered controls`,
      );
    }

    if (uncoveredControls.length > 0 && recommendations.length === 0) {
      recommendations.push(
        `Review existing policies to ensure they explicitly address: ${uncoveredControls.slice(0, 3).join(", ")}`,
      );
    }

    return { framework, score, coveredControls, uncoveredControls, recommendations };
  }

  // --- Industry Presets ---

  getIndustryPreset(industry: string): PolicyTemplate[] {
    const ids = INDUSTRY_PRESETS[industry];
    if (!ids) {
      throw badRequest("UNKNOWN_INDUSTRY", `Industry '${industry}' does not have a preset. Supported: ${Object.keys(INDUSTRY_PRESETS).join(", ")}`);
    }
    return ids.map((id) => this.getTemplate(id));
  }
}
