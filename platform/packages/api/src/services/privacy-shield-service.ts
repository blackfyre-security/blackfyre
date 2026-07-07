import { eq, and, desc } from "drizzle-orm";
import { findings, scans, controlMappings } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { getFrameworkRegistry } from "../compliance/control-registry.js";

// --- Types ---

export interface ProcessingActivity {
  id: string;
  name: string;
  dataCategories: string[];
  purpose: string;
  legalBasis: string;
  retentionPeriod: string;
  crossBorderTransfer: boolean;
  recipientCountries: string[];
  riskLevel: "low" | "medium" | "high" | "very_high";
}

export interface DpiaRisk {
  riskId: string;
  description: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  riskScore: number;
  mitigations: string[];
  residualRisk: "low" | "medium" | "high";
}

export interface DpiaReport {
  tenantId: string;
  processingActivity: string;
  dataCategories: string[];
  purpose: string;
  generatedAt: string;
  necessityAssessment: {
    isNecessary: boolean;
    justification: string;
    proportionality: string;
  };
  risks: DpiaRisk[];
  overallRiskLevel: "low" | "medium" | "high" | "very_high";
  recommendations: string[];
  pdpplControls: string[];
  requiresDpoConsultation: boolean;
}

export interface RopaEntry {
  activityId: string;
  activityName: string;
  controller: string;
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  retentionPeriod: string;
  securityMeasures: string[];
  crossBorderTransfers: Array<{ country: string; safeguard: string }>;
  lastReviewed: string;
}

export interface RopaReport {
  tenantId: string;
  generatedAt: string;
  version: string;
  entries: RopaEntry[];
  totalActivities: number;
  highRiskActivities: number;
  crossBorderActivities: number;
}

export interface PrivacyDashboard {
  tenantId: string;
  pdpplScore: number;
  activeProcessingActivities: number;
  pendingDpias: number;
  dataSubjectRequests: number;
  breachNotifications: number;
  controlStatus: {
    controlId: string;
    controlName: string;
    status: "compliant" | "partial" | "non_compliant" | "not_assessed";
  }[];
  upcomingDeadlines: Array<{ item: string; dueDate: string; priority: "low" | "medium" | "high" }>;
}

export interface PdpplComplianceStatus {
  tenantId: string;
  overallScore: number;
  checkedAt: string;
  controls: Array<{
    controlId: string;
    controlName: string;
    category: string;
    status: "compliant" | "partial" | "non_compliant" | "not_assessed";
    findings: number;
    weight: number;
  }>;
  criticalGaps: string[];
  nextSteps: string[];
  dpoRequired: boolean;
  dpiaRequired: boolean;
}

// --- Helpers ---

const DATA_CATEGORY_RISK: Record<string, "low" | "medium" | "high" | "very_high"> = {
  "biometric": "very_high",
  "health": "very_high",
  "financial": "high",
  "location": "high",
  "identity": "high",
  "contact": "medium",
  "behavioral": "medium",
  "preferences": "low",
};

function assessDataRisk(dataCategories: string[]): "low" | "medium" | "high" | "very_high" {
  const levels = ["low", "medium", "high", "very_high"] as const;
  let maxIdx = 0;
  for (const cat of dataCategories) {
    const key = cat.toLowerCase();
    for (const [pattern, level] of Object.entries(DATA_CATEGORY_RISK)) {
      if (key.includes(pattern)) {
        const idx = levels.indexOf(level);
        if (idx > maxIdx) maxIdx = idx;
      }
    }
  }
  return levels[maxIdx];
}

function buildDpiaRisks(dataCategories: string[], purpose: string): DpiaRisk[] {
  const risks: DpiaRisk[] = [];
  const overallDataRisk = assessDataRisk(dataCategories);

  risks.push({
    riskId: "RISK-001",
    description: "Unauthorised access to personal data during processing",
    likelihood: overallDataRisk === "very_high" || overallDataRisk === "high" ? "high" : "medium",
    impact: "high",
    riskScore: overallDataRisk === "very_high" ? 9 : overallDataRisk === "high" ? 6 : 4,
    mitigations: [
      "Implement role-based access controls (PDPPL-10.1)",
      "Enable audit logging for all data access events",
      "Enforce encryption at rest and in transit",
    ],
    residualRisk: "low",
  });

  risks.push({
    riskId: "RISK-002",
    description: "Data retained beyond the stated processing purpose",
    likelihood: "medium",
    impact: "medium",
    riskScore: 4,
    mitigations: [
      "Implement automated retention schedules (PDPPL-9.1)",
      "Conduct quarterly data lifecycle reviews",
      "Document retention periods in RoPA",
    ],
    residualRisk: "low",
  });

  if (purpose.toLowerCase().includes("market") || purpose.toLowerCase().includes("profil")) {
    risks.push({
      riskId: "RISK-003",
      description: "Automated profiling without explicit consent",
      likelihood: "high",
      impact: "high",
      riskScore: 9,
      mitigations: [
        "Obtain explicit consent before profiling (PDPPL-6.1)",
        "Provide opt-out mechanism for data subjects",
        "Document profiling logic for transparency",
      ],
      residualRisk: "medium",
    });
  }

  risks.push({
    riskId: "RISK-004",
    description: "Cross-border transfer without adequate safeguards",
    likelihood: "medium",
    impact: "high",
    riskScore: 6,
    mitigations: [
      "Obtain ministerial approval for cross-border transfers (PDPPL-11.1)",
      "Implement standard contractual clauses with recipients",
      "Restrict data to Qatar-approved jurisdictions",
    ],
    residualRisk: "low",
  });

  return risks;
}

function buildDefaultRopaEntries(tenantId: string): RopaEntry[] {
  return [
    {
      activityId: `${tenantId}-ROPA-001`,
      activityName: "Employee Personal Data Processing",
      controller: tenantId,
      purpose: "Human resources management and employment contract fulfilment",
      legalBasis: "PDPPL Article 5.1 — Contractual necessity",
      dataCategories: ["identity", "contact", "financial", "employment"],
      dataSubjects: ["Employees", "Contractors"],
      recipients: ["HR Department", "Payroll Provider", "Government Authorities"],
      retentionPeriod: "Duration of employment + 5 years",
      securityMeasures: [
        "Encryption at rest (AES-256)",
        "Role-based access control",
        "Audit logging",
      ],
      crossBorderTransfers: [],
      lastReviewed: new Date().toISOString().split("T")[0],
    },
    {
      activityId: `${tenantId}-ROPA-002`,
      activityName: "Customer Account Management",
      controller: tenantId,
      purpose: "Service delivery, account management, and customer support",
      legalBasis: "PDPPL Article 5.1 — Contractual necessity and legitimate interest",
      dataCategories: ["identity", "contact", "behavioral", "financial"],
      dataSubjects: ["Customers", "Prospective Customers"],
      recipients: ["Customer Support", "Billing Systems", "Analytics Platform"],
      retentionPeriod: "Duration of contract + 3 years",
      securityMeasures: [
        "TLS 1.3 for data in transit",
        "Database encryption",
        "Access control policies",
        "Regular security assessments",
      ],
      crossBorderTransfers: [],
      lastReviewed: new Date().toISOString().split("T")[0],
    },
    {
      activityId: `${tenantId}-ROPA-003`,
      activityName: "Security Monitoring and Audit Logging",
      controller: tenantId,
      purpose: "Information security, fraud prevention, and regulatory compliance",
      legalBasis: "PDPPL Article 5.1 — Legal obligation and legitimate interest",
      dataCategories: ["behavioral", "identity", "location"],
      dataSubjects: ["Employees", "Customers", "System Users"],
      recipients: ["Security Operations Centre", "Legal & Compliance"],
      retentionPeriod: "12 months rolling",
      securityMeasures: [
        "Immutable audit logs",
        "Encryption at rest",
        "Restricted access to security team",
      ],
      crossBorderTransfers: [],
      lastReviewed: new Date().toISOString().split("T")[0],
    },
  ];
}

// --- Service ---

export class PrivacyShieldService {
  constructor(private db: Db) {}

  /**
   * Generate a DPIA for a tenant's processing activity.
   */
  async generateDpia(
    tenantId: string,
    params: { processingActivity: string; dataCategories: string[]; purpose: string },
  ): Promise<DpiaReport> {
    const riskLevel = assessDataRisk(params.dataCategories);
    const risks = buildDpiaRisks(params.dataCategories, params.purpose);
    const maxRiskScore = Math.max(...risks.map((r) => r.riskScore));

    const overallRiskLevel: "low" | "medium" | "high" | "very_high" =
      maxRiskScore >= 9 ? "very_high"
      : maxRiskScore >= 6 ? "high"
      : maxRiskScore >= 3 ? "medium"
      : "low";

    const recommendations: string[] = [
      "Appoint or consult with your Data Protection Officer (PDPPL-14.1)",
      "Review consent records to ensure they are valid under PDPPL-6.1",
      "Verify data retention schedules comply with PDPPL-9.1",
      "Confirm all security safeguards meet PDPPL-10.1 requirements",
    ];

    if (overallRiskLevel === "high" || overallRiskLevel === "very_high") {
      recommendations.push("This processing activity requires DPO consultation before commencing");
      recommendations.push("Consider whether cross-border transfers are strictly necessary (PDPPL-11.1)");
    }

    const pdpplRegistry = getFrameworkRegistry("pdppl");
    const relevantControls = pdpplRegistry?.controls
      .filter((c) => ["Consent", "Lawful Processing", "Data Principles", "Security", "Accountability"].includes(c.category))
      .map((c) => c.controlId) ?? [];

    return {
      tenantId,
      processingActivity: params.processingActivity,
      dataCategories: params.dataCategories,
      purpose: params.purpose,
      generatedAt: new Date().toISOString(),
      necessityAssessment: {
        isNecessary: true,
        justification: `Processing of ${params.dataCategories.join(", ")} data is necessary for: ${params.purpose}`,
        proportionality: riskLevel === "low" || riskLevel === "medium"
          ? "Processing appears proportionate to the stated purpose"
          : "High-risk processing — additional justification and safeguards required",
      },
      risks,
      overallRiskLevel,
      recommendations,
      pdpplControls: relevantControls,
      requiresDpoConsultation: overallRiskLevel === "high" || overallRiskLevel === "very_high",
    };
  }

  /**
   * Generate a RoPA (Records of Processing Activities) for a tenant.
   */
  async generateRopa(tenantId: string): Promise<RopaReport> {
    const detected = await this.detectProcessingActivities(tenantId);
    const defaultEntries = buildDefaultRopaEntries(tenantId);

    const detectedEntries: RopaEntry[] = detected.map((a, idx) => ({
      activityId: `${tenantId}-ROPA-AUTO-${String(idx + 1).padStart(3, "0")}`,
      activityName: a.name,
      controller: tenantId,
      purpose: a.purpose,
      legalBasis: `PDPPL Article 5.1 — ${a.legalBasis}`,
      dataCategories: a.dataCategories,
      dataSubjects: ["System Users", "Customers"],
      recipients: ["Internal Security Team"],
      retentionPeriod: a.retentionPeriod,
      securityMeasures: ["Encryption at rest", "Access controls", "Audit logging"],
      crossBorderTransfers: a.crossBorderTransfer
        ? a.recipientCountries.map((c) => ({ country: c, safeguard: "Ministerial decree approval required (PDPPL-11.1)" }))
        : [],
      lastReviewed: new Date().toISOString().split("T")[0],
    }));

    const allEntries = [...defaultEntries, ...detectedEntries];
    const highRiskCount = allEntries.filter((e) =>
      e.dataCategories.some((cat) => ["biometric", "health", "financial"].some((h) => cat.toLowerCase().includes(h))),
    ).length;
    const crossBorderCount = allEntries.filter((e) => e.crossBorderTransfers.length > 0).length;

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      version: "1.0",
      entries: allEntries,
      totalActivities: allEntries.length,
      highRiskActivities: highRiskCount,
      crossBorderActivities: crossBorderCount,
    };
  }

  /**
   * Get privacy dashboard data for a tenant.
   */
  async getPrivacyDashboard(tenantId: string): Promise<PrivacyDashboard> {
    const status = await this.checkPdpplCompliance(tenantId);

    return {
      tenantId,
      pdpplScore: status.overallScore,
      activeProcessingActivities: 3,
      pendingDpias: status.dpiaRequired ? 1 : 0,
      dataSubjectRequests: 0,
      breachNotifications: 0,
      controlStatus: status.controls.map((c) => ({
        controlId: c.controlId,
        controlName: c.controlName,
        status: c.status,
      })),
      upcomingDeadlines: [
        {
          item: "Annual RoPA review",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          priority: "medium",
        },
        ...(status.dpoRequired ? [{
          item: "Data Protection Officer appointment",
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          priority: "high" as const,
        }] : []),
      ],
    };
  }

  /**
   * Check PDPPL compliance status for a tenant based on their scan findings.
   */
  async checkPdpplCompliance(tenantId: string): Promise<PdpplComplianceStatus> {
    const registry = getFrameworkRegistry("pdppl");
    if (!registry) {
      return {
        tenantId,
        overallScore: 0,
        checkedAt: new Date().toISOString(),
        controls: [],
        criticalGaps: ["PDPPL framework registry not found"],
        nextSteps: ["Contact support to enable PDPPL framework"],
        dpoRequired: false,
        dpiaRequired: false,
      };
    }

    // Get latest completed scan for this tenant
    const [latestScan] = await this.db
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "completed")))
      .orderBy(desc(scans.completedAt))
      .limit(1);

    // Get PDPPL control mappings from scan findings
    const mappings = latestScan
      ? await this.db
          .select({
            controlId: controlMappings.controlId,
            status: controlMappings.status,
          })
          .from(controlMappings)
          .innerJoin(findings, eq(controlMappings.findingId, findings.id))
          .where(
            and(
              eq(findings.scanId, latestScan.id),
              eq(controlMappings.framework, "pdppl" as any),
            ),
          )
      : [];

    const mappingByControl = new Map<string, string>();
    for (const m of mappings) {
      const existing = mappingByControl.get(m.controlId);
      const priority = (s: string) => (s === "fail" ? 3 : s === "partial" ? 2 : s === "pass" ? 1 : 0);
      if (!existing || priority(m.status) > priority(existing)) {
        mappingByControl.set(m.controlId, m.status);
      }
    }

    let totalWeight = 0;
    let weightedPassed = 0;

    const controls = registry.controls.map((c) => {
      const rawStatus = mappingByControl.get(c.controlId);
      const status: "compliant" | "partial" | "non_compliant" | "not_assessed" =
        rawStatus === "pass" ? "compliant"
        : rawStatus === "partial" ? "partial"
        : rawStatus === "fail" ? "non_compliant"
        : "not_assessed";

      totalWeight += c.weight;
      if (status === "compliant") weightedPassed += c.weight;
      else if (status === "partial") weightedPassed += c.weight * 0.5;

      return {
        controlId: c.controlId,
        controlName: c.controlName,
        category: c.category,
        status,
        findings: mappings.filter((m) => m.controlId === c.controlId).length,
        weight: c.weight,
      };
    });

    const overallScore = totalWeight > 0
      ? Math.round((weightedPassed / totalWeight) * 100)
      : 0;

    const criticalGaps = controls
      .filter((c) => c.status === "non_compliant" && c.weight === 3)
      .map((c) => `${c.controlId}: ${c.controlName}`);

    const nextSteps: string[] = [];
    if (criticalGaps.length > 0) {
      nextSteps.push("Address critical PDPPL control gaps immediately");
    }
    const notAssessedCount = controls.filter((c) => c.status === "not_assessed").length;
    if (notAssessedCount > 0) {
      nextSteps.push(`Run a PDPPL-scoped scan to assess ${notAssessedCount} unevaluated controls`);
    }
    nextSteps.push("Review and update Records of Processing Activities (RoPA)");
    nextSteps.push("Verify data subject consent records are current and valid");

    const dpoRequired = overallScore < 70 || controls.some((c) => c.controlId === "PDPPL-14.1" && c.status !== "compliant");
    const dpiaRequired = controls.some((c) => c.controlId === "PDPPL-13.1" && c.status !== "compliant");

    return {
      tenantId,
      overallScore,
      checkedAt: new Date().toISOString(),
      controls,
      criticalGaps,
      nextSteps,
      dpoRequired,
      dpiaRequired,
    };
  }

  /**
   * Auto-detect processing activities from scan findings for a tenant.
   */
  async detectProcessingActivities(tenantId: string): Promise<ProcessingActivity[]> {
    const [latestScan] = await this.db
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "completed")))
      .orderBy(desc(scans.completedAt))
      .limit(1);

    if (!latestScan) return [];

    const scanFindings = await this.db
      .select({
        category: findings.category,
        resourceType: findings.resourceType,
        severity: findings.severity,
      })
      .from(findings)
      .where(eq(findings.scanId, latestScan.id))
      .limit(100);

    const activitiesMap = new Map<string, ProcessingActivity>();

    for (const finding of scanFindings) {
      const resource = finding.resourceType?.toLowerCase() ?? "";

      if (resource.includes("database") || resource.includes("rds") || resource.includes("storage")) {
        if (!activitiesMap.has("data-storage")) {
          activitiesMap.set("data-storage", {
            id: `${tenantId}-ACT-001`,
            name: "Personal Data Storage",
            dataCategories: ["identity", "contact", "behavioral"],
            purpose: "Persistent storage of application and user data",
            legalBasis: "Contractual necessity",
            retentionPeriod: "Per data retention policy",
            crossBorderTransfer: false,
            recipientCountries: [],
            riskLevel: finding.severity === "critical" || finding.severity === "high" ? "high" : "medium",
          });
        }
      }

      if (resource.includes("iam") || resource.includes("identity") || finding.category === "iam") {
        if (!activitiesMap.has("identity-management")) {
          activitiesMap.set("identity-management", {
            id: `${tenantId}-ACT-002`,
            name: "Identity and Access Management",
            dataCategories: ["identity", "credentials"],
            purpose: "User authentication and authorisation",
            legalBasis: "Legitimate interest — security",
            retentionPeriod: "Active account lifetime + 12 months",
            crossBorderTransfer: false,
            recipientCountries: [],
            riskLevel: "medium",
          });
        }
      }

      if (resource.includes("log") || resource.includes("cloudtrail") || finding.category === "logging") {
        if (!activitiesMap.has("audit-logging")) {
          activitiesMap.set("audit-logging", {
            id: `${tenantId}-ACT-003`,
            name: "Security Audit Logging",
            dataCategories: ["behavioral", "identity", "location"],
            purpose: "Security monitoring and incident investigation",
            legalBasis: "Legal obligation — PDPPL-10.1 security safeguards",
            retentionPeriod: "12 months",
            crossBorderTransfer: false,
            recipientCountries: [],
            riskLevel: "low",
          });
        }
      }
    }

    return Array.from(activitiesMap.values());
  }
}
