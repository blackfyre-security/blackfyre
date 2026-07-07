import type { Db } from "../../db/connection.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ThreatEntry {
  id: string;
  source: "cve" | "certin" | "aws_bulletin" | "azure_bulletin" | "gcp_bulletin" | "mitre";
  cveId?: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedProducts: string[];
  affectedVersions: string[];
  mitreTechniques: string[];
  publishedAt: Date;
  sourceUrl: string;
}

export interface ThreatMatch {
  threatId: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  matchReason: string;
  matchConfidence: number;
  recommendedAction: string;
}

export interface ThreatFilter {
  source?: string;
  severity?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

/* ------------------------------------------------------------------ */
/*  Static Threat Feed (Simulated — production would fetch from APIs)  */
/* ------------------------------------------------------------------ */

const KNOWN_THREATS: ThreatEntry[] = [
  {
    id: "THREAT-001", source: "cve", cveId: "CVE-2024-21626", title: "Container Runtime Breakout via runc", description: "A vulnerability in runc allows container escape through file descriptor leak in the working directory", severity: "critical", affectedProducts: ["docker", "containerd", "kubernetes"], affectedVersions: ["runc < 1.1.12"], mitreTechniques: ["T1611"], publishedAt: new Date("2024-01-31"), sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2024-21626",
  },
  {
    id: "THREAT-002", source: "aws_bulletin", title: "AWS Lambda Runtime Deprecation — Node.js 16", description: "AWS Lambda is deprecating the Node.js 16 runtime. Functions must be updated to Node.js 18 or 20", severity: "medium", affectedProducts: ["aws-lambda"], affectedVersions: ["nodejs16.x"], mitreTechniques: [], publishedAt: new Date("2024-03-01"), sourceUrl: "https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html",
  },
  {
    id: "THREAT-003", source: "cve", cveId: "CVE-2024-3094", title: "XZ Utils Backdoor", description: "Malicious code discovered in XZ Utils 5.6.0-5.6.1 allowing SSH authentication bypass", severity: "critical", affectedProducts: ["xz-utils", "linux"], affectedVersions: ["5.6.0", "5.6.1"], mitreTechniques: ["T1195.002"], publishedAt: new Date("2024-03-29"), sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2024-3094",
  },
  {
    id: "THREAT-004", source: "certin", title: "CERT-In Advisory: Critical Vulnerability in Apache Struts", description: "Remote code execution vulnerability in Apache Struts framework", severity: "critical", affectedProducts: ["apache-struts"], affectedVersions: ["< 6.3.0.2"], mitreTechniques: ["T1190"], publishedAt: new Date("2024-02-15"), sourceUrl: "https://www.cert-in.org.in/",
  },
  {
    id: "THREAT-005", source: "azure_bulletin", title: "Azure AD Conditional Access Bypass", description: "Under specific conditions, Azure AD Conditional Access policies may not be enforced for legacy authentication protocols", severity: "high", affectedProducts: ["azure-ad", "azure_ad"], affectedVersions: ["legacy-auth-enabled"], mitreTechniques: ["T1078"], publishedAt: new Date("2024-04-01"), sourceUrl: "https://learn.microsoft.com/en-us/azure/active-directory/conditional-access/",
  },
  {
    id: "THREAT-006", source: "gcp_bulletin", title: "GCP Cloud SQL Public IP Exposure", description: "Cloud SQL instances with public IP and authorized networks set to 0.0.0.0/0 are exposed to the internet", severity: "high", affectedProducts: ["gcp-cloud-sql"], affectedVersions: ["all"], mitreTechniques: ["T1190"], publishedAt: new Date("2024-03-15"), sourceUrl: "https://cloud.google.com/sql/docs/mysql/configure-ip",
  },
  {
    id: "THREAT-007", source: "mitre", title: "Cloud Account Manipulation via Stolen Tokens", description: "Adversaries may manipulate cloud accounts by using stolen OAuth/STS tokens to maintain persistence", severity: "high", affectedProducts: ["aws", "azure", "gcp"], affectedVersions: ["all"], mitreTechniques: ["T1098.001", "T1550.001"], publishedAt: new Date("2024-01-15"), sourceUrl: "https://attack.mitre.org/techniques/T1098/001/",
  },
];

/* ------------------------------------------------------------------ */
/*  Threat Intelligence Service                                        */
/* ------------------------------------------------------------------ */

export class ThreatIntelligenceService {
  constructor(private db: Db) {}

  /**
   * Ingest threat feeds from external sources.
   * In production, this would call CVE API, CERT-In RSS, cloud bulletins.
   * For now, returns the static seed data.
   */
  async ingestThreatFeed(): Promise<{ ingested: number; newThreats: number }> {
    // In production: fetch from NVD API, CERT-In, AWS/Azure/GCP security bulletins
    // For now, return static data count
    return {
      ingested: KNOWN_THREATS.length,
      newThreats: 0,
    };
  }

  /**
   * Match known threats against a tenant's infrastructure.
   */
  async matchThreatsToInfra(tenantId: string): Promise<ThreatMatch[]> {
    // In production: query tenant's integrations and resources,
    // cross-reference with threat affected products/versions
    const matches: ThreatMatch[] = [];

    for (const threat of KNOWN_THREATS) {
      // Simulate matching — in production, check actual tenant resources
      if (threat.affectedProducts.some((p) => ["aws", "azure", "gcp", "aws-lambda", "docker", "kubernetes"].includes(p))) {
        matches.push({
          threatId: threat.id,
          tenantId,
          resourceType: threat.affectedProducts[0],
          resourceId: "simulated-resource",
          matchReason: `Tenant uses ${threat.affectedProducts[0]} which is affected by ${threat.title}`,
          matchConfidence: 0.7,
          recommendedAction: `Review ${threat.title} and apply patches if affected version is in use`,
        });
      }
    }

    return matches;
  }

  /**
   * Get active threats with optional filtering.
   */
  async getActiveThreats(filter?: ThreatFilter): Promise<ThreatEntry[]> {
    let results = [...KNOWN_THREATS];

    if (filter?.source) {
      results = results.filter((t) => t.source === filter.source);
    }
    if (filter?.severity) {
      results = results.filter((t) => t.severity === filter.severity);
    }
    if (filter?.dateFrom) {
      results = results.filter((t) => t.publishedAt >= filter.dateFrom!);
    }
    if (filter?.dateTo) {
      results = results.filter((t) => t.publishedAt <= filter.dateTo!);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
      );
    }

    return results.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  /**
   * Get threat by ID.
   */
  getThreat(threatId: string): ThreatEntry | undefined {
    return KNOWN_THREATS.find((t) => t.id === threatId);
  }

  /**
   * Get severity distribution of active threats.
   */
  async getThreatStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const t of KNOWN_THREATS) {
      stats[t.severity] = (stats[t.severity] ?? 0) + 1;
    }
    return stats;
  }
}
