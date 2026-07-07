import type { IndustryBaselineProfile } from "@blackfyre/shared";

const profiles: IndustryBaselineProfile[] = [
  {
    id: "fintech",
    name: "Financial Technology",
    priorityFrameworks: ["soc2", "pcidss", "gdpr"],
    focusAreas: [
      "Payment card data encryption",
      "Access control and MFA",
      "Audit trail completeness",
      "Transaction integrity",
      "Regulatory reporting",
    ],
  },
  {
    id: "healthtech",
    name: "Health Technology",
    priorityFrameworks: ["hipaa", "soc2", "iso27001"],
    focusAreas: [
      "ePHI access controls",
      "Audit logging for PHI access",
      "Encryption at rest and in transit",
      "Workforce security training",
      "Breach notification procedures",
    ],
  },
  {
    id: "saas",
    name: "Software as a Service",
    priorityFrameworks: ["soc2", "iso27001", "gdpr"],
    focusAreas: [
      "Multi-tenant data isolation",
      "API security and authentication",
      "Change management processes",
      "Availability and disaster recovery",
      "Data processing agreements",
    ],
  },
  {
    id: "ecommerce",
    name: "E-Commerce",
    priorityFrameworks: ["pcidss", "gdpr", "soc2"],
    focusAreas: [
      "Cardholder data environment segmentation",
      "Customer consent management",
      "Payment processing security",
      "Fraud detection and monitoring",
      "Data retention policies",
    ],
  },
  {
    id: "custom",
    name: "AI / Technology",
    priorityFrameworks: ["iso42001", "soc2", "gdpr"],
    focusAreas: [
      "AI model governance and versioning",
      "Bias detection and fairness assessment",
      "Data quality and provenance tracking",
      "Human oversight enforcement",
      "AI transparency and explainability",
    ],
  },
  {
    id: "government",
    name: "Qatar Government / Public Sector",
    priorityFrameworks: ["pdppl", "iso27001", "soc2"],
    focusAreas: [
      "PDPPL lawful processing basis and consent",
      "Data localization within Qatar national borders",
      "Cross-border transfer controls and ministerial approval",
      "Data Protection Impact Assessments (DPIA)",
      "Records of Processing Activities (RoPA)",
      "Data Protection Officer appointment",
      "72-hour breach notification to MOTC",
    ],
  },
];

/**
 * Get all industry baseline profiles.
 */
export function getAllIndustryProfiles(): IndustryBaselineProfile[] {
  return profiles;
}

/**
 * Get an industry profile by id.
 */
export function getIndustryProfile(id: string): IndustryBaselineProfile | undefined {
  return profiles.find((p) => p.id === id);
}
