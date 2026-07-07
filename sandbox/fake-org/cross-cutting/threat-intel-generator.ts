/**
 * threat-intel-generator.ts
 * Generates synthetic CVEs and correlates them to findings.
 * CVE numbers are clearly synthetic: CVE-2026-90001+
 */

import { createHash } from "crypto";
import type { Finding } from "./evidence-generator.js";

export interface CveRecord {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  cvssScore: number;
  publishedAt: string;
  summary: string;
  affects: string[];
  exploitInWild: boolean;
  kev: boolean; // Known Exploited Vulnerability
  patched: boolean;
}

export interface ThreatCorrelation {
  findingId: string;
  cveId: string;
  confidence: number;
  exploitInWild: boolean;
}

export interface ThreatIntelBundle {
  cves: CveRecord[];
  correlations: ThreatCorrelation[];
  summary: {
    activeCves: number;
    exploitedInWild: number;
    kev: number;
    patched: number;
  };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function deterministicDate(seed: string, daysBack: number, rangedays: number): string {
  const h = parseInt(sha256(seed).slice(0, 6), 16);
  const offset = (h % rangedays) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000 - offset).toISOString().split("T")[0];
}

function findingId(f: Finding, idx: number): string {
  return f.id || `f-${sha256(f.resourceId + f.title).slice(0, 8)}-${idx}`;
}

// 15 synthetic CVEs — realistic titles, no real CVE numbers
const CVE_DEFINITIONS: Array<{
  title: string;
  severity: CveRecord["severity"];
  cvssScore: number;
  summary: string;
  categories: string[]; // which finding categories this CVE applies to
  exploitInWild: boolean;
  kev: boolean;
  patched: boolean;
}> = [
  {
    title: "Kubernetes API Server Unauthenticated Access via Misconfigured RBAC",
    severity: "critical",
    cvssScore: 9.8,
    summary:
      "A misconfigured RBAC policy in Kubernetes clusters allows unauthenticated actors to execute arbitrary API calls against the kube-apiserver, potentially enabling full cluster compromise.",
    categories: ["iam", "config", "network"],
    exploitInWild: true,
    kev: true,
    patched: false,
  },
  {
    title: "AWS IAM Privilege Escalation via AssumeRole Chain with Wildcard Resource",
    severity: "critical",
    cvssScore: 9.1,
    summary:
      "Overly permissive IAM trust policies combined with wildcard resource ARNs allow authenticated principals to escalate privileges to administrator-level access through role chaining.",
    categories: ["iam"],
    exploitInWild: true,
    kev: true,
    patched: false,
  },
  {
    title: "S3 Server-Side Encryption Key Exposure via Bucket Policy Override",
    severity: "high",
    cvssScore: 8.5,
    summary:
      "When bucket-level SSE-KMS policies are combined with public bucket ACLs, it is possible for external parties to retrieve objects with server-managed keys if bucket policy conditions are not properly scoped.",
    categories: ["encryption", "config"],
    exploitInWild: false,
    kev: false,
    patched: true,
  },
  {
    title: "Log4Shell-Style RCE in Self-Hosted SIEM Forwarder Agent",
    severity: "critical",
    cvssScore: 10.0,
    summary:
      "A JNDI injection vulnerability in a widely-deployed log forwarding agent allows remote code execution when processing attacker-controlled log messages. Affects agents shipping logs to SIEM platforms.",
    categories: ["logging"],
    exploitInWild: true,
    kev: true,
    patched: false,
  },
  {
    title: "Azure Active Directory Token Cache Side-Channel Leakage",
    severity: "high",
    cvssScore: 7.8,
    summary:
      "An Azure AD OAuth 2.0 token refresh endpoint leaks cached refresh tokens under specific race conditions, enabling session hijacking for users of multi-tenant applications.",
    categories: ["iam", "config"],
    exploitInWild: false,
    kev: false,
    patched: true,
  },
  {
    title: "GCP Cloud Storage ACL Bypass via Legacy XML API",
    severity: "high",
    cvssScore: 8.1,
    summary:
      "The legacy XML API endpoint for GCS does not enforce uniform bucket-level access controls, allowing ACL-based reads to bypass bucket-level IAM deny policies set via the JSON API.",
    categories: ["config", "network"],
    exploitInWild: false,
    kev: false,
    patched: false,
  },
  {
    title: "CloudTrail Log Tampering via S3 Bucket Replication Race",
    severity: "medium",
    cvssScore: 6.5,
    summary:
      "Attackers with write access to an S3 bucket used as a CloudTrail destination can replace log objects during the brief window between delivery and hash validation if log file integrity validation is disabled.",
    categories: ["logging", "config"],
    exploitInWild: false,
    kev: false,
    patched: true,
  },
  {
    title: "RDS Snapshot Cross-Account Exfiltration via Unencrypted Snapshot Sharing",
    severity: "high",
    cvssScore: 7.5,
    summary:
      "Unencrypted RDS snapshots can be shared with arbitrary AWS accounts through a one-line API call if bucket policies or KMS key policies are not restricted, enabling database content exfiltration.",
    categories: ["encryption", "config"],
    exploitInWild: false,
    kev: false,
    patched: false,
  },
  {
    title: "VPC Security Group Mutation via Terraform State File Injection",
    severity: "high",
    cvssScore: 8.0,
    summary:
      "Terraform state files stored in world-readable S3 buckets can be modified to inject malicious security group rules that are applied on the next terraform apply, bypassing change control.",
    categories: ["network", "config"],
    exploitInWild: true,
    kev: false,
    patched: false,
  },
  {
    title: "Azure Key Vault Secret Enumeration Without Audit Log Entry",
    severity: "medium",
    cvssScore: 6.8,
    summary:
      "A race condition in Azure Key Vault's diagnostic settings initialization allows secret LIST operations to complete without generating audit log entries, enabling covert enumeration during brief windows.",
    categories: ["logging", "encryption"],
    exploitInWild: false,
    kev: false,
    patched: true,
  },
  {
    title: "EKS Worker Node IAM Role Metadata API Abuse via SSRF",
    severity: "critical",
    cvssScore: 9.3,
    summary:
      "A server-side request forgery vulnerability in a popular Kubernetes admission webhook framework allows pods to retrieve EC2 instance metadata, including IAM credentials for the worker node role.",
    categories: ["iam", "network"],
    exploitInWild: true,
    kev: true,
    patched: false,
  },
  {
    title: "GCP Service Account Key Auto-Rotation Bypass via Admin SDK",
    severity: "medium",
    cvssScore: 5.9,
    summary:
      "The GCP Admin SDK does not automatically rotate service account keys when the associated service account is granted new IAM roles, leaving long-lived keys with escalated privileges.",
    categories: ["iam"],
    exploitInWild: false,
    kev: false,
    patched: false,
  },
  {
    title: "CloudFront Distribution Misconfiguration Enables HTTP Downgrade Attack",
    severity: "medium",
    cvssScore: 6.1,
    summary:
      "CloudFront distributions configured without HTTPS-only viewer policies allow attackers in a network position to intercept and downgrade TLS connections to plaintext HTTP, exposing transmitted data.",
    categories: ["network", "encryption"],
    exploitInWild: false,
    kev: false,
    patched: true,
  },
  {
    title: "Azure RBAC Wildcard Action Assignment Allows Data Plane Bypass",
    severity: "high",
    cvssScore: 7.9,
    summary:
      "Custom Azure RBAC role assignments using wildcard (*) actions on data plane scopes can grant principals access to resources beyond the intended administrative boundary.",
    categories: ["iam", "config"],
    exploitInWild: false,
    kev: false,
    patched: false,
  },
  {
    title: "Multi-Cloud API Gateway Unauthenticated Health Endpoint Metadata Disclosure",
    severity: "low",
    cvssScore: 4.3,
    summary:
      "API gateway health check endpoints deployed across AWS, Azure, and GCP commonly expose internal service topology, environment variables, and dependency versions without requiring authentication.",
    categories: ["network", "config", "logging"],
    exploitInWild: false,
    kev: false,
    patched: true,
  },
];

export function generateThreatIntel(findings: Finding[]): ThreatIntelBundle {
  const cves: CveRecord[] = CVE_DEFINITIONS.map((def, idx) => {
    const cveId = `CVE-2026-${90001 + idx}`;
    const seed = sha256(cveId + def.title);
    const daysBack = 30 + (parseInt(seed.slice(0, 4), 16) % 335); // published 30-365 days ago

    // Find all findings in matching categories
    const affectedFindings = findings
      .filter((f, fi) => def.categories.includes(f.category))
      .slice(0, 6) // cap at 6 per CVE
      .map((f, fi) => findingId(f, findings.indexOf(f)));

    return {
      id: cveId,
      title: def.title,
      severity: def.severity,
      cvssScore: def.cvssScore,
      publishedAt: deterministicDate(seed, daysBack, 30),
      summary: def.summary,
      affects: affectedFindings,
      exploitInWild: def.exploitInWild,
      kev: def.kev,
      patched: def.patched,
    };
  });

  // Build correlations: pair each affected finding with its CVE
  const correlations: ThreatCorrelation[] = [];
  let correlationCount = 0;

  for (const cve of cves) {
    for (const fid of cve.affects) {
      if (correlationCount >= 40) break;
      const seed = sha256(cve.id + fid);
      const confidence = 0.5 + (parseInt(seed.slice(0, 4), 16) % 50) / 100; // 0.50-0.99
      correlations.push({
        findingId: fid,
        cveId: cve.id,
        confidence: Math.round(confidence * 100) / 100,
        exploitInWild: cve.exploitInWild,
      });
      correlationCount++;
    }
  }

  const activeCves = cves.filter((c) => !c.patched).length;
  const exploitedInWild = cves.filter((c) => c.exploitInWild).length;
  const kev = cves.filter((c) => c.kev).length;
  const patched = cves.filter((c) => c.patched).length;

  return {
    cves,
    correlations,
    summary: { activeCves, exploitedInWild, kev, patched },
  };
}
