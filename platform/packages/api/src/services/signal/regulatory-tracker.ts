/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RegulatoryChange {
  id: string;
  framework: string;
  changeType: "new_version" | "amendment" | "guidance" | "enforcement";
  title: string;
  summary: string;
  impactLevel: "critical" | "high" | "medium" | "low";
  effectiveDate: Date;
  sourceUrl: string;
  aiAnalysis: Record<string, unknown>;
  publishedAt: Date;
  ingestedAt: Date;
}

export interface ImpactAssessment {
  regulatoryChangeId: string;
  tenantId: string;
  affectedControls: Array<{
    controlId: string;
    framework: string;
    currentStatus: string;
    gapIntroduced: boolean;
    actionRequired: string;
  }>;
  overallImpact: "critical" | "high" | "medium" | "low";
  actionPlan: string[];
  estimatedEffortHours: number;
}

/* ------------------------------------------------------------------ */
/*  Static Regulatory Changes Feed (Production: ingest from APIs)      */
/* ------------------------------------------------------------------ */

const REGULATORY_CHANGES: RegulatoryChange[] = [
  {
    id: "REG-001", framework: "iso42001", changeType: "new_version",
    title: "ISO 42001:2023 Published — AI Management Systems",
    summary: "First international standard for AI management systems. Organizations using AI must establish, implement, maintain and improve an AIMS.",
    impactLevel: "critical", effectiveDate: new Date("2023-12-18"),
    sourceUrl: "https://www.iso.org/standard/81230.html",
    aiAnalysis: { keyChange: "New certification requirement for AI-using organizations", affectedIndustries: ["all"] },
    publishedAt: new Date("2023-12-18"), ingestedAt: new Date(),
  },
  {
    id: "REG-002", framework: "dpdpa", changeType: "amendment",
    title: "DPDPA 2023 — Digital Personal Data Protection Act (India)",
    summary: "India's comprehensive data protection law enacted. Establishes Data Protection Board, consent requirements, and breach notification rules.",
    impactLevel: "critical", effectiveDate: new Date("2023-08-11"),
    sourceUrl: "https://www.meity.gov.in/",
    aiAnalysis: { keyChange: "New consent and breach notification requirements for India operations", affectedIndustries: ["fintech", "healthtech", "ecommerce"] },
    publishedAt: new Date("2023-08-11"), ingestedAt: new Date(),
  },
  {
    id: "REG-003", framework: "pcidss", changeType: "new_version",
    title: "PCI DSS v4.0.1 — Updated Payment Card Industry Standard",
    summary: "Updated PCI DSS with new requirements for MFA, password length (12+ chars), targeted risk analysis, and customized approach.",
    impactLevel: "high", effectiveDate: new Date("2025-03-31"),
    sourceUrl: "https://www.pcisecuritystandards.org/",
    aiAnalysis: { keyChange: "Extended MFA requirements, 12-char passwords, customized validation approach" },
    publishedAt: new Date("2024-06-01"), ingestedAt: new Date(),
  },
  {
    id: "REG-004", framework: "nist80053", changeType: "guidance",
    title: "NIST SP 800-53 Rev 5.1.1 — Updated Security Controls",
    summary: "Minor updates to security and privacy controls catalog with clarified guidance on supply chain risk management.",
    impactLevel: "medium", effectiveDate: new Date("2024-01-15"),
    sourceUrl: "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
    aiAnalysis: { keyChange: "Supply chain risk management controls updated" },
    publishedAt: new Date("2024-01-15"), ingestedAt: new Date(),
  },
  {
    id: "REG-005", framework: "gdpr", changeType: "enforcement",
    title: "EDPB Guidelines on AI and GDPR — Final Version",
    summary: "European Data Protection Board guidelines on applying GDPR to AI systems including training data, profiling, and automated decision-making.",
    impactLevel: "high", effectiveDate: new Date("2024-06-01"),
    sourceUrl: "https://edpb.europa.eu/",
    aiAnalysis: { keyChange: "AI training data must comply with GDPR purpose limitation and minimization" },
    publishedAt: new Date("2024-06-01"), ingestedAt: new Date(),
  },
  {
    id: "REG-006", framework: "hipaa", changeType: "guidance",
    title: "HHS OCR Guidance on HIPAA and Cloud Computing",
    summary: "Updated guidance on HIPAA requirements for cloud service providers handling ePHI, including encryption and BAA requirements.",
    impactLevel: "medium", effectiveDate: new Date("2024-03-01"),
    sourceUrl: "https://www.hhs.gov/hipaa/",
    aiAnalysis: { keyChange: "Clarified cloud provider responsibilities for ePHI encryption and access controls" },
    publishedAt: new Date("2024-03-01"), ingestedAt: new Date(),
  },
];

/* ------------------------------------------------------------------ */
/*  Regulatory Tracker Service                                         */
/* ------------------------------------------------------------------ */

export class RegulatoryTrackerService {
  /**
   * Track regulatory changes for specified frameworks.
   */
  async trackRegulations(frameworks: string[]): Promise<RegulatoryChange[]> {
    // In production: fetch from regulatory APIs, RSS feeds, CERT-In
    return REGULATORY_CHANGES.filter((r) =>
      frameworks.length === 0 || frameworks.includes(r.framework),
    ).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  /**
   * Assess impact of a regulatory change on a tenant.
   */
  async assessImpact(regulatoryChangeId: string, tenantId: string): Promise<ImpactAssessment> {
    const change = REGULATORY_CHANGES.find((r) => r.id === regulatoryChangeId);
    if (!change) {
      return {
        regulatoryChangeId,
        tenantId,
        affectedControls: [],
        overallImpact: "low",
        actionPlan: ["Regulatory change not found"],
        estimatedEffortHours: 0,
      };
    }

    // Simulate impact assessment based on framework
    const affectedControls = this.getAffectedControls(change);

    return {
      regulatoryChangeId,
      tenantId,
      affectedControls,
      overallImpact: change.impactLevel,
      actionPlan: this.generateActionPlan(change),
      estimatedEffortHours: affectedControls.length * 4,
    };
  }

  /**
   * Get recent regulatory changes.
   */
  async getRecentChanges(filter?: {
    framework?: string;
    changeType?: string;
    impactLevel?: string;
  }): Promise<RegulatoryChange[]> {
    let results = [...REGULATORY_CHANGES];
    if (filter?.framework) results = results.filter((r) => r.framework === filter.framework);
    if (filter?.changeType) results = results.filter((r) => r.changeType === filter.changeType);
    if (filter?.impactLevel) results = results.filter((r) => r.impactLevel === filter.impactLevel);
    return results.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  private getAffectedControls(change: RegulatoryChange): ImpactAssessment["affectedControls"] {
    const controlMap: Record<string, Array<{ controlId: string; framework: string }>> = {
      iso42001: [
        { controlId: "4.1", framework: "iso42001" },
        { controlId: "6.1", framework: "iso42001" },
        { controlId: "8.4", framework: "iso42001" },
      ],
      dpdpa: [
        { controlId: "DPDPA-S4", framework: "dpdpa" },
        { controlId: "DPDPA-S8", framework: "dpdpa" },
      ],
      pcidss: [
        { controlId: "Req.8", framework: "pcidss" },
        { controlId: "Req.3", framework: "pcidss" },
      ],
      gdpr: [
        { controlId: "Art.25", framework: "gdpr" },
        { controlId: "Art.32", framework: "gdpr" },
      ],
      hipaa: [
        { controlId: "164.312(a)", framework: "hipaa" },
        { controlId: "164.312(e)", framework: "hipaa" },
      ],
    };

    const controls = controlMap[change.framework] ?? [];
    return controls.map((c) => ({
      ...c,
      currentStatus: "needs_review",
      gapIntroduced: change.impactLevel === "critical" || change.impactLevel === "high",
      actionRequired: `Review and update ${c.controlId} compliance for ${change.title}`,
    }));
  }

  private generateActionPlan(change: RegulatoryChange): string[] {
    return [
      `Review ${change.title} for applicability to your organization`,
      `Conduct gap assessment against ${change.framework} requirements`,
      `Update affected controls and evidence collection`,
      `Schedule compliance review with stakeholders`,
      `Update internal policies and procedures as needed`,
    ];
  }
}
