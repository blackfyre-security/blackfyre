import { eq, and, desc, sql } from "drizzle-orm";
import { learningPatterns } from "../../db/schema.js";
import type { Db } from "../../db/connection.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ControlDetail {
  id: string;
  title: string;
  framework: string;
  domain: string;
  description: string;
  evidenceRequirements: string[];
  commonFindings: string[];
  remediationPatterns: string[];
  severityWeight: number;
  industryInterpretations: Record<string, string>;
}

export interface KnowledgeQueryResult {
  controls: ControlDetail[];
  reasoning: string;
  confidence: number;
}

/* ------------------------------------------------------------------ */
/*  Static Knowledge — Framework Control Definitions                   */
/* ------------------------------------------------------------------ */

const FRAMEWORK_CONTROLS: Record<string, ControlDetail[]> = {
  soc2: [
    { id: "CC1.1", title: "COSO Principle 1: Integrity and Ethics", framework: "soc2", domain: "Control Environment", description: "Organization demonstrates commitment to integrity and ethical values", evidenceRequirements: ["Code of conduct policy", "Ethics training records", "Whistleblower program documentation"], commonFindings: ["No documented code of conduct", "Missing annual ethics training"], remediationPatterns: ["Establish code of conduct", "Implement annual training program"], severityWeight: 3, industryInterpretations: { fintech: "Must include financial ethics and regulatory compliance", healthtech: "Must cover patient data ethics" } },
    { id: "CC6.1", title: "Logical and Physical Access Controls", framework: "soc2", domain: "Logical and Physical Access", description: "Restrict logical access to information assets", evidenceRequirements: ["IAM policies", "Access review records", "MFA configuration", "Role-based access matrix"], commonFindings: ["Over-privileged IAM roles", "Missing MFA on admin accounts", "Stale access keys"], remediationPatterns: ["Implement least-privilege IAM", "Enforce MFA for all admin accounts", "Rotate access keys every 90 days"], severityWeight: 9, industryInterpretations: { fintech: "PCI-DSS alignment required for payment systems", government: "NIST 800-53 AC controls must be cross-referenced" } },
    { id: "CC6.2", title: "System Access Controls", framework: "soc2", domain: "Logical and Physical Access", description: "Prior to issuing system credentials, verify identity of users", evidenceRequirements: ["User provisioning process", "Identity verification procedures", "Onboarding checklists"], commonFindings: ["No identity verification for provisioning", "Shared credentials"], remediationPatterns: ["Implement identity verification workflow", "Eliminate shared accounts"], severityWeight: 8, industryInterpretations: {} },
    { id: "CC6.3", title: "Role-Based Access", framework: "soc2", domain: "Logical and Physical Access", description: "Access based on authorization by role", evidenceRequirements: ["RBAC matrix", "Role definitions", "Access review logs"], commonFindings: ["No formal RBAC model", "Missing periodic reviews"], remediationPatterns: ["Define RBAC model", "Quarterly access reviews"], severityWeight: 7, industryInterpretations: {} },
    { id: "CC7.1", title: "Detect and Monitor Security Events", framework: "soc2", domain: "System Operations", description: "Monitor system components for anomalies", evidenceRequirements: ["SIEM configuration", "Alert rules", "Monitoring dashboard screenshots"], commonFindings: ["No centralized logging", "Missing alerting for critical events"], remediationPatterns: ["Deploy SIEM solution", "Configure alerting thresholds"], severityWeight: 8, industryInterpretations: { fintech: "Real-time transaction monitoring required" } },
    { id: "CC7.2", title: "Monitor System Components", framework: "soc2", domain: "System Operations", description: "Monitor infrastructure for configuration changes", evidenceRequirements: ["CloudTrail logs", "Config change tracking", "Drift detection reports"], commonFindings: ["CloudTrail not enabled in all regions", "No drift detection"], remediationPatterns: ["Enable multi-region CloudTrail", "Implement drift monitoring"], severityWeight: 7, industryInterpretations: {} },
    { id: "CC8.1", title: "Change Management", framework: "soc2", domain: "Change Management", description: "Authorize, design, develop, configure, document, test, approve, and implement changes", evidenceRequirements: ["Change management policy", "Change tickets", "Approval workflows", "CI/CD pipeline logs"], commonFindings: ["Changes without approval", "Missing test evidence"], remediationPatterns: ["Implement change advisory board", "Require PR reviews"], severityWeight: 6, industryInterpretations: {} },
  ],
  iso27001: [
    { id: "A.9.1", title: "Business Requirements of Access Control", framework: "iso27001", domain: "Access Control", description: "Limit access to information and information processing facilities", evidenceRequirements: ["Access control policy", "Network access controls", "Operating system access controls"], commonFindings: ["No formal access control policy", "Unrestricted network access"], remediationPatterns: ["Draft access control policy", "Implement network segmentation"], severityWeight: 8, industryInterpretations: {} },
    { id: "A.9.2", title: "User Access Management", framework: "iso27001", domain: "Access Control", description: "Ensure authorized user access and prevent unauthorized access", evidenceRequirements: ["User registration process", "Privilege management", "User access reviews"], commonFindings: ["No formal provisioning process", "Missing access reviews"], remediationPatterns: ["Implement formal provisioning", "Quarterly access reviews"], severityWeight: 8, industryInterpretations: {} },
    { id: "A.10.1", title: "Cryptographic Controls", framework: "iso27001", domain: "Cryptography", description: "Ensure proper and effective use of cryptography", evidenceRequirements: ["Encryption policy", "Key management procedures", "Encryption-at-rest evidence", "TLS configuration"], commonFindings: ["Unencrypted storage", "Weak TLS versions", "No key rotation"], remediationPatterns: ["Enable encryption at rest", "Enforce TLS 1.2+", "Implement key rotation"], severityWeight: 9, industryInterpretations: { healthtech: "HIPAA encryption requirements apply" } },
    { id: "A.12.4", title: "Logging and Monitoring", framework: "iso27001", domain: "Operations Security", description: "Record events and generate evidence", evidenceRequirements: ["Audit log configuration", "Log retention policy", "Monitoring alerts"], commonFindings: ["Insufficient logging", "No log retention policy"], remediationPatterns: ["Enable comprehensive logging", "Define retention periods"], severityWeight: 7, industryInterpretations: {} },
    { id: "A.18.1", title: "Compliance with Legal Requirements", framework: "iso27001", domain: "Compliance", description: "Avoid breaches of legal, statutory, regulatory or contractual obligations", evidenceRequirements: ["Regulatory register", "Privacy impact assessments", "Data processing agreements"], commonFindings: ["No regulatory tracking", "Missing DPAs"], remediationPatterns: ["Maintain regulatory register", "Execute DPAs with processors"], severityWeight: 7, industryInterpretations: { fintech: "RBI/SEBI regulations must be tracked" } },
  ],
  hipaa: [
    { id: "164.312(a)", title: "Access Control", framework: "hipaa", domain: "Technical Safeguards", description: "Implement technical policies to restrict access to ePHI", evidenceRequirements: ["Unique user identification", "Emergency access procedure", "Automatic logoff", "Encryption and decryption"], commonFindings: ["Shared accounts accessing ePHI", "No automatic session timeout", "Unencrypted ePHI at rest"], remediationPatterns: ["Implement unique user IDs", "Configure session timeouts", "Encrypt all ePHI"], severityWeight: 10, industryInterpretations: {} },
    { id: "164.312(b)", title: "Audit Controls", framework: "hipaa", domain: "Technical Safeguards", description: "Implement hardware, software, and procedural mechanisms for audit trails", evidenceRequirements: ["Audit log configuration", "Log review process", "Retention evidence"], commonFindings: ["No audit logging for ePHI access", "Missing log reviews"], remediationPatterns: ["Enable ePHI access logging", "Implement weekly log reviews"], severityWeight: 9, industryInterpretations: {} },
    { id: "164.312(c)", title: "Integrity Controls", framework: "hipaa", domain: "Technical Safeguards", description: "Protect ePHI from improper alteration or destruction", evidenceRequirements: ["Integrity verification mechanism", "Data validation controls"], commonFindings: ["No integrity verification for ePHI", "Missing checksums"], remediationPatterns: ["Implement data integrity checks", "Add checksum verification"], severityWeight: 8, industryInterpretations: {} },
    { id: "164.312(e)", title: "Transmission Security", framework: "hipaa", domain: "Technical Safeguards", description: "Guard against unauthorized access to ePHI during transmission", evidenceRequirements: ["TLS configuration", "VPN policies", "Encryption evidence"], commonFindings: ["ePHI transmitted over HTTP", "Weak TLS versions"], remediationPatterns: ["Enforce HTTPS for all ePHI", "Upgrade to TLS 1.2+"], severityWeight: 10, industryInterpretations: {} },
  ],
  gdpr: [
    { id: "Art.25", title: "Data Protection by Design and Default", framework: "gdpr", domain: "Controller Obligations", description: "Implement appropriate technical and organisational measures", evidenceRequirements: ["Privacy by design documentation", "Default settings review", "DPIA records"], commonFindings: ["No privacy by design process", "Data collected beyond purpose"], remediationPatterns: ["Implement privacy by design review", "Audit data collection scope"], severityWeight: 8, industryInterpretations: {} },
    { id: "Art.32", title: "Security of Processing", framework: "gdpr", domain: "Security", description: "Implement appropriate technical and organisational measures to ensure security", evidenceRequirements: ["Encryption evidence", "Pseudonymisation", "Resilience testing", "Backup procedures"], commonFindings: ["Unencrypted personal data", "No resilience testing"], remediationPatterns: ["Encrypt all personal data", "Implement disaster recovery testing"], severityWeight: 9, industryInterpretations: {} },
    { id: "Art.33", title: "Notification of Personal Data Breach", framework: "gdpr", domain: "Breach Notification", description: "Notify supervisory authority within 72 hours of breach", evidenceRequirements: ["Breach notification procedure", "Incident response plan", "Communication templates"], commonFindings: ["No breach notification procedure", "Missing incident response plan"], remediationPatterns: ["Draft breach notification procedure", "Test incident response"], severityWeight: 9, industryInterpretations: {} },
  ],
  pcidss: [
    { id: "Req.1", title: "Install and Maintain Network Security Controls", framework: "pcidss", domain: "Network Security", description: "Install and maintain network security controls", evidenceRequirements: ["Firewall rules", "Network diagrams", "Security group configurations"], commonFindings: ["Overly permissive firewall rules", "Missing network segmentation"], remediationPatterns: ["Restrict firewall rules", "Implement network segmentation"], severityWeight: 9, industryInterpretations: {} },
    { id: "Req.3", title: "Protect Stored Account Data", framework: "pcidss", domain: "Data Protection", description: "Protect stored account data using encryption", evidenceRequirements: ["Encryption configuration", "Key management", "Data retention policy"], commonFindings: ["Unencrypted cardholder data", "Missing key rotation"], remediationPatterns: ["Encrypt all stored card data", "Implement key rotation"], severityWeight: 10, industryInterpretations: {} },
    { id: "Req.8", title: "Identify Users and Authenticate Access", framework: "pcidss", domain: "Access Control", description: "Identify users and authenticate access to system components", evidenceRequirements: ["MFA configuration", "Password policies", "User ID assignments"], commonFindings: ["Missing MFA for admin access", "Weak password policy"], remediationPatterns: ["Enforce MFA", "Strengthen password requirements"], severityWeight: 9, industryInterpretations: {} },
  ],
  nist80053: [
    { id: "AC-1", title: "Access Control Policy and Procedures", framework: "nist80053", domain: "Access Control", description: "Develop, document, and disseminate access control policy", evidenceRequirements: ["Access control policy", "Procedures documentation", "Review records"], commonFindings: ["No formal access control policy", "Policy not reviewed annually"], remediationPatterns: ["Draft AC policy per NIST template", "Schedule annual review"], severityWeight: 7, industryInterpretations: { government: "FedRAMP baseline requires this at all impact levels" } },
    { id: "AC-2", title: "Account Management", framework: "nist80053", domain: "Access Control", description: "Manage information system accounts", evidenceRequirements: ["Account management procedures", "Provisioning/deprovisioning evidence", "Access reviews"], commonFindings: ["No formal account management", "Stale accounts"], remediationPatterns: ["Implement account lifecycle management", "90-day inactive account review"], severityWeight: 8, industryInterpretations: {} },
    { id: "AU-2", title: "Audit Events", framework: "nist80053", domain: "Audit and Accountability", description: "Determine auditable events", evidenceRequirements: ["Auditable events list", "Audit configuration", "Log examples"], commonFindings: ["Incomplete auditable events definition", "Missing critical event logging"], remediationPatterns: ["Define comprehensive audit events list", "Enable all required logging"], severityWeight: 7, industryInterpretations: {} },
  ],
  dpdpa: [
    { id: "DPDPA-S4", title: "Grounds for Processing Personal Data", framework: "dpdpa", domain: "Data Processing", description: "Process personal data only for lawful purposes with consent", evidenceRequirements: ["Consent mechanism", "Purpose limitation documentation", "Lawful basis records"], commonFindings: ["No consent management", "Purpose not documented"], remediationPatterns: ["Implement consent management", "Document processing purposes"], severityWeight: 8, industryInterpretations: {} },
    { id: "DPDPA-S8", title: "Data Fiduciary Obligations", framework: "dpdpa", domain: "Fiduciary Duties", description: "Data fiduciary shall protect personal data", evidenceRequirements: ["Security safeguards", "Breach notification mechanism", "Grievance redressal"], commonFindings: ["Insufficient security safeguards", "No breach notification process for India"], remediationPatterns: ["Implement CERT-In compliant breach notification", "Establish grievance officer"], severityWeight: 9, industryInterpretations: {} },
  ],
  iso42001: [
    { id: "4.1", title: "Understanding the Organization", framework: "iso42001", domain: "Context", description: "Determine internal and external issues relevant to AI management", evidenceRequirements: ["AI system inventory", "Stakeholder impact assessment", "Regulatory landscape analysis"], commonFindings: ["No AI system inventory", "Missing stakeholder analysis"], remediationPatterns: ["Create AI system register", "Conduct stakeholder impact assessment"], severityWeight: 7, industryInterpretations: { aitech: "Must include all ML models and training pipelines" } },
    { id: "6.1", title: "Actions to Address Risks", framework: "iso42001", domain: "Planning", description: "Determine risks and opportunities for AI management system", evidenceRequirements: ["AI risk register", "Risk treatment plans", "Residual risk acceptance"], commonFindings: ["No AI-specific risk register", "Missing bias risk assessment"], remediationPatterns: ["Create AI risk register", "Implement bias monitoring"], severityWeight: 8, industryInterpretations: {} },
    { id: "8.4", title: "AI System Impact Assessment", framework: "iso42001", domain: "Operation", description: "Assess impact of AI systems on individuals and society", evidenceRequirements: ["Impact assessment reports", "Fairness metrics", "Safety evaluations"], commonFindings: ["No impact assessment conducted", "Missing fairness metrics"], remediationPatterns: ["Conduct AIIA for each AI system", "Implement fairness monitoring"], severityWeight: 9, industryInterpretations: {} },
  ],
  pdppl: [
    { id: "PDPPL-CH3", title: "Personal Data Processing", framework: "pdppl", domain: "Processing", description: "Fair and reasonable processing of personal data", evidenceRequirements: ["Processing register", "Purpose documentation", "Consent records"], commonFindings: ["No processing register", "Missing consent mechanism"], remediationPatterns: ["Maintain processing register", "Implement consent framework"], severityWeight: 8, industryInterpretations: {} },
  ],
};

/* ------------------------------------------------------------------ */
/*  Knowledge Base Service                                             */
/* ------------------------------------------------------------------ */

export class KnowledgeBaseService {
  constructor(private db: Db) {}

  /**
   * Query the knowledge base for controls matching a question/context.
   */
  async query(
    question: string,
    frameworks: string[],
    context?: string,
  ): Promise<KnowledgeQueryResult> {
    const keywords = question.toLowerCase().split(/\s+/);
    const matchedControls: ControlDetail[] = [];

    for (const fw of frameworks) {
      const controls = FRAMEWORK_CONTROLS[fw] ?? [];
      for (const control of controls) {
        const searchText = `${control.title} ${control.description} ${control.domain} ${control.commonFindings.join(" ")}`.toLowerCase();
        const matchScore = keywords.filter((k) => searchText.includes(k)).length;
        if (matchScore > 0) {
          matchedControls.push(control);
        }
      }
    }

    // Sort by relevance (severity weight as proxy)
    matchedControls.sort((a, b) => b.severityWeight - a.severityWeight);

    return {
      controls: matchedControls.slice(0, 20),
      reasoning: `Matched ${matchedControls.length} controls across ${frameworks.length} frameworks for query: "${question}"`,
      confidence: matchedControls.length > 0 ? 0.85 : 0.2,
    };
  }

  /**
   * Get full details for a specific control.
   */
  getControlDetails(framework: string, controlId: string): ControlDetail | undefined {
    const controls = FRAMEWORK_CONTROLS[framework] ?? [];
    return controls.find((c) => c.id === controlId);
  }

  /**
   * Get evidence requirements for a specific control.
   */
  getEvidenceRequirements(framework: string, controlId: string): string[] {
    const control = this.getControlDetails(framework, controlId);
    return control?.evidenceRequirements ?? [];
  }

  /**
   * Get all controls for a framework.
   */
  getFrameworkControls(framework: string): ControlDetail[] {
    return FRAMEWORK_CONTROLS[framework] ?? [];
  }

  /**
   * Get all controls across all frameworks for a domain category.
   */
  getControlsByDomain(domain: string): ControlDetail[] {
    const results: ControlDetail[] = [];
    for (const controls of Object.values(FRAMEWORK_CONTROLS)) {
      results.push(...controls.filter((c) => c.domain.toLowerCase().includes(domain.toLowerCase())));
    }
    return results;
  }

  /**
   * Store a learning pattern from scan results into the database.
   */
  async storePattern(
    patternType: string,
    industry: string,
    framework: string,
    category: string,
    metric: string,
    value: number,
  ): Promise<void> {
    await this.db.insert(learningPatterns).values({
      patternType,
      industry: industry as any,
      framework: framework as any,
      category,
      metric,
      value,
      sampleSize: 1,
      confidence: 70,
    });
  }
}
