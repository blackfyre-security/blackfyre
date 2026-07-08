// AUTO-GENERATED — control counts from platform/packages/api/src/compliance/control-registry.ts
// (code-of-record; the README headline of 683 differs by 5 — reconcile upstream).

export interface FrameworkDetail {
  key: string;
  short: string;
  name: string;
  controls: number;
  summary: string;
  /** dedicated landing route, if one exists */
  slug?: string;
}

export const FRAMEWORKS: readonly FrameworkDetail[] = [
  { key: "soc2", short: "SOC 2", name: "SOC 2 Type II (AICPA TSC 2017)", controls: 15, summary: "AICPA Trust Services Criteria (Security, Availability, Confidentiality, Processing Integrity, Privacy) for service-org controls.", slug: "/soc2-compliance" },
  { key: "iso27001", short: "ISO 27001", name: "ISO/IEC 27001:2022", controls: 93, summary: "International ISMS standard; Annex A information-security controls across organizational, people, physical, and technological themes." },
  { key: "hipaa", short: "HIPAA", name: "HIPAA Security Rule (45 CFR Part 164)", controls: 113, summary: "US healthcare rule protecting electronic PHI via administrative, physical, and technical safeguards.", slug: "/hipaa-compliance" },
  { key: "gdpr", short: "GDPR", name: "General Data Protection Regulation (EU 2016/679)", controls: 99, summary: "EU regulation governing personal-data processing, data-subject rights, breach notification, and cross-border transfers." },
  { key: "pcidss", short: "PCI DSS", name: "PCI DSS v4.0", controls: 14, summary: "Payment Card Industry Data Security Standard for protecting cardholder / account data." },
  { key: "dpdpa", short: "DPDPA", name: "India Digital Personal Data Protection Act, 2023", controls: 8, summary: "India's personal-data law setting data-fiduciary security, breach, retention, and consent obligations." },
  { key: "iso42001", short: "ISO 42001", name: "ISO/IEC 42001:2023", controls: 22, summary: "AI management-system standard covering AI governance, risk, lifecycle, transparency, fairness, and human oversight.", slug: "/iso-42001" },
  { key: "pdppl", short: "PDPPL", name: "Qatar Personal Data Privacy Protection Law (Law No. 13 of 2016)", controls: 16, summary: "Qatar's personal-data law covering lawful processing, consent, security safeguards, and cross-border/localization rules." },
  { key: "nist80053", short: "NIST 800-53", name: "NIST SP 800-53 Rev 5", controls: 298, summary: "US federal security & privacy control catalog across 20 control families (AC, AU, SC, SI, etc.).", slug: "/nist-800-53" },
];

export const TOTAL_CONTROLS = 678;
export const FRAMEWORK_COUNT = FRAMEWORKS.length;
