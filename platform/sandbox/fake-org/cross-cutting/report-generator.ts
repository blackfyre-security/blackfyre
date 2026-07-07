/**
 * report-generator.ts
 * Generates 5 compliance reports (SOC2, ISO27001, HIPAA, GDPR, PCI-DSS).
 */

import { createHash } from "crypto";
import type { Finding } from "./evidence-generator.js";

export interface ReportSection {
  title: string;
  contentSummary: string;
  findingsReferenced: string[];
}

export interface ComplianceReport {
  id: string;
  type: "readiness" | "gap_analysis" | "board_summary" | "audit_evidence";
  framework: string;
  status: "ready" | "generating" | "failed";
  summary: {
    totalControls: number;
    passing: number;
    failing: number;
    partial: number;
    na: number;
    score: number;
  };
  generatedAt: string;
  expiresAt: string;
  format: "pdf" | "html" | "json";
  downloadUrl: string;
  sections: ReportSection[];
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function findingId(f: Finding, idx: number): string {
  return f.id || `f-${sha256(f.resourceId + f.title).slice(0, 8)}-${idx}`;
}

function isoDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

const FRAMEWORK_CONTROL_COUNTS: Record<string, number> = {
  soc2: 15,
  iso27001: 12,
  hipaa: 9,
  gdpr: 11,
  pcidss: 14,
};

function computeSummary(
  framework: string,
  findings: Finding[]
): ComplianceReport["summary"] {
  const total = FRAMEWORK_CONTROL_COUNTS[framework] || 10;
  const relevantFindings = findings.filter((f) =>
    f.controlMappings?.some((m) => m.framework === framework)
  );

  const failControls = new Set<string>();
  const partialControls = new Set<string>();

  for (const f of relevantFindings) {
    for (const m of f.controlMappings || []) {
      if (m.framework !== framework) continue;
      if (f.severity === "critical" || f.severity === "high") {
        failControls.add(m.controlId);
      } else {
        if (!failControls.has(m.controlId)) partialControls.add(m.controlId);
      }
    }
  }

  const failing = failControls.size;
  const partial = partialControls.size;
  const na = Math.max(0, Math.round(total * 0.08)); // ~8% N/A
  const passing = Math.max(0, total - failing - partial - na);
  const score = Math.round(((passing + partial * 0.5) / (total - na)) * 100);

  return { totalControls: total, passing, failing, partial, na, score };
}

function pickFindings(findings: Finding[], framework: string, n: number): string[] {
  return findings
    .filter((f) => f.controlMappings?.some((m) => m.framework === framework))
    .slice(0, n)
    .map((f, idx) => findingId(f, idx));
}

export function generateReports(findings: Finding[]): ComplianceReport[] {
  return [
    {
      id: "rep-soc2-2026-q1",
      type: "readiness",
      framework: "soc2",
      status: "ready",
      summary: computeSummary("soc2", findings),
      generatedAt: isoDate(-2),
      expiresAt: isoDate(88),
      format: "pdf",
      downloadUrl: "/api/reports/rep-soc2-2026-q1/download",
      sections: [
        {
          title: "Executive Summary",
          contentSummary:
            "SOC 2 Type II readiness assessment covering the Trust Services Criteria (CC, A, C, PI, P). Overall posture is moderate with critical gaps in CC6 (Access Control) requiring remediation before formal audit engagement.",
          findingsReferenced: pickFindings(findings, "soc2", 3),
        },
        {
          title: "CC6 — Logical Access Controls",
          contentSummary:
            "5 IAM users lack MFA enforcement; privileged access management gaps identified. JIT access not implemented for cloud administrator roles. Recommend deploying deny-without-MFA policies and enabling CyberArk PAM integration.",
          findingsReferenced: pickFindings(findings, "soc2", 5),
        },
        {
          title: "CC7 — Monitoring and Detection",
          contentSummary:
            "CloudTrail not enabled in all AWS regions. SIEM integration partial — 3 AWS accounts not forwarding to Splunk. Alert tuning needed; current false positive rate estimated at 18%.",
          findingsReferenced: pickFindings(findings, "soc2", 4),
        },
        {
          title: "Encryption and Data at Rest (CC6.7)",
          contentSummary:
            "6 S3 buckets and 2 RDS instances lack encryption at rest. SSE-KMS with CMK required per Encryption Standards policy. Immediate remediation recommended before audit window.",
          findingsReferenced: pickFindings(findings, "soc2", 4),
        },
        {
          title: "Remediation Roadmap",
          contentSummary:
            "Priority 1 (0-30 days): MFA enforcement, public access blocks, CloudTrail gaps. Priority 2 (30-60 days): Encryption at rest, network hardening. Priority 3 (60-90 days): PAM implementation, SIEM tuning.",
          findingsReferenced: [],
        },
      ],
    },

    {
      id: "rep-iso27001-2026-q1",
      type: "gap_analysis",
      framework: "iso27001",
      status: "ready",
      summary: computeSummary("iso27001", findings),
      generatedAt: isoDate(-1),
      expiresAt: isoDate(89),
      format: "html",
      downloadUrl: "/api/reports/rep-iso27001-2026-q1/download",
      sections: [
        {
          title: "Executive Summary",
          contentSummary:
            "ISO 27001:2022 gap analysis across 93 controls (Annex A). Controls assessed via automated scan correlation and manual interviews. Significant gaps in A.8 (Technical Controls) and A.5 (Organizational Controls).",
          findingsReferenced: pickFindings(findings, "iso27001", 2),
        },
        {
          title: "A.8 — Technical Controls",
          contentSummary:
            "A.8.5 (Secure Authentication): Critical — MFA not enforced for all users. A.8.24 (Cryptography): High — Unencrypted S3/RDS resources found. A.8.15 (Logging): High — Access logging absent on 5 buckets. A.8.20 (Network Security): High — Security groups open to internet.",
          findingsReferenced: pickFindings(findings, "iso27001", 6),
        },
        {
          title: "A.5 — Organizational Controls",
          contentSummary:
            "A.5.24 (Incident Response): Policy exists but CloudTrail gaps limit forensic capability. A.5.9 (Asset Inventory): Cloud assets not fully tracked in CMDB; automatic discovery recommended.",
          findingsReferenced: pickFindings(findings, "iso27001", 3),
        },
        {
          title: "Statement of Applicability",
          contentSummary:
            "SoA updated to reflect current control status. 81/93 controls applicable; 12 marked not applicable (physical security controls not relevant to cloud-only infrastructure). 47 controls passing, 22 partial, 12 failing.",
          findingsReferenced: [],
        },
        {
          title: "Certification Readiness",
          contentSummary:
            "Estimated 90-120 days to certification readiness. External audit body (BSI or Bureau Veritas) to be engaged upon completing Priority 1 remediations. Stage 1 audit planned for Q3 2026.",
          findingsReferenced: [],
        },
      ],
    },

    {
      id: "rep-hipaa-2026-q1",
      type: "audit_evidence",
      framework: "hipaa",
      status: "ready",
      summary: computeSummary("hipaa", findings),
      generatedAt: isoDate(-3),
      expiresAt: isoDate(87),
      format: "pdf",
      downloadUrl: "/api/reports/rep-hipaa-2026-q1/download",
      sections: [
        {
          title: "Executive Summary",
          contentSummary:
            "HIPAA Security Rule audit evidence package covering Administrative, Physical, and Technical Safeguards. ePHI workloads identified in us-east-1 region. Several technical safeguard gaps require remediation.",
          findingsReferenced: pickFindings(findings, "hipaa", 2),
        },
        {
          title: "164.312(a)(1) — Access Control",
          contentSummary:
            "IAM users with access to ePHI systems missing MFA. Unique user identification: compliant. Emergency access procedure: documented but not tested in last 12 months.",
          findingsReferenced: pickFindings(findings, "hipaa", 4),
        },
        {
          title: "164.312(e)(1) — Transmission Security",
          contentSummary:
            "TLS 1.2+ enforced on all external endpoints. Internal service mesh partially encrypted; 3 services using plaintext gRPC connections. Encryption-in-transit policy violations noted.",
          findingsReferenced: pickFindings(findings, "hipaa", 3),
        },
        {
          title: "164.312(b) — Audit Controls",
          contentSummary:
            "CloudTrail enabled for ePHI accounts. Log retention set to 7 years in compliance with HIPAA. Access logs enabled on 11/16 S3 buckets storing ePHI. Gaps in 5 buckets being remediated.",
          findingsReferenced: pickFindings(findings, "hipaa", 3),
        },
        {
          title: "Business Associate Agreements",
          contentSummary:
            "BAAs in place with AWS, Azure, Microsoft 365, Okta, and Splunk. 2 new vendors (analytics tool, AI model provider) require BAA execution before ePHI can be shared.",
          findingsReferenced: [],
        },
      ],
    },

    {
      id: "rep-gdpr-2026-q1",
      type: "board_summary",
      framework: "gdpr",
      status: "ready",
      summary: computeSummary("gdpr", findings),
      generatedAt: isoDate(-1),
      expiresAt: isoDate(89),
      format: "pdf",
      downloadUrl: "/api/reports/rep-gdpr-2026-q1/download",
      sections: [
        {
          title: "Board Summary",
          contentSummary:
            "GDPR compliance posture as of Q1 2026. 3 high-priority gaps identified requiring board attention: (1) Encryption gaps exposing personal data, (2) Cross-border data transfer review needed for 2 new vendors, (3) DSAR response time exceeding 30-day SLA for 4% of requests.",
          findingsReferenced: pickFindings(findings, "gdpr", 3),
        },
        {
          title: "Art. 32 — Security of Processing",
          contentSummary:
            "Technical measures assessment: encryption gaps found in 3 storage services. Pseudonymization not applied in 2 analytics pipelines. MFA lacking for accounts accessing personal data systems.",
          findingsReferenced: pickFindings(findings, "gdpr", 5),
        },
        {
          title: "Art. 5 — Data Processing Principles",
          contentSummary:
            "Data minimization review: 2 data collection flows collecting excess fields. Retention automation implemented for customer data; manual review required for analytics datasets. ROPA updated Q4 2025.",
          findingsReferenced: [],
        },
        {
          title: "Data Subject Request Metrics",
          contentSummary:
            "Q1 2026: 147 DSARs received; 141 completed within 30 days (95.9%); 6 exceeded deadline (DPO investigating). No regulatory complaints received. Zero data breaches notified to DPA.",
          findingsReferenced: [],
        },
        {
          title: "Regulatory Horizon",
          contentSummary:
            "EU AI Act obligations being assessed for credit scoring model. EDPB guidance on legitimate interest updated Feb 2026 — DPO reviewing impact. India DPDPA implementing regulations expected mid-2026.",
          findingsReferenced: [],
        },
      ],
    },

    {
      id: "rep-pcidss-2026-q1",
      type: "readiness",
      framework: "pcidss",
      status: "generating",
      summary: computeSummary("pcidss", findings),
      generatedAt: isoDate(0),
      expiresAt: isoDate(90),
      format: "pdf",
      downloadUrl: "/api/reports/rep-pcidss-2026-q1/download",
      sections: [
        {
          title: "Executive Summary",
          contentSummary:
            "PCI-DSS v4.0 readiness assessment. Cardholder Data Environment (CDE) scoped to payment processing VPC in us-east-1. 4 SAQ-D requirements currently failing; Level 1 QSA engagement pending.",
          findingsReferenced: pickFindings(findings, "pcidss", 2),
        },
        {
          title: "Requirement 8 — Authentication",
          contentSummary:
            "Req 8.3.6 (MFA for all non-console admin access): Failing — 5 privileged accounts lack MFA. Req 8.6.1 (System/app accounts): Failing — service accounts have non-rotating credentials.",
          findingsReferenced: pickFindings(findings, "pcidss", 4),
        },
        {
          title: "Requirement 3 — Cardholder Data Protection",
          contentSummary:
            "PAN data encrypted at storage. Tokenization implemented for 95% of stored PANs. 5% legacy data requires migration to tokenized format. Key management practices compliant with Req 3.6/3.7.",
          findingsReferenced: pickFindings(findings, "pcidss", 3),
        },
        {
          title: "Requirement 10 — Logging",
          contentSummary:
            "Req 10.3 (Audit logs protected): Partial — CloudTrail log validation not enabled in 2 accounts. Req 10.5 (Log retention 12 months): Compliant. Req 10.7 (Detect/address log failures): Monitoring gap identified.",
          findingsReferenced: pickFindings(findings, "pcidss", 3),
        },
        {
          title: "Network Segmentation Validation",
          contentSummary:
            "CDE segmentation validated via automated scan. 2 security groups allow ports outside approved CDE communications matrix. Penetration test scheduled for Q2 2026.",
          findingsReferenced: pickFindings(findings, "pcidss", 3),
        },
      ],
    },
  ];
}
