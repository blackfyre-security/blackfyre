/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CrossMapping {
  sourceFramework: string;
  sourceControlId: string;
  targetFramework: string;
  targetControlId: string;
  targetControlTitle: string;
  strength: "exact" | "strong" | "partial" | "weak";
  rationale: string;
}

export interface MultiFrameworkImpact {
  category: string;
  affectedControls: Array<{
    framework: string;
    controlId: string;
    controlTitle: string;
    strength: "exact" | "strong" | "partial" | "weak";
  }>;
  totalFrameworksAffected: number;
}

/* ------------------------------------------------------------------ */
/*  Static Cross-Framework Mapping Matrix                              */
/* ------------------------------------------------------------------ */

const CROSS_MAPPINGS: CrossMapping[] = [
  // Access Control family
  { sourceFramework: "soc2", sourceControlId: "CC6.1", targetFramework: "iso27001", targetControlId: "A.9.1", targetControlTitle: "Business Requirements of Access Control", strength: "exact", rationale: "Both require restricting logical access to authorized users" },
  { sourceFramework: "soc2", sourceControlId: "CC6.1", targetFramework: "hipaa", targetControlId: "164.312(a)", targetControlTitle: "Access Control", strength: "strong", rationale: "HIPAA requires access controls for ePHI; SOC 2 is broader" },
  { sourceFramework: "soc2", sourceControlId: "CC6.1", targetFramework: "nist80053", targetControlId: "AC-1", targetControlTitle: "Access Control Policy", strength: "strong", rationale: "NIST AC-1 establishes policy; SOC2 CC6.1 covers implementation" },
  { sourceFramework: "soc2", sourceControlId: "CC6.1", targetFramework: "pcidss", targetControlId: "Req.8", targetControlTitle: "Identify Users and Authenticate Access", strength: "strong", rationale: "Both require unique user identification and authentication" },
  { sourceFramework: "soc2", sourceControlId: "CC6.1", targetFramework: "gdpr", targetControlId: "Art.32", targetControlTitle: "Security of Processing", strength: "partial", rationale: "GDPR Art.32 includes access control as part of security measures" },
  { sourceFramework: "soc2", sourceControlId: "CC6.1", targetFramework: "dpdpa", targetControlId: "DPDPA-S8", targetControlTitle: "Data Fiduciary Obligations", strength: "partial", rationale: "DPDPA requires security safeguards including access control" },

  // Encryption / Cryptography family
  { sourceFramework: "iso27001", sourceControlId: "A.10.1", targetFramework: "hipaa", targetControlId: "164.312(a)", targetControlTitle: "Access Control (Encryption)", strength: "strong", rationale: "Both require encryption of sensitive data at rest" },
  { sourceFramework: "iso27001", sourceControlId: "A.10.1", targetFramework: "pcidss", targetControlId: "Req.3", targetControlTitle: "Protect Stored Account Data", strength: "exact", rationale: "Both mandate encryption for stored sensitive data" },
  { sourceFramework: "iso27001", sourceControlId: "A.10.1", targetFramework: "hipaa", targetControlId: "164.312(e)", targetControlTitle: "Transmission Security", strength: "strong", rationale: "Both require encryption in transit" },
  { sourceFramework: "iso27001", sourceControlId: "A.10.1", targetFramework: "gdpr", targetControlId: "Art.32", targetControlTitle: "Security of Processing", strength: "strong", rationale: "GDPR explicitly lists encryption as appropriate measure" },
  { sourceFramework: "iso27001", sourceControlId: "A.10.1", targetFramework: "nist80053", targetControlId: "AC-1", targetControlTitle: "Access Control Policy", strength: "partial", rationale: "NIST SC family covers cryptography; AC-1 is broader" },

  // Logging / Audit family
  { sourceFramework: "soc2", sourceControlId: "CC7.1", targetFramework: "iso27001", targetControlId: "A.12.4", targetControlTitle: "Logging and Monitoring", strength: "exact", rationale: "Both require event detection, logging, and monitoring" },
  { sourceFramework: "soc2", sourceControlId: "CC7.1", targetFramework: "hipaa", targetControlId: "164.312(b)", targetControlTitle: "Audit Controls", strength: "strong", rationale: "HIPAA requires audit trails; SOC 2 requires broader monitoring" },
  { sourceFramework: "soc2", sourceControlId: "CC7.1", targetFramework: "nist80053", targetControlId: "AU-2", targetControlTitle: "Audit Events", strength: "exact", rationale: "Both define requirements for auditable event monitoring" },
  { sourceFramework: "soc2", sourceControlId: "CC7.1", targetFramework: "pcidss", targetControlId: "Req.1", targetControlTitle: "Network Security Controls", strength: "partial", rationale: "PCI DSS Req.10 is closer; Req.1 includes monitoring aspects" },

  // Change Management
  { sourceFramework: "soc2", sourceControlId: "CC8.1", targetFramework: "nist80053", targetControlId: "AC-2", targetControlTitle: "Account Management", strength: "partial", rationale: "NIST CM family is closer; AC-2 covers account lifecycle changes" },

  // AI Governance
  { sourceFramework: "iso42001", sourceControlId: "4.1", targetFramework: "nist80053", targetControlId: "AC-1", targetControlTitle: "Access Control Policy", strength: "weak", rationale: "AI governance organizational context is tangentially related to policy frameworks" },
  { sourceFramework: "iso42001", sourceControlId: "6.1", targetFramework: "iso27001", targetControlId: "A.18.1", targetControlTitle: "Compliance with Legal Requirements", strength: "partial", rationale: "AI risk management includes regulatory compliance aspects" },
  { sourceFramework: "iso42001", sourceControlId: "8.4", targetFramework: "gdpr", targetControlId: "Art.25", targetControlTitle: "Data Protection by Design", strength: "strong", rationale: "AI impact assessment aligns with privacy by design principles" },

  // Data Protection
  { sourceFramework: "gdpr", sourceControlId: "Art.25", targetFramework: "dpdpa", targetControlId: "DPDPA-S4", targetControlTitle: "Grounds for Processing", strength: "strong", rationale: "Both require purpose limitation and data minimization" },
  { sourceFramework: "gdpr", sourceControlId: "Art.33", targetFramework: "hipaa", targetControlId: "164.312(a)", targetControlTitle: "Access Control", strength: "weak", rationale: "Breach notification tangentially relates to access controls" },
  { sourceFramework: "gdpr", sourceControlId: "Art.33", targetFramework: "dpdpa", targetControlId: "DPDPA-S8", targetControlTitle: "Data Fiduciary Obligations", strength: "strong", rationale: "Both require breach notification to authorities" },

  // Integrity
  { sourceFramework: "hipaa", sourceControlId: "164.312(c)", targetFramework: "iso27001", targetControlId: "A.10.1", targetControlTitle: "Cryptographic Controls", strength: "partial", rationale: "Integrity controls may use cryptographic mechanisms" },
  { sourceFramework: "hipaa", sourceControlId: "164.312(c)", targetFramework: "pcidss", targetControlId: "Req.3", targetControlTitle: "Protect Stored Account Data", strength: "partial", rationale: "Data integrity is part of protection requirements" },
];

/* ------------------------------------------------------------------ */
/*  Cross-Framework Mapper Service                                     */
/* ------------------------------------------------------------------ */

export class CrossFrameworkMapper {
  /**
   * Get all controls in other frameworks equivalent to a given control.
   */
  getEquivalentControls(framework: string, controlId: string): CrossMapping[] {
    const asSource = CROSS_MAPPINGS.filter(
      (m) => m.sourceFramework === framework && m.sourceControlId === controlId,
    );
    const asTarget = CROSS_MAPPINGS.filter(
      (m) => m.targetFramework === framework && m.targetControlId === controlId,
    ).map((m) => ({
      sourceFramework: m.targetFramework,
      sourceControlId: m.targetControlId,
      targetFramework: m.sourceFramework,
      targetControlId: m.sourceControlId,
      targetControlTitle: `Mapped from ${m.sourceFramework} ${m.sourceControlId}`,
      strength: m.strength,
      rationale: m.rationale,
    }));

    return [...asSource, ...asTarget];
  }

  /**
   * Get multi-framework impact for a finding category.
   */
  getMultiFrameworkImpact(findingCategory: string): MultiFrameworkImpact {
    const categoryControlMap: Record<string, Array<{ framework: string; controlId: string; title: string }>> = {
      iam: [
        { framework: "soc2", controlId: "CC6.1", title: "Logical and Physical Access Controls" },
        { framework: "iso27001", controlId: "A.9.1", title: "Access Control" },
        { framework: "hipaa", controlId: "164.312(a)", title: "Access Control" },
        { framework: "nist80053", controlId: "AC-1", title: "Access Control Policy" },
        { framework: "pcidss", controlId: "Req.8", title: "Identify and Authenticate" },
        { framework: "gdpr", controlId: "Art.32", title: "Security of Processing" },
      ],
      encryption: [
        { framework: "iso27001", controlId: "A.10.1", title: "Cryptographic Controls" },
        { framework: "hipaa", controlId: "164.312(a)", title: "Access Control (Encryption)" },
        { framework: "hipaa", controlId: "164.312(e)", title: "Transmission Security" },
        { framework: "pcidss", controlId: "Req.3", title: "Protect Stored Data" },
        { framework: "gdpr", controlId: "Art.32", title: "Security of Processing" },
        { framework: "nist80053", controlId: "AC-1", title: "Access Control Policy" },
      ],
      logging: [
        { framework: "soc2", controlId: "CC7.1", title: "Detect and Monitor" },
        { framework: "iso27001", controlId: "A.12.4", title: "Logging and Monitoring" },
        { framework: "hipaa", controlId: "164.312(b)", title: "Audit Controls" },
        { framework: "nist80053", controlId: "AU-2", title: "Audit Events" },
      ],
      network: [
        { framework: "soc2", controlId: "CC6.1", title: "Logical Access Controls" },
        { framework: "pcidss", controlId: "Req.1", title: "Network Security Controls" },
        { framework: "iso27001", controlId: "A.9.1", title: "Access Control" },
        { framework: "nist80053", controlId: "AC-1", title: "Access Control Policy" },
      ],
      config: [
        { framework: "soc2", controlId: "CC8.1", title: "Change Management" },
        { framework: "soc2", controlId: "CC7.2", title: "Monitor System Components" },
        { framework: "nist80053", controlId: "AC-2", title: "Account Management" },
      ],
      storage: [
        { framework: "iso27001", controlId: "A.10.1", title: "Cryptographic Controls" },
        { framework: "pcidss", controlId: "Req.3", title: "Protect Stored Data" },
        { framework: "gdpr", controlId: "Art.32", title: "Security of Processing" },
        { framework: "hipaa", controlId: "164.312(a)", title: "Access Control" },
      ],
    };

    const controls = categoryControlMap[findingCategory] ?? [];
    const frameworks = new Set(controls.map((c) => c.framework));

    return {
      category: findingCategory,
      affectedControls: controls.map((c) => ({
        framework: c.framework,
        controlId: c.controlId,
        controlTitle: c.title,
        strength: "strong" as const,
      })),
      totalFrameworksAffected: frameworks.size,
    };
  }

  /**
   * Get all mappings for a given framework.
   */
  getAllMappings(framework: string): CrossMapping[] {
    return CROSS_MAPPINGS.filter(
      (m) => m.sourceFramework === framework || m.targetFramework === framework,
    );
  }

  /**
   * Calculate remediation ROI across all frameworks.
   */
  getRemediationROI(findingCategory: string, frameworks: string[]): Record<string, number> {
    const impact = this.getMultiFrameworkImpact(findingCategory);
    const roi: Record<string, number> = {};

    for (const fw of frameworks) {
      const affected = impact.affectedControls.filter((c) => c.framework === fw);
      // Approximate % improvement per remediated finding
      roi[fw] = affected.length * 2; // ~2% per control fixed
    }

    return roi;
  }
}
