/**
 * policy-generator.ts
 * Generates 12 realistic security policy documents with gaps mapped to findings.
 */

export interface PolicyGap {
  controlId: string;
  gap: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface PolicyDocument {
  id: string;
  name: string;
  category: string;
  status: "active" | "draft" | "review";
  version: string;
  lastReviewedAt: string;
  nextReviewDue: string;
  content: string;
  approvers: string[];
  owner: string;
  appliesToFrameworks: string[];
  gaps: PolicyGap[];
}

function reviewDate(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().split("T")[0];
}

function nextReview(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().split("T")[0];
}

export function generatePolicies(): PolicyDocument[] {
  return [
    {
      id: "pol-001",
      name: "Access Control Policy",
      category: "Access Control",
      status: "active",
      version: "1.4",
      lastReviewedAt: reviewDate(3),
      nextReviewDue: nextReview(9),
      owner: "ciso@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "cto@acme-bank.com", "legal@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "hipaa", "pcidss", "nist80053"],
      content: `# Access Control Policy

## 1. Purpose
This policy establishes requirements for controlling access to ACME Bank's information systems, applications, and data. It ensures that access is granted on a need-to-know and least-privilege basis to protect the confidentiality, integrity, and availability of assets.

## 2. Scope
This policy applies to all employees, contractors, vendors, and third parties who have access to ACME Bank's systems and data, including cloud infrastructure (AWS, Azure, GCP), SaaS applications, and on-premises systems.

## 3. Access Control Principles
- **Least Privilege**: Users are granted the minimum level of access required to perform their job functions.
- **Separation of Duties**: Critical tasks are divided among multiple individuals to reduce the risk of error or fraud.
- **Need to Know**: Access is limited to information necessary for the user's role.
- **Zero Trust**: No implicit trust based on network location; all access requests are authenticated and authorized.

## 4. Authentication Requirements
4.1 All user accounts accessing production systems must be protected with Multi-Factor Authentication (MFA).
4.2 Service accounts must use rotating credentials with maximum validity of 90 days.
4.3 Privileged access (admin roles) requires hardware security keys (FIDO2 or equivalent).
4.4 Password complexity: minimum 14 characters, uppercase, lowercase, number, and special character.
4.5 Account lockout after 5 failed attempts; 30-minute lockout period.

## 5. Provisioning and De-provisioning
5.1 Access requests must be submitted via the IT Service Management system with manager approval.
5.2 Access to sensitive systems requires CISO secondary approval.
5.3 Access must be de-provisioned within 24 hours of employee termination.
5.4 Dormant accounts (>90 days inactive) are automatically disabled.

## 6. Privileged Access Management
6.1 Privileged access (root, admin) must be performed via a PAM solution (e.g., CyberArk).
6.2 All privileged sessions are logged and subject to recording.
6.3 Shared admin accounts are prohibited; all privileged actions must be attributable.
6.4 Just-In-Time (JIT) access for cloud administrator roles; elevation auto-expires after 8 hours.

## 7. Third-Party Access
7.1 Vendors require signed agreements and background checks before system access.
7.2 Third-party access is time-limited and scoped to the minimum required resources.
7.3 VPN or dedicated connectivity required for remote administrative access.

## 8. Review and Compliance
8.1 Access reviews are conducted quarterly for privileged accounts, annually for standard users.
8.2 Violations of this policy may result in access revocation and disciplinary action.
8.3 Policy reviewed annually by the Security Governance Committee.

## 9. Related Documents
- Acceptable Use Policy (pol-006)
- Change Management Policy (pol-012)
- Incident Response Policy (pol-003)`,
      gaps: [
        { controlId: "CC6.2", gap: "5 IAM users lack MFA enforcement; deny-without-MFA policy not applied.", severity: "critical" },
        { controlId: "A.8.5", gap: "Service accounts using static keys older than 90 days.", severity: "high" },
      ],
    },

    {
      id: "pol-002",
      name: "Data Protection Policy",
      category: "Data Protection",
      status: "active",
      version: "1.6",
      lastReviewedAt: reviewDate(2),
      nextReviewDue: nextReview(10),
      owner: "dpo@acme-bank.com",
      approvers: ["dpo@acme-bank.com", "ciso@acme-bank.com", "legal@acme-bank.com"],
      appliesToFrameworks: ["gdpr", "hipaa", "iso27001", "dpdpa"],
      content: `# Data Protection Policy

## 1. Purpose
ACME Bank processes significant volumes of personal and financial data. This policy defines how data is classified, handled, protected, retained, and disposed of to meet regulatory obligations and protect data subjects.

## 2. Data Classification
| Class | Examples | Protection Level |
|-------|----------|-----------------|
| Restricted | Account numbers, PII, health data | Encryption at rest + transit; strict access controls |
| Confidential | Internal financials, strategy | Encryption at rest; role-based access |
| Internal | Process documents, non-sensitive configs | Access controls |
| Public | Marketing materials | No restriction |

## 3. Data Encryption Requirements
3.1 All Restricted data must be encrypted at rest using AES-256 (or equivalent).
3.2 All data in transit must use TLS 1.2 or higher; TLS 1.0 and 1.1 are prohibited.
3.3 Customer-managed encryption keys (CMK) are required for Restricted data in cloud storage.
3.4 Encryption key rotation: every 365 days for data-at-rest keys; 90 days for transport keys.
3.5 Hardware Security Modules (HSMs) required for key storage in production environments.

## 4. Data Minimization
4.1 Data collection is limited to what is necessary for the stated business purpose.
4.2 Personal data is retained only for the minimum period required by law or business need.
4.3 Test environments must use anonymized or synthetic data — production data is prohibited.

## 5. Data Subject Rights
5.1 Requests for access, correction, or deletion are fulfilled within 30 days (GDPR: 30 days, CCPA: 45 days).
5.2 A Data Subject Request register is maintained by the DPO team.
5.3 Automated decision-making affecting data subjects requires human review capability.

## 6. Data Residency
6.1 EU personal data must not leave EU/EEA regions without SCCs or equivalent safeguards.
6.2 Indian customer data must reside in India in compliance with DPDPA 2023.
6.3 Healthcare data (ePHI) must remain in HIPAA-compliant regions.

## 7. Breach Notification
7.1 Personal data breaches are reported to the DPO within 1 hour of discovery.
7.2 Regulatory notification within 72 hours (GDPR) or applicable jurisdiction timelines.
7.3 Affected data subjects notified within 30 days where breach poses high risk.

## 8. Data Disposal
8.1 Digital media: cryptographic erasure (for encrypted media) or DoD 5220.22-M overwrite.
8.2 Physical media: NIST 800-88-compliant destruction with certificate of destruction.
8.3 Cloud storage: deletion with provider confirmation and 90-day tombstone verification.`,
      gaps: [
        { controlId: "Art.32(1)", gap: "3 S3 buckets missing server-side encryption; data at risk.", severity: "critical" },
        { controlId: "164.312(e)(1)", gap: "VPC endpoints not configured; some services communicate over public internet.", severity: "high" },
      ],
    },

    {
      id: "pol-003",
      name: "Incident Response Policy",
      category: "Incident Response",
      status: "active",
      version: "1.3",
      lastReviewedAt: reviewDate(4),
      nextReviewDue: nextReview(8),
      owner: "soc-lead@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "cto@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "hipaa", "nist80053"],
      content: `# Incident Response Policy

## 1. Purpose
This policy defines the structured approach ACME Bank takes to detect, respond to, and recover from information security incidents, minimizing damage and ensuring regulatory compliance.

## 2. Incident Classification
| Severity | Definition | Response SLA |
|----------|------------|-------------|
| P1 Critical | Active breach, data exfiltration, ransom | 15 min |
| P2 High | Compromised account, lateral movement detected | 1 hour |
| P3 Medium | Policy violation, suspicious activity | 4 hours |
| P4 Low | Anomaly, false positive investigation | 24 hours |

## 3. Response Team (CSIRT)
- **Incident Commander**: CISO or delegate
- **Technical Lead**: Senior Security Engineer
- **Communications Lead**: VP Communications
- **Legal Counsel**: Legal team representative
- **Cloud SME**: Cloud Security Architect per affected platform

## 4. Incident Response Phases
4.1 **Preparation**: Runbooks maintained, CSIRT trained quarterly, tabletop exercises bi-annually.
4.2 **Identification**: 24/7 SOC monitoring; automated detection via SIEM and cloud-native services.
4.3 **Containment**: Isolate affected resources, revoke compromised credentials, block IOCs.
4.4 **Eradication**: Remove malware, patch vulnerabilities, rotate all potentially exposed credentials.
4.5 **Recovery**: Restore from clean backups, validate integrity, return to normal operations.
4.6 **Post-Incident Review**: RCA within 5 business days, lessons learned documented.

## 5. Evidence Preservation
5.1 Cloud audit logs preserved to immutable storage upon incident declaration.
5.2 Forensic images taken before instance termination for P1/P2 incidents.
5.3 Chain of custody maintained for all digital evidence.

## 6. Communication
6.1 Executive notification within 30 minutes of P1/P2 declaration.
6.2 Regulatory notification per Data Protection Policy (pol-002).
6.3 Customer communication coordinated by Communications Lead with Legal approval.
6.4 All external communications require CISO and Legal sign-off.

## 7. Tools and Resources
- SIEM: Splunk Enterprise
- EDR: CrowdStrike Falcon
- Cloud CSPM: Blackfyre
- Playbook Repository: Confluence (restricted)
- War Room: Slack #incident-war-room (auto-created on P1/P2)`,
      gaps: [
        { controlId: "CC7.2", gap: "CloudTrail not enabled in all regions; gaps in audit trail coverage.", severity: "high" },
      ],
    },

    {
      id: "pol-004",
      name: "Business Continuity Policy",
      category: "Business Continuity",
      status: "active",
      version: "1.2",
      lastReviewedAt: reviewDate(6),
      nextReviewDue: nextReview(6),
      owner: "cto@acme-bank.com",
      approvers: ["cto@acme-bank.com", "ciso@acme-bank.com", "cfo@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "nist80053"],
      content: `# Business Continuity Policy

## 1. Purpose
This policy establishes requirements for maintaining business operations during and after disruptive events, including cyber incidents, natural disasters, and infrastructure failures.

## 2. Recovery Objectives
| System Tier | RTO | RPO | Description |
|-------------|-----|-----|-------------|
| Tier 1 Critical | 4 hours | 15 minutes | Core banking, payment processing |
| Tier 2 Important | 8 hours | 1 hour | Customer portal, reporting |
| Tier 3 Standard | 24 hours | 4 hours | Internal tools, analytics |
| Tier 4 Deferrable | 72 hours | 24 hours | Archive systems, batch jobs |

## 3. Backup Requirements
3.1 Tier 1 systems: continuous replication to a secondary region.
3.2 All production databases: daily automated snapshots with 30-day retention.
3.3 Application state: snapshots before all significant deployments.
3.4 Backup integrity: monthly restore tests; results logged and reviewed by CTO.

## 4. Disaster Recovery
4.1 DR environment maintained in a geographically separate AWS region (primary: us-east-1, DR: eu-west-1).
4.2 Multi-cloud DR for Tier 1 systems: failover capability to Azure.
4.3 Annual DR drills with full failover; participation mandatory for all on-call engineers.
4.4 Runbooks reviewed and updated after each drill.

## 5. Infrastructure Resilience
5.1 All Tier 1 workloads deployed across minimum 3 Availability Zones.
5.2 Load balancers and auto-scaling configured for automatic capacity adjustments.
5.3 Cloud provider health dashboards monitored; alerts for zone/region degradation.

## 6. Supply Chain Continuity
6.1 Critical vendor SLAs reviewed annually; contingency plans for top-5 vendors.
6.2 Dependency on single-vendor cloud services flagged and mitigated where feasible.`,
      gaps: [
        { controlId: "A1.2", gap: "RDS backup retention set to 7 days in some instances; below 30-day policy requirement.", severity: "medium" },
      ],
    },

    {
      id: "pol-005",
      name: "Vendor Management Policy",
      category: "Vendor Management",
      status: "active",
      version: "1.1",
      lastReviewedAt: reviewDate(8),
      nextReviewDue: nextReview(4),
      owner: "procurement@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "legal@acme-bank.com", "cfo@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "gdpr"],
      content: `# Vendor Management Policy

## 1. Purpose
To ensure third-party vendors and service providers meet ACME Bank's security, privacy, and compliance requirements before, during, and after engagement.

## 2. Vendor Risk Tiers
| Tier | Access Level | Due Diligence |
|------|-------------|---------------|
| Critical | Access to production systems or sensitive data | Full security assessment + annual review |
| High | Access to internal systems, no production data | Questionnaire + SOC2 review |
| Medium | Limited access, non-sensitive data | Questionnaire only |
| Low | No system access | Standard contract terms |

## 3. Pre-Engagement Requirements
3.1 Security questionnaire (based on SIG Lite) completed before contract.
3.2 SOC 2 Type II or ISO 27001 certification required for Critical vendors.
3.3 Data Processing Agreements (DPA) required for any vendor processing personal data.
3.4 Legal review of contract security clauses for Critical/High tier vendors.

## 4. Ongoing Monitoring
4.1 Annual security reviews for Critical vendors; bi-annual for High tier.
4.2 Continuous monitoring of vendor security ratings (BitSight or equivalent).
4.3 Vendor incidents reported to ACME Bank CISO within 24 hours.

## 5. Offboarding
5.1 Access revoked within 24 hours of contract termination.
5.2 Data deletion confirmation required within 30 days of offboarding.
5.3 Exit interview with vendor security contact for Critical vendors.`,
      gaps: [],
    },

    {
      id: "pol-006",
      name: "Acceptable Use Policy",
      category: "Acceptable Use",
      status: "active",
      version: "2.0",
      lastReviewedAt: reviewDate(1),
      nextReviewDue: nextReview(11),
      owner: "hr@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "hr@acme-bank.com", "legal@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001"],
      content: `# Acceptable Use Policy

## 1. Purpose
This policy defines acceptable and prohibited uses of ACME Bank's information systems, network, devices, and data by employees, contractors, and other authorized users.

## 2. Acceptable Uses
2.1 Business activities directly related to job responsibilities.
2.2 Incidental personal use that does not interfere with business operations or consume significant resources.
2.3 Professional development activities approved by management.
2.4 Use of approved collaboration tools (Slack, Microsoft 365, Zoom).

## 3. Prohibited Uses
3.1 Accessing, downloading, or transmitting illegal content.
3.2 Installing unauthorized software on company devices.
3.3 Circumventing security controls (VPN bypass, firewall rule modifications).
3.4 Mining cryptocurrency using company resources.
3.5 Sharing credentials with colleagues, contractors, or third parties.
3.6 Accessing competitor systems or engaging in competitive intelligence gathering via unauthorized means.
3.7 Processing personal data outside approved systems.
3.8 Using personal cloud storage (Dropbox, Google Drive personal) for company data.

## 4. Monitoring
4.1 ACME Bank monitors network traffic, system logs, and device activity for security purposes.
4.2 Monitoring is conducted in compliance with applicable privacy laws.
4.3 Users have no expectation of privacy on company devices or networks.

## 5. Enforcement
5.1 Violations are investigated by HR, Legal, and Security jointly.
5.2 Consequences range from written warning to termination and legal action.
5.3 Critical violations (e.g., intentional data exfiltration) are reported to law enforcement.`,
      gaps: [],
    },

    {
      id: "pol-007",
      name: "Encryption Standards",
      category: "Encryption Standards",
      status: "active",
      version: "1.5",
      lastReviewedAt: reviewDate(3),
      nextReviewDue: nextReview(9),
      owner: "cloud-sec-team@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "cto@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "hipaa", "pcidss", "nist80053"],
      content: `# Encryption Standards Policy

## 1. Purpose
To define approved cryptographic algorithms, key management practices, and implementation standards for protecting ACME Bank's data at rest and in transit.

## 2. Approved Algorithms
| Use Case | Approved Algorithms | Key Lengths | Notes |
|----------|--------------------|----|-------|
| Symmetric encryption | AES-256-GCM | 256-bit | FIPS 140-2 compliant |
| Asymmetric encryption | RSA, ECDSA | RSA 2048+ / ECDSA P-256+ | RSA 4096 preferred |
| Key derivation | PBKDF2, bcrypt, Argon2id | Per algorithm specs | Argon2id preferred for passwords |
| Hashing | SHA-256, SHA-3-256 | N/A | MD5 and SHA-1 prohibited |
| TLS | TLS 1.2, TLS 1.3 | N/A | TLS 1.0/1.1 prohibited |
| Certificate | X.509 v3 | RSA 2048+ | EV certificates for customer-facing |

## 3. Key Management
3.1 All encryption keys stored in hardware security modules (HSMs) or cloud KMS services (AWS KMS, Azure Key Vault, GCP KMS).
3.2 Key rotation schedule:
  - Data encryption keys: 365 days
  - Key encryption keys (KEK): 730 days
  - TLS certificates: 398 days (max)
  - API keys: 90 days
3.3 Key ceremonies for root CA keys: minimum 2 authorized personnel, recorded.
3.4 Key backup: encrypted off-site backup with split custody.
3.5 Key compromise response: immediate rotation within 4 hours, affected systems re-encrypted.

## 4. Prohibited Practices
4.1 DES, 3DES, RC4, MD5, SHA-1, SSL 3.0/TLS 1.0/1.1 are prohibited.
4.2 Self-signed certificates in production environments are prohibited.
4.3 Hardcoded encryption keys in source code are prohibited.
4.4 Symmetric keys transmitted without asymmetric envelope encryption are prohibited.

## 5. Cloud Storage Encryption
5.1 AWS S3: SSE-KMS with CMK required for Restricted data; SSE-S3 minimum for other data.
5.2 Azure Storage: CMK via Azure Key Vault for Restricted data.
5.3 GCP Storage: CMEK via Cloud KMS for Restricted data.
5.4 Database: Encryption at rest mandatory for all production databases regardless of sensitivity.`,
      gaps: [
        { controlId: "A.8.24", gap: "6 storage resources lack encryption at rest; SSE not configured.", severity: "critical" },
        { controlId: "CC6.7", gap: "Some internal services using TLS 1.1; must be upgraded to TLS 1.2+.", severity: "high" },
      ],
    },

    {
      id: "pol-008",
      name: "Logging and Monitoring Policy",
      category: "Logging and Monitoring",
      status: "review",
      version: "1.3",
      lastReviewedAt: reviewDate(12),
      nextReviewDue: nextReview(0),
      owner: "cloud-sec-team@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "cto@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "hipaa", "pcidss", "nist80053"],
      content: `# Logging and Monitoring Policy

## 1. Purpose
This policy ensures comprehensive audit logging and continuous monitoring across ACME Bank's infrastructure to enable incident detection, forensic investigation, and compliance reporting.

## 2. Logging Requirements
2.1 **Authentication events**: All login attempts (success and failure), MFA events, privilege escalations.
2.2 **Authorization events**: Access to Restricted data, admin actions, policy changes.
2.3 **System events**: Configuration changes, software deployments, key rotations.
2.4 **Network events**: Firewall rule changes, VPN connections, unusual traffic patterns.
2.5 **Application events**: API calls to sensitive endpoints, data export operations.

## 3. Log Retention
| Log Type | Retention Period | Storage |
|----------|-----------------|---------|
| Security audit logs | 7 years | Immutable S3/Azure WORM |
| Access logs | 3 years | Encrypted S3 |
| Application logs | 1 year | Log aggregation platform |
| Network flow logs | 1 year | Cloud-native log storage |
| Debug/trace logs | 30 days | Ephemeral storage |

## 4. Cloud-Specific Requirements
4.1 **AWS**: CloudTrail (all regions, multi-region), VPC Flow Logs, GuardDuty, Config.
4.2 **Azure**: Azure Monitor, Diagnostic Settings on all resources, Microsoft Defender.
4.3 **GCP**: Cloud Audit Logs (Admin Activity + Data Access), VPC Flow Logs, SCC.

## 5. SIEM Integration
5.1 All cloud logs forwarded to centralized SIEM (Splunk) in real time.
5.2 Critical security events trigger automated alerts within 60 seconds.
5.3 Alert fatigue management: tuning reviews quarterly; false positive rate target <5%.

## 6. Log Integrity
6.1 Log file validation enabled for CloudTrail.
6.2 Log storage buckets protected with Object Lock (WORM).
6.3 Log forwarding pipelines monitored; gaps detected within 15 minutes.`,
      gaps: [
        { controlId: "CC7.1", gap: "CloudTrail logging disabled in us-west-2 and ap-southeast-1 regions.", severity: "critical" },
        { controlId: "A.8.15", gap: "5 S3 buckets missing access logging configuration.", severity: "medium" },
      ],
    },

    {
      id: "pol-009",
      name: "Network Security Policy",
      category: "Network Security",
      status: "active",
      version: "1.4",
      lastReviewedAt: reviewDate(5),
      nextReviewDue: nextReview(7),
      owner: "cloud-sec-team@acme-bank.com",
      approvers: ["ciso@acme-bank.com", "cto@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "pcidss", "nist80053"],
      content: `# Network Security Policy

## 1. Purpose
To define security controls for ACME Bank's network infrastructure, preventing unauthorized access and data exfiltration through network-layer controls.

## 2. Network Segmentation
2.1 Production, staging, and development environments must be in separate VPCs/VNets.
2.2 Payment systems (PCI-DSS scope) in dedicated network segments with enhanced controls.
2.3 No direct connectivity between production and development environments.
2.4 All cross-environment communication via explicitly defined firewall rules.

## 3. Firewall and Security Group Rules
3.1 Default-deny posture: all inbound traffic blocked unless explicitly permitted.
3.2 Inbound SSH (22) and RDP (3389) from 0.0.0.0/0 or ::/0 are prohibited.
3.3 Security group rules reviewed quarterly; unused rules removed.
3.4 All changes to firewall rules require Change Management approval.

## 4. Traffic Encryption
4.1 All inter-service communication within cloud VPCs must use mTLS or service mesh encryption.
4.2 All external-facing APIs must terminate TLS 1.2+ at the load balancer.
4.3 No HTTP (plaintext) endpoints exposed publicly; automatic redirect to HTTPS.

## 5. DDoS Protection
5.1 AWS Shield Standard on all public endpoints; Shield Advanced for critical services.
5.2 CloudFront with WAF in front of all public-facing web applications.
5.3 DDoS response runbook maintained and tested annually.

## 6. Network Monitoring
6.1 VPC Flow Logs enabled for all VPCs; forwarded to SIEM.
6.2 Network Anomaly Detection via GuardDuty/Defender for Cloud.
6.3 Lateral movement indicators monitored; alerts for East-West traffic anomalies.`,
      gaps: [
        { controlId: "CC6.6", gap: "7 security groups allow SSH/RDP inbound from 0.0.0.0/0.", severity: "critical" },
      ],
    },

    {
      id: "pol-010",
      name: "AI/ML Governance Policy",
      category: "AI/ML Governance",
      status: "draft",
      version: "1.0",
      lastReviewedAt: reviewDate(1),
      nextReviewDue: nextReview(2),
      owner: "cto@acme-bank.com",
      approvers: ["cto@acme-bank.com", "ciso@acme-bank.com", "legal@acme-bank.com", "dpo@acme-bank.com"],
      appliesToFrameworks: ["gdpr", "iso27001"],
      content: `# AI/ML Governance Policy

## 1. Purpose
This policy establishes governance standards for the development, deployment, and operation of AI and machine learning systems at ACME Bank, ensuring ethical use, explainability, and regulatory compliance.

## 2. Scope
Applies to all AI/ML systems used in credit scoring, fraud detection, customer service automation, internal analytics, and any AI-assisted decision-making affecting customers or employees.

## 3. AI Risk Classification
| Class | Description | Examples | Oversight |
|-------|-------------|---------|-----------|
| High Risk | Affects individual rights or significant financial decisions | Credit scoring, fraud detection | Full audit, explainability, human review |
| Medium Risk | Operational decisions, internal tools | Resource optimization, code review assistants | Regular auditing |
| Low Risk | Advisory or informational | Market trend analysis, reporting | Periodic review |

## 4. Fairness and Bias
4.1 High-risk models require fairness assessments before deployment (disparate impact analysis).
4.2 Protected characteristics (gender, race, age, religion) must not be direct model inputs.
4.3 Proxy features (zip code, education) reviewed for potential discriminatory impact.
4.4 Annual bias audits by independent teams for customer-facing models.

## 5. Explainability
5.1 High-risk decisions must provide human-interpretable explanations to affected individuals.
5.2 Model documentation (model cards) required for all High/Medium risk models.
5.3 Feature importance and SHAP values maintained for regulatory inspection.

## 6. Data Governance for AI
6.1 Training data must be sourced and processed in compliance with Data Protection Policy (pol-002).
6.2 Customer data used for model training requires explicit consent or legitimate interest assessment.
6.3 Synthetic data preferred for model testing and validation.

## 7. Model Security
7.1 Models protected from adversarial attacks (input validation, anomaly detection on inputs).
7.2 Model serving endpoints rate-limited and authenticated.
7.3 Model weights and training data classified as Confidential.`,
      gaps: [],
    },

    {
      id: "pol-011",
      name: "Privacy Policy (Internal)",
      category: "Privacy",
      status: "active",
      version: "1.7",
      lastReviewedAt: reviewDate(2),
      nextReviewDue: nextReview(10),
      owner: "dpo@acme-bank.com",
      approvers: ["dpo@acme-bank.com", "legal@acme-bank.com", "ciso@acme-bank.com"],
      appliesToFrameworks: ["gdpr", "hipaa", "dpdpa"],
      content: `# Privacy Policy (Internal Operations)

## 1. Purpose
This internal policy governs how ACME Bank collects, processes, stores, and protects personal data in compliance with GDPR, DPDPA 2023, HIPAA (where applicable), and other applicable privacy laws.

## 2. Lawful Basis for Processing
2.1 Customer data processed under contractual necessity (account services) and legitimate interest.
2.2 Marketing communications: explicit opt-in consent required; documented consent records maintained.
2.3 Employee data: contractual necessity and legal obligation.
2.4 Special categories of data (health, biometric): explicit consent required; processing limited to defined purposes.

## 3. Privacy by Design
3.1 Privacy impact assessments (PIA) required for new products/features processing personal data.
3.2 Data minimization enforced at collection point; forms and APIs reviewed for excess data fields.
3.3 Anonymization/pseudonymization applied before data is used for analytics.

## 4. Cross-Border Transfers
4.1 EU to non-EEA: Standard Contractual Clauses (SCCs) with transfer impact assessments.
4.2 India DPDPA: Customer data from India processed within India; cross-border only with DPAI approval.
4.3 Transfer register maintained by DPO with quarterly review.

## 5. Data Subject Rights (DSR)
| Right | GDPR Deadline | DPDPA Deadline |
|-------|--------------|----------------|
| Access | 30 days | 30 days |
| Correction | 30 days | 30 days |
| Erasure | 30 days | 30 days |
| Portability | 30 days | N/A |
| Objection | Immediate | 30 days |

5.1 DSR portal available to customers; response tracked in DPO management system.
5.2 Identity verification required before fulfilling DSR.

## 6. Children's Data
6.1 ACME Bank does not knowingly collect data from individuals under 18.
6.2 Age verification implemented at account creation.`,
      gaps: [
        { controlId: "Art.32(1)", gap: "Some data processing pipelines lack pseudonymization; raw PII in analytical logs.", severity: "medium" },
      ],
    },

    {
      id: "pol-012",
      name: "Change Management Policy",
      category: "Change Management",
      status: "active",
      version: "1.3",
      lastReviewedAt: reviewDate(4),
      nextReviewDue: nextReview(8),
      owner: "cto@acme-bank.com",
      approvers: ["cto@acme-bank.com", "ciso@acme-bank.com"],
      appliesToFrameworks: ["soc2", "iso27001", "nist80053"],
      content: `# Change Management Policy

## 1. Purpose
To ensure that changes to production systems are authorized, tested, and documented to maintain security, stability, and compliance.

## 2. Change Categories
| Type | Definition | Approval | Lead Time |
|------|-----------|---------|-----------|
| Emergency | Fixes critical production outage | Post-hoc + CISO | Immediate |
| Standard | Pre-approved routine changes | Template-based | Same-day |
| Normal | Non-emergency business changes | CAB approval | 5 business days |
| Major | Significant infrastructure/architecture | CAB + CISO + CTO | 10 business days |

## 3. Change Advisory Board (CAB)
3.1 CAB meets weekly; emergency CAB convened within 2 hours when needed.
3.2 CAB members: CTO, CISO, VP Engineering, Cloud Architect, QA Lead.
3.3 CAB minutes and decisions recorded and retained for 3 years.

## 4. Change Request Requirements
4.1 Change description and business justification.
4.2 Risk assessment (security, availability, compliance impact).
4.3 Rollback plan with tested procedures.
4.4 Test results from staging environment.
4.5 Communication plan for user-impacting changes.

## 5. Security Review
5.1 Changes touching security controls, IAM, encryption, or network require CISO review.
5.2 Infrastructure-as-code (Terraform, Helm) changes reviewed via automated security scanning (Checkov, tfsec).
5.3 Container images scanned for vulnerabilities before deployment.

## 6. Post-Change Review
6.1 Emergency changes reviewed within 48 hours; documentation backdated.
6.2 Failed or rolled-back changes: root cause analysis within 5 business days.
6.3 Change success metrics reviewed monthly by CTO.`,
      gaps: [
        { controlId: "CC8.1", gap: "No automated enforcement of change approval in CI/CD pipeline; manual process only.", severity: "medium" },
      ],
    },
  ];
}
