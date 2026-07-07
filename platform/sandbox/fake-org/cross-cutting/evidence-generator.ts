/**
 * evidence-generator.ts
 * Generates one evidence artifact per finding, deterministically.
 */

import { createHash } from "crypto";

export interface Finding {
  title: string;
  description?: string;
  severity: string;
  category: string;
  resourceType: string;
  resourceId: string;
  remediationTier?: string;
  autoFixAvailable?: boolean;
  controlMappings?: Array<{ framework: string; controlId: string; controlName: string; status: string; weight: number }>;
  cloud?: string;
  status?: string;
  id?: string;
}

export interface EvidenceArtifact {
  id: string;
  findingId: string;
  scanId: string;
  type: "config_snapshot" | "api_response" | "log_excerpt" | "policy_document" | "screenshot";
  storagePath: string;
  hash: string;
  size: number;
  collectedAt: string;
  collectedBy: string;
  verified: boolean;
  signature: string;
}

const EVIDENCE_TYPES: EvidenceArtifact["type"][] = [
  "config_snapshot",
  "api_response",
  "log_excerpt",
  "policy_document",
  "screenshot",
];

const AGENTS: Record<string, string> = {
  aws: "cloud-auditor-aws",
  azure: "cloud-auditor-azure",
  gcp: "cloud-auditor-gcp",
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function deterministicInt(seed: string, min: number, max: number): number {
  const h = parseInt(sha256(seed).slice(0, 8), 16);
  return min + (h % (max - min + 1));
}

function deterministicDate(seed: string, daysBack: number): string {
  const h = parseInt(sha256(seed + "date").slice(0, 6), 16);
  const offset = h % (daysBack * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - offset).toISOString();
}

function findingId(f: Finding, idx: number): string {
  return f.id || `f-${sha256(f.resourceId + f.title).slice(0, 8)}-${idx}`;
}

export function generateEvidence(findings: Finding[], scanId: string): EvidenceArtifact[] {
  return findings.map((finding, idx) => {
    const fid = findingId(finding, idx);
    const seed = sha256(fid + scanId);

    const typeIdx = parseInt(seed.slice(0, 2), 16) % EVIDENCE_TYPES.length;
    const type = EVIDENCE_TYPES[typeIdx];

    const cloud = finding.cloud || (finding.resourceId.startsWith("arn:aws") ? "aws" : finding.resourceId.startsWith("/subscriptions") ? "azure" : "gcp");
    const agent = AGENTS[cloud] || "cloud-auditor-aws";

    const resourceSlug = finding.resourceId
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(-40);

    const mockContent = JSON.stringify({
      finding: fid,
      resourceId: finding.resourceId,
      resourceType: finding.resourceType,
      category: finding.category,
      severity: finding.severity,
      capturedAt: deterministicDate(seed, 7),
      rawData: { type, detail: `Evidence for ${finding.title}` },
    });

    const contentHash = sha256(mockContent);
    const sigSeed = sha256(contentHash + agent + seed);

    return {
      id: `ev-${seed.slice(0, 12)}`,
      findingId: fid,
      scanId,
      type,
      storagePath: `/evidence/${finding.category}/${resourceSlug}.json`,
      hash: contentHash,
      size: deterministicInt(seed + "size", 1024, 65536),
      collectedAt: deterministicDate(seed + "col", 3),
      collectedBy: agent,
      verified: parseInt(seed.slice(2, 4), 16) % 5 !== 0, // 80% verified
      signature: `v1:sha256:${sigSeed.slice(0, 64)}`,
    };
  });
}
