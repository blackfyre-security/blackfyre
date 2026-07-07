import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  tenantBranding,
  stakeholderLinks,
  complianceScores,
  remediations,
  findings,
  scans,
} from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound, badRequest, forbidden } from "../utils/errors.js";

export interface CreateShareLinkOptions {
  label: string;
  expiresAt?: Date;
  frameworks?: string[];
  showRemediation?: boolean;
  showTrend?: boolean;
  createdBy: string;
}

export interface UpdateBrandingOptions {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  tagline?: string;
}

export class StakeholderService {
  constructor(private db: Db) {}

  /**
   * Generate a crypto-random token and create a new stakeholder share link.
   */
  async createShareLink(tenantId: string, options: CreateShareLinkOptions) {
    const token = randomBytes(32).toString("hex");

    const [created] = await this.db
      .insert(stakeholderLinks)
      .values({
        tenantId,
        token,
        label: options.label,
        expiresAt: options.expiresAt ?? null,
        frameworks: options.frameworks ?? null,
        showRemediation: options.showRemediation ?? false,
        showTrend: options.showTrend ?? true,
        createdBy: options.createdBy,
      })
      .returning();

    return created;
  }

  /**
   * List all share links for a tenant.
   */
  async listShareLinks(tenantId: string) {
    return this.db
      .select()
      .from(stakeholderLinks)
      .where(eq(stakeholderLinks.tenantId, tenantId))
      .orderBy(desc(stakeholderLinks.createdAt));
  }

  /**
   * Revoke (delete) a share link, verifying tenant ownership.
   */
  async revokeLink(linkId: string, tenantId: string) {
    const [existing] = await this.db
      .select({ id: stakeholderLinks.id, tenantId: stakeholderLinks.tenantId })
      .from(stakeholderLinks)
      .where(eq(stakeholderLinks.id, linkId))
      .limit(1);

    if (!existing) throw notFound("StakeholderLink");
    if (existing.tenantId !== tenantId) throw forbidden("You do not own this link");

    await this.db
      .delete(stakeholderLinks)
      .where(eq(stakeholderLinks.id, linkId));
  }

  /**
   * Validate token and return the link record (does NOT increment access count).
   * Returns null if not found. Throws 410 if expired.
   */
  async getShareLink(token: string) {
    const [link] = await this.db
      .select()
      .from(stakeholderLinks)
      .where(eq(stakeholderLinks.token, token))
      .limit(1);

    if (!link) return null;

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new (class extends Error {
        statusCode = 410;
        code = "LINK_EXPIRED";
      })("This stakeholder link has expired");
    }

    return link;
  }

  /**
   * Return full dashboard data for a share link token.
   * Increments access count and updates lastAccessedAt.
   */
  async getDashboardData(token: string) {
    const link = await this.getShareLink(token);
    if (!link) throw notFound("StakeholderLink");

    // Increment access count
    await this.db
      .update(stakeholderLinks)
      .set({
        accessCount: (link.accessCount ?? 0) + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(stakeholderLinks.id, link.id));

    // Fetch branding for this tenant
    const branding = await this.getBranding(link.tenantId);

    // Compliance scores — filtered by link's framework list if set
    const scoresQuery = this.db
      .select({
        framework: complianceScores.framework,
        score: complianceScores.score,
        passCount: complianceScores.passCount,
        partialCount: complianceScores.partialCount,
        failCount: complianceScores.failCount,
        naCount: complianceScores.naCount,
        totalControls: complianceScores.totalControls,
        snapshotAt: complianceScores.snapshotAt,
        scanId: complianceScores.scanId,
      })
      .from(complianceScores)
      .where(eq(complianceScores.tenantId, link.tenantId))
      .orderBy(desc(complianceScores.snapshotAt))
      .limit(100);

    let scores = await scoresQuery;

    // Filter to allowed frameworks if configured
    if (link.frameworks && link.frameworks.length > 0) {
      scores = scores.filter((s) => link.frameworks!.includes(s.framework));
    }

    // Deduplicate to latest score per framework
    const latestByFramework = new Map<string, typeof scores[number]>();
    for (const s of scores) {
      if (!latestByFramework.has(s.framework)) {
        latestByFramework.set(s.framework, s);
      }
    }
    const latestScores = Array.from(latestByFramework.values());

    // Risk trend — score history per framework (only if showTrend is set)
    let trend: Array<{ framework: string; score: number; snapshotAt: Date | null }> = [];
    if (link.showTrend) {
      const trendRows = await this.db
        .select({
          framework: complianceScores.framework,
          score: complianceScores.score,
          snapshotAt: complianceScores.snapshotAt,
        })
        .from(complianceScores)
        .where(eq(complianceScores.tenantId, link.tenantId))
        .orderBy(desc(complianceScores.snapshotAt))
        .limit(500);

      trend = link.frameworks && link.frameworks.length > 0
        ? trendRows.filter((r) => link.frameworks!.includes(r.framework))
        : trendRows;
    }

    // Remediation progress — only if showRemediation is set
    let remediationProgress: {
      total: number;
      completed: number;
      pending: number;
      failed: number;
    } | null = null;

    if (link.showRemediation) {
      const remediationRows = await this.db
        .select({
          status: remediations.status,
        })
        .from(remediations)
        .innerJoin(findings, eq(remediations.findingId, findings.id))
        .innerJoin(scans, eq(findings.scanId, scans.id))
        .where(eq(scans.tenantId, link.tenantId));

      const counts = { total: 0, completed: 0, pending: 0, failed: 0 };
      for (const r of remediationRows) {
        counts.total++;
        if (r.status === "completed") counts.completed++;
        else if (r.status === "failed" || r.status === "rolled_back") counts.failed++;
        else counts.pending++;
      }
      remediationProgress = counts;
    }

    return {
      link: {
        id: link.id,
        label: link.label,
        frameworks: link.frameworks,
        showRemediation: link.showRemediation,
        showTrend: link.showTrend,
        expiresAt: link.expiresAt,
      },
      branding,
      complianceScores: latestScores,
      trend: link.showTrend ? trend : undefined,
      remediationProgress: link.showRemediation ? remediationProgress : undefined,
    };
  }

  /**
   * Save or update branding configuration for a tenant.
   */
  async updateBranding(tenantId: string, options: UpdateBrandingOptions) {
    const [existing] = await this.db
      .select({ id: tenantBranding.id })
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenantId))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(tenantBranding)
        .set({
          logoUrl: options.logoUrl,
          primaryColor: options.primaryColor,
          secondaryColor: options.secondaryColor,
          companyName: options.companyName,
          tagline: options.tagline,
          updatedAt: new Date(),
        })
        .where(eq(tenantBranding.tenantId, tenantId))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(tenantBranding)
      .values({
        tenantId,
        logoUrl: options.logoUrl ?? null,
        primaryColor: options.primaryColor ?? "#FF4D00",
        secondaryColor: options.secondaryColor ?? "#F59E0B",
        companyName: options.companyName ?? null,
        tagline: options.tagline ?? null,
      })
      .returning();

    return created;
  }

  /**
   * Fetch branding configuration for a tenant.
   */
  async getBranding(tenantId: string) {
    const [branding] = await this.db
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenantId))
      .limit(1);

    return branding ?? null;
  }
}
