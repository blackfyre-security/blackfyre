/**
 * IaC Compliance Mapper — Maps IaC scanner rule categories to compliance
 * controls across all 6 frameworks (SOC2, ISO27001, HIPAA, GDPR, PCI-DSS, DPDPA).
 *
 * Checkov has native CIS/PCI-DSS mappings; this provides coverage for
 * the remaining frameworks BLACKFYRE supports.
 */

import { m, type ControlMappingEntry } from "./compliance-mapper-aws.js";

/** IaC category → compliance control mappings across all 6 frameworks */
const IAC_CATEGORY_MAP: Record<string, ControlMappingEntry[]> = {
  networking: [
    m("soc2", "CC6.6", "Network Security Boundaries", 3),
    m("iso27001", "A.8.20", "Networks Security", 3),
    m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
    m("gdpr", "Art.32(1)", "Security of Processing", 3),
    m("pcidss", "1.3.1", "Restrict Inbound Traffic", 3),
    m("dpdpa", "DPDPA-S9-1", "Network Security Safeguards", 3),
  ],
  encryption: [
    m("soc2", "CC6.7", "Data Transmission Protection", 3),
    m("iso27001", "A.8.24", "Use of Cryptography", 3),
    m("hipaa", "164.312(e)(1)", "Transmission Security", 3),
    m("gdpr", "Art.32(1)", "Security of Processing", 3),
    m("pcidss", "3.4", "Render PAN Unreadable", 3),
    m("dpdpa", "DPDPA-S8-3", "Encryption of Personal Data", 3),
  ],
  iam: [
    m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
    m("iso27001", "A.5.15", "Access Control Policy", 3),
    m("hipaa", "164.312(a)(1)", "Access Control", 3),
    m("gdpr", "Art.25(1)", "Data Protection by Design", 3),
    m("pcidss", "7.1", "Access Restriction to System Components", 3),
    m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  ],
  logging: [
    m("soc2", "CC7.1", "Monitoring and Detection", 2),
    m("iso27001", "A.8.15", "Logging", 2),
    m("hipaa", "164.312(b)", "Audit Controls", 2),
    m("gdpr", "Art.30", "Records of Processing Activities", 2),
    m("pcidss", "10.1", "Audit Trail Implementation", 2),
    m("dpdpa", "DPDPA-S8-4", "Audit Trails for Personal Data Processing", 2),
  ],
  general: [
    m("soc2", "CC3.1", "Risk Assessment Process", 1),
    m("iso27001", "A.5.9", "Inventory of Assets", 1),
    m("hipaa", "164.308(a)(1)(i)", "Security Management Process", 1),
    m("gdpr", "Art.32(1)", "Security of Processing", 1),
    m("pcidss", "12.1", "Security Policy", 1),
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 1),
  ],
  secrets: [
    m("soc2", "CC6.1", "Logical and Physical Access Controls", 3),
    m("iso27001", "A.8.24", "Use of Cryptography", 3),
    m("hipaa", "164.312(a)(1)", "Access Control", 3),
    m("gdpr", "Art.32(1)", "Security of Processing", 3),
    m("pcidss", "3.4", "Render PAN Unreadable", 3),
    m("dpdpa", "DPDPA-S8-3", "Encryption of Personal Data", 3),
  ],
};

/** Tags that indicate an IaC category */
const TAG_CATEGORY_MAP: Record<string, string> = {
  network: "networking",
  networking: "networking",
  firewall: "networking",
  vpc: "networking",
  encrypt: "encryption",
  encryption: "encryption",
  crypto: "encryption",
  tls: "encryption",
  ssl: "encryption",
  iam: "iam",
  access: "iam",
  authentication: "iam",
  authorization: "iam",
  logging: "logging",
  log: "logging",
  audit: "logging",
  monitoring: "logging",
  secret: "secrets",
  credential: "secrets",
  password: "secrets",
  key: "secrets",
};

/**
 * Maps an IaC check rule to compliance controls based on rule ID and tags.
 * Tries tag-based matching first, falls back to "general" category.
 */
export function mapIacCheckToControls(
  ruleId: string,
  tags: string[],
): ControlMappingEntry[] {
  // Try to determine category from tags
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [keyword, category] of Object.entries(TAG_CATEGORY_MAP)) {
      if (lower.includes(keyword)) {
        return IAC_CATEGORY_MAP[category] ?? IAC_CATEGORY_MAP.general!;
      }
    }
  }

  // Try rule ID patterns
  const lowerRule = ruleId.toLowerCase();
  for (const [keyword, category] of Object.entries(TAG_CATEGORY_MAP)) {
    if (lowerRule.includes(keyword)) {
      return IAC_CATEGORY_MAP[category] ?? IAC_CATEGORY_MAP.general!;
    }
  }

  // Default to general
  return IAC_CATEGORY_MAP.general!;
}
