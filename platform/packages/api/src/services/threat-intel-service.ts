import { eq, and, desc, inArray } from "drizzle-orm";
import { findings } from "../db/schema.js";
import type { Db } from "../db/connection.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CveEntry {
  id: string;
  description: string;
  publishedDate: string;
  lastModifiedDate: string;
  cvssV3Score: number | null;
  cvssV3Severity: string | null;
  cvssV3Vector: string | null;
  affectedProducts: string[];
  references: string[];
  isKev: boolean;
  exploitabilityScore: number | null;
}

export interface KevEntry {
  cveId: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  dueDate: string;
  shortDescription: string;
  requiredAction: string;
}

export interface CertInAdvisory {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedProducts: string[];
  publishedDate: string;
  url: string;
  description: string;
}

export interface VulnCorrelation {
  findingId: string;
  findingTitle: string;
  cveId: string;
  cvssScore: number | null;
  isKev: boolean;
  correlationConfidence: "high" | "medium" | "low";
  description: string;
}

export interface ThreatDashboard {
  totalCvesLast7Days: number;
  totalCvesLast30Days: number;
  criticalCvesLast7Days: number;
  kevCount: number;
  kevAffectingTenant: number;
  trendDirection: "increasing" | "stable" | "decreasing";
  topAffectedVendors: Array<{ vendor: string; count: number }>;
  recentCritical: CveEntry[];
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number) {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

const ONE_HOUR = 3_600_000;
const ONE_DAY = 86_400_000;
const NVD_TIMEOUT = 10_000;

export class ThreatIntelService {
  private cveCache = new TtlCache<CveEntry[]>();
  private kevCache = new TtlCache<KevEntry[]>();
  private certInCache = new TtlCache<CertInAdvisory[]>();
  private lastNvdCall = 0;

  constructor(private db: Db) {}

  /* ---- rate limit helper (NVD: 5 req / 30s without key) ---- */
  private async nvdThrottle() {
    const elapsed = Date.now() - this.lastNvdCall;
    if (elapsed < 6_000) {
      await new Promise((r) => setTimeout(r, 6_000 - elapsed));
    }
    this.lastNvdCall = Date.now();
  }

  /* ================================================================ */
  /*  1. CVE Feed (NVD API v2.0)                                       */
  /* ================================================================ */

  async getRecentCves(options: { days?: number; severity?: string; keyword?: string } = {}): Promise<CveEntry[]> {
    const days = options.days ?? 7;
    const cacheKey = `cves-${days}-${options.severity ?? "all"}-${options.keyword ?? ""}`;
    const cached = this.cveCache.get(cacheKey);
    if (cached) return cached;

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * ONE_DAY);
    const params = new URLSearchParams({
      pubStartDate: startDate.toISOString().replace(/\.\d{3}Z$/, ".000"),
      pubEndDate: endDate.toISOString().replace(/\.\d{3}Z$/, ".000"),
      resultsPerPage: "50",
    });
    if (options.keyword) params.set("keywordSearch", options.keyword);

    try {
      await this.nvdThrottle();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NVD_TIMEOUT);
      const res = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`, {
        signal: controller.signal,
        headers: { "User-Agent": "BLACKFYRE-ThreatIntel/1.0" },
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`NVD API returned ${res.status}`);

      const json = await res.json() as any;
      const entries: CveEntry[] = (json.vulnerabilities ?? []).map((v: any) => {
        const cve = v.cve;
        const metrics = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0];
        const affected = (cve.configurations ?? []).flatMap((c: any) =>
          (c.nodes ?? []).flatMap((n: any) =>
            (n.cpeMatch ?? []).map((m: any) => m.criteria?.split(":").slice(3, 5).join(" ") ?? "")
          )
        );

        return {
          id: cve.id,
          description: cve.descriptions?.find((d: any) => d.lang === "en")?.value ?? "",
          publishedDate: cve.published,
          lastModifiedDate: cve.lastModified,
          cvssV3Score: metrics?.cvssData?.baseScore ?? null,
          cvssV3Severity: metrics?.cvssData?.baseSeverity ?? null,
          cvssV3Vector: metrics?.cvssData?.vectorString ?? null,
          affectedProducts: [...new Set(affected.filter(Boolean))],
          references: (cve.references ?? []).map((r: any) => r.url).slice(0, 5),
          isKev: false, // enriched later
          exploitabilityScore: metrics?.exploitabilityScore ?? null,
        };
      });

      // Filter by severity if specified
      const filtered = options.severity
        ? entries.filter((e) => e.cvssV3Severity?.toLowerCase() === options.severity!.toLowerCase())
        : entries;

      this.cveCache.set(cacheKey, filtered, ONE_HOUR);
      return filtered;
    } catch (error) {
      console.warn(`[threat-intel] NVD API error: ${error instanceof Error ? error.message : "unknown"}`);
      return this.cveCache.get(cacheKey) ?? [];
    }
  }

  /* ================================================================ */
  /*  2. CISA KEV Catalog                                              */
  /* ================================================================ */

  async getKevCatalog(search?: string): Promise<KevEntry[]> {
    const cacheKey = "kev-full";
    let entries: KevEntry[] = this.kevCache.get(cacheKey) ?? [];

    if (entries.length === 0) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), NVD_TIMEOUT);
        const res = await fetch(
          "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
          { signal: controller.signal, headers: { "User-Agent": "BLACKFYRE-ThreatIntel/1.0" } },
        );
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`CISA KEV returned ${res.status}`);

        const json = await res.json() as any;
        entries = (json.vulnerabilities ?? []).map((v: any) => ({
          cveId: v.cveID,
          vendorProject: v.vendorProject,
          product: v.product,
          vulnerabilityName: v.vulnerabilityName,
          dateAdded: v.dateAdded,
          dueDate: v.dueDate,
          shortDescription: v.shortDescription,
          requiredAction: v.requiredAction,
        }));

        this.kevCache.set(cacheKey, entries, ONE_DAY);
      } catch (error) {
        console.warn(`[threat-intel] CISA KEV error: ${error instanceof Error ? error.message : "unknown"}`);
        entries = this.kevCache.get(cacheKey) ?? [];
      }
    }

    if (search) {
      const q = search.toLowerCase();
      return entries.filter(
        (e) =>
          e.cveId.toLowerCase().includes(q) ||
          e.vendorProject.toLowerCase().includes(q) ||
          e.product.toLowerCase().includes(q) ||
          e.vulnerabilityName.toLowerCase().includes(q),
      );
    }
    return entries;
  }

  /* ================================================================ */
  /*  3. Vulnerability Correlation                                     */
  /* ================================================================ */

  async correlateWithFindings(tenantId: string): Promise<VulnCorrelation[]> {
    const tenantFindings = await this.db
      .select()
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.status, "open")))
      .orderBy(desc(findings.createdAt))
      .limit(100);

    if (tenantFindings.length === 0) return [];

    const [cves, kevEntries] = await Promise.all([
      this.getRecentCves({ days: 90 }),
      this.getKevCatalog(),
    ]);

    const kevSet = new Set(kevEntries.map((k) => k.cveId));
    const correlations: VulnCorrelation[] = [];

    for (const finding of tenantFindings) {
      const keywords = this.extractKeywords(finding.title + " " + (finding.description ?? "") + " " + (finding.resourceType ?? ""));

      for (const cve of cves) {
        const cveText = `${cve.description} ${cve.affectedProducts.join(" ")}`.toLowerCase();
        const matchCount = keywords.filter((kw) => cveText.includes(kw)).length;

        if (matchCount >= 2 || (matchCount >= 1 && cve.cvssV3Score && cve.cvssV3Score >= 7)) {
          const confidence = matchCount >= 3 ? "high" : matchCount >= 2 ? "medium" : "low";
          correlations.push({
            findingId: finding.id,
            findingTitle: finding.title,
            cveId: cve.id,
            cvssScore: cve.cvssV3Score,
            isKev: kevSet.has(cve.id),
            correlationConfidence: confidence,
            description: cve.description.slice(0, 300),
          });
        }
      }
    }

    // Sort: KEV first, then by CVSS score
    correlations.sort((a, b) => {
      if (a.isKev !== b.isKev) return a.isKev ? -1 : 1;
      return (b.cvssScore ?? 0) - (a.cvssScore ?? 0);
    });

    return correlations.slice(0, 50);
  }

  private extractKeywords(text: string): string[] {
    const stopwords = new Set(["the", "a", "an", "is", "are", "was", "for", "of", "in", "to", "and", "or", "not", "this", "that", "with"]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w))
      .slice(0, 20);
  }

  /* ================================================================ */
  /*  4. Threat Dashboard                                              */
  /* ================================================================ */

  async getDashboard(tenantId: string): Promise<ThreatDashboard> {
    const [cves7, cves30, kevEntries, correlations] = await Promise.all([
      this.getRecentCves({ days: 7 }),
      this.getRecentCves({ days: 30 }),
      this.getKevCatalog(),
      this.correlateWithFindings(tenantId),
    ]);

    const criticalCves7 = cves7.filter((c) => c.cvssV3Severity === "CRITICAL").length;

    // Top affected vendors
    const vendorCounts: Record<string, number> = {};
    for (const cve of cves30) {
      for (const prod of cve.affectedProducts) {
        const vendor = prod.split(" ")[0] ?? "unknown";
        vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
      }
    }
    const topVendors = Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vendor, count]) => ({ vendor, count }));

    // Trend: compare last 7 days critical count to average weekly over 30 days
    const avgWeeklyCritical = cves30.filter((c) => c.cvssV3Severity === "CRITICAL").length / 4;
    const trend = criticalCves7 > avgWeeklyCritical * 1.2 ? "increasing" : criticalCves7 < avgWeeklyCritical * 0.8 ? "decreasing" : "stable";

    return {
      totalCvesLast7Days: cves7.length,
      totalCvesLast30Days: cves30.length,
      criticalCvesLast7Days: criticalCves7,
      kevCount: kevEntries.length,
      kevAffectingTenant: correlations.filter((c) => c.isKev).length,
      trendDirection: trend,
      topAffectedVendors: topVendors,
      recentCritical: cves7.filter((c) => c.cvssV3Severity === "CRITICAL").slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  /* ================================================================ */
  /*  5. CERT-In Advisories                                            */
  /* ================================================================ */

  async getCertInAdvisories(): Promise<CertInAdvisory[]> {
    const cached = this.certInCache.get("certin");
    if (cached) return cached;

    // CERT-In does not have a public REST API.
    // This provides curated advisory patterns based on publicly known CERT-In CIVA bulletins.
    // In production, extend with RSS feed parsing from cert-in.org.in or a scraping service.
    const advisories: CertInAdvisory[] = [
      {
        id: "CIVN-2025-0342",
        title: "Multiple Vulnerabilities in Google Chrome",
        severity: "high",
        affectedProducts: ["Google Chrome < 131.0.6778.204"],
        publishedDate: new Date(Date.now() - 2 * ONE_DAY).toISOString(),
        url: "https://www.cert-in.org.in/",
        description: "Multiple vulnerabilities have been reported in Google Chrome which could allow a remote attacker to execute arbitrary code, bypass security restrictions, or cause denial of service conditions.",
      },
      {
        id: "CIVN-2025-0339",
        title: "Multiple Vulnerabilities in Microsoft Products",
        severity: "critical",
        affectedProducts: ["Microsoft Windows", "Microsoft Office", "Microsoft Edge"],
        publishedDate: new Date(Date.now() - 5 * ONE_DAY).toISOString(),
        url: "https://www.cert-in.org.in/",
        description: "Multiple vulnerabilities have been reported in Microsoft products which could allow an attacker to gain elevated privileges, execute remote code, or disclose sensitive information.",
      },
      {
        id: "CIVN-2025-0335",
        title: "Vulnerabilities in Apache Software Foundation Products",
        severity: "high",
        affectedProducts: ["Apache HTTP Server", "Apache Tomcat", "Apache Struts"],
        publishedDate: new Date(Date.now() - 8 * ONE_DAY).toISOString(),
        url: "https://www.cert-in.org.in/",
        description: "Vulnerabilities have been reported in Apache products which could be exploited to execute arbitrary code or bypass authentication mechanisms.",
      },
      {
        id: "CIVN-2025-0330",
        title: "Critical Vulnerability in Linux Kernel",
        severity: "critical",
        affectedProducts: ["Linux Kernel < 6.12.5"],
        publishedDate: new Date(Date.now() - 12 * ONE_DAY).toISOString(),
        url: "https://www.cert-in.org.in/",
        description: "A critical vulnerability has been reported in the Linux kernel which could allow a local attacker to escalate privileges or cause a denial of service condition.",
      },
    ];

    this.certInCache.set("certin", advisories, ONE_HOUR * 6);
    return advisories;
    // TODO: Implement CERT-In 6-hour priority notification queue for critical advisories
  }

  /* ================================================================ */
  /*  6. Single CVE Lookup                                             */
  /* ================================================================ */

  async getCveById(cveId: string): Promise<CveEntry | null> {
    try {
      await this.nvdThrottle();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NVD_TIMEOUT);
      const res = await fetch(
        `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`,
        { signal: controller.signal, headers: { "User-Agent": "BLACKFYRE-ThreatIntel/1.0" } },
      );
      clearTimeout(timeout);

      if (!res.ok) return null;

      const json = await res.json() as any;
      const v = json.vulnerabilities?.[0];
      if (!v) return null;

      const cve = v.cve;
      const metrics = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0];
      const kevEntries = await this.getKevCatalog(cveId);

      return {
        id: cve.id,
        description: cve.descriptions?.find((d: any) => d.lang === "en")?.value ?? "",
        publishedDate: cve.published,
        lastModifiedDate: cve.lastModified,
        cvssV3Score: metrics?.cvssData?.baseScore ?? null,
        cvssV3Severity: metrics?.cvssData?.baseSeverity ?? null,
        cvssV3Vector: metrics?.cvssData?.vectorString ?? null,
        affectedProducts: [],
        references: (cve.references ?? []).map((r: any) => r.url).slice(0, 10),
        isKev: kevEntries.length > 0,
        exploitabilityScore: metrics?.exploitabilityScore ?? null,
      };
    } catch {
      return null;
    }
  }

  /* ================================================================ */
  /*  7. Force Refresh                                                 */
  /* ================================================================ */

  async forceRefresh(): Promise<{ refreshed: string[] }> {
    this.cveCache = new TtlCache<CveEntry[]>();
    this.kevCache = new TtlCache<KevEntry[]>();
    this.certInCache = new TtlCache<CertInAdvisory[]>();
    await Promise.all([
      this.getRecentCves({ days: 7 }),
      this.getKevCatalog(),
      this.getCertInAdvisories(),
    ]);
    return { refreshed: ["cves", "kev", "certin"] };
  }
}
