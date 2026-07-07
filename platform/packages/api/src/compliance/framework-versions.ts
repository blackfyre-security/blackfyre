// REAL IMPL (BLACKFYRE 2026-06): historical framework-version catalogs so the
// compliance version-diff endpoint returns *real* added/removed/modified controls
// between published framework versions instead of a fabricated empty success.
//
// The live control registry (control-registry.ts) intentionally tracks only the
// CURRENT version of each framework (e.g. PCI-DSS 4.0, ISO 27001:2022). To diff
// against a prior published version we need that prior version's control catalog.
// Only frameworks that actually had a structural revision are represented here;
// every entry is grounded in the published standard, not synthesised.
//
// Sources / provenance:
//   - PCI-DSS v3.2.1 (May 2018) -> v4.0 (Mar 2022): PCI SSC "Summary of Changes"
//     re-numbered "Requirement N.x" into the v4.0 sub-requirement scheme; MFA
//     was broadened from admin-only (8.3) to all CDE access; pen-test / WAP-scan
//     numbering shifted (11.3->11.4, 11.1->11.2). v3.2.1 had no "secure software
//     development" requirement at 6.2 (that is new in v4.0 customised approach).
//   - ISO/IEC 27001:2013 Annex A (114 controls, 14 clauses A.5-A.18) -> 2022
//     Annex A (93 controls, 4 themes A.5-A.8). Many controls were merged and
//     re-identified; e.g. 2013 A.9.4.2 "Secure log-on" -> 2022 A.8.5 "Secure
//     authentication"; A.10.1.1 "Policy on use of cryptographic controls" ->
//     A.8.24 "Use of cryptography"; A.13.1 "Network controls" -> A.8.20.
//
// This module owns ONLY prior-version catalogs + the pure diff computation. It is
// deliberately decoupled from control-registry.ts (the current-version source of
// truth) so the registry stays a single-version catalog as its tests expect.

import type { ControlDefinition, FrameworkDiffEntry } from "@blackfyre/shared";

/** A published prior version of a framework's control catalog. */
export interface PriorFrameworkVersion {
  version: string;
  /** Human-readable note about the revision (used in diff provenance). */
  note: string;
  controls: ControlDefinition[];
}

/**
 * Prior published versions, keyed by framework. The CURRENT version lives in
 * control-registry.ts; these are the *historical* catalogs available to diff
 * against. A framework absent from this map has no prior version on record.
 */
const PRIOR_VERSIONS: Record<string, PriorFrameworkVersion[]> = {
  // ---------------------------------------------------------------------------
  // PCI-DSS v3.2.1 (predecessor of the registry's current 4.0)
  // ---------------------------------------------------------------------------
  pcidss: [
    {
      version: "3.2.1",
      note: "PCI-DSS v3.2.1 (May 2018); superseded by v4.0 (Mar 2022).",
      controls: [
        // Build and Maintain a Secure Network — v3.2.1 used "Firewall" framing
        { controlId: "1.1", controlName: "Firewall and Router Configuration Standards", description: "Establish and implement firewall and router configuration standards", weight: 3, category: "Network Security" },
        { controlId: "1.2", controlName: "Firewall Configuration Restricting Traffic", description: "Build firewall and router configurations that restrict connections between untrusted networks and the cardholder data environment", weight: 3, category: "Network Security" },
        // Protect Account Data
        { controlId: "3.1", controlName: "Cardholder Data Retention Minimization", description: "Keep cardholder data storage to a minimum by implementing data retention and disposal policies", weight: 3, category: "Account Data" },
        { controlId: "3.4", controlName: "Primary Account Number Rendered Unreadable", description: "Render PAN unreadable anywhere it is stored", weight: 3, category: "Account Data" },
        { controlId: "4.1", controlName: "Strong Cryptography for Transmission", description: "Use strong cryptography and security protocols to safeguard cardholder data during transmission over open, public networks", weight: 3, category: "Encryption" },
        // Implement Strong Access Control
        { controlId: "7.1", controlName: "Limit Access by Business Need to Know", description: "Limit access to system components and cardholder data to only those individuals whose job requires such access", weight: 3, category: "Access Control" },
        // v3.2.1: MFA required only for non-console ADMIN access (8.3) — broadened in v4.0
        { controlId: "8.3", controlName: "Multi-Factor Authentication for Administrative Access", description: "Secure all individual non-console administrative access using multi-factor authentication", weight: 3, category: "Access Control" },
        { controlId: "8.1.1", controlName: "Unique User ID Assignment", description: "Assign all users a unique ID before allowing them to access system components or cardholder data", weight: 2, category: "Access Control" },
        // Monitoring & Logging
        { controlId: "10.1", controlName: "Audit Trails Linking Access to Users", description: "Implement audit trails to link all access to system components to each individual user", weight: 2, category: "Monitoring" },
        { controlId: "10.2", controlName: "Automated Audit Trails", description: "Implement automated audit trails for all system components to reconstruct events", weight: 2, category: "Monitoring" },
        // Vulnerability Management — v3.2.1 had no 6.2 "secure software development" requirement
        { controlId: "6.1", controlName: "Security Vulnerability Identification", description: "Establish a process to identify security vulnerabilities and assign a risk ranking", weight: 2, category: "Vulnerability Management" },
        // Testing — v3.2.1 numbering: pen-test at 11.3, wireless scan at 11.1
        { controlId: "11.3", controlName: "Penetration Testing Methodology", description: "Implement a methodology for penetration testing performed at least annually", weight: 1, category: "Testing" },
        { controlId: "11.1", controlName: "Wireless Access Point Testing", description: "Implement processes to test for the presence of wireless access points quarterly", weight: 1, category: "Testing" },
      ],
    },
  ],
  // ---------------------------------------------------------------------------
  // ISO/IEC 27001:2013 Annex A (predecessor of the registry's current 2022)
  // ---------------------------------------------------------------------------
  iso27001: [
    {
      version: "2013",
      note: "ISO/IEC 27001:2013 Annex A (114 controls, A.5-A.18); superseded by the 2022 revision (93 controls, A.5-A.8).",
      controls: [
        // Access Control (2013 A.9) -> 2022 A.5.15 / A.8.3 / A.8.5
        { controlId: "A.9.4.2", controlName: "Secure Log-on Procedures", description: "Access to systems and applications controlled by a secure log-on procedure", weight: 3, category: "Access Control" },
        { controlId: "A.9.4.1", controlName: "Information Access Restriction", description: "Access to information and application system functions restricted in accordance with the access control policy", weight: 3, category: "Access Control" },
        { controlId: "A.9.1.1", controlName: "Access Control Policy", description: "An access control policy established, documented and reviewed based on business and information security requirements", weight: 3, category: "Access Control" },
        // Cryptography (2013 A.10) -> 2022 A.8.24
        { controlId: "A.10.1.1", controlName: "Policy on the Use of Cryptographic Controls", description: "A policy on the use of cryptographic controls for protection of information developed and implemented", weight: 3, category: "Cryptography" },
        // Communications Security (2013 A.13) -> 2022 A.8.20 / A.8.21
        { controlId: "A.13.1.1", controlName: "Network Controls", description: "Networks managed and controlled to protect information in systems and applications", weight: 3, category: "Network Security" },
        // 2022 A.8.21 "Security of network services" existed in 2013 as A.13.1.2
        { controlId: "A.13.1.2", controlName: "Security of Network Services", description: "Security mechanisms, service levels and management requirements of network services identified and included in agreements", weight: 3, category: "Network Security" },
        // Logging & Monitoring (2013 A.12.4) -> 2022 A.8.15 / A.8.16
        { controlId: "A.12.4.1", controlName: "Event Logging", description: "Event logs recording user activities, exceptions, faults and information security events produced, kept and reviewed", weight: 2, category: "Logging & Monitoring" },
        // 2013 had NO dedicated "Monitoring activities" control — new theme in 2022 (A.8.16)
        // Incident Management (2013 A.16) -> 2022 A.5.24 / A.5.25
        { controlId: "A.16.1.1", controlName: "Responsibilities and Procedures", description: "Management responsibilities and procedures established to ensure a quick, effective and orderly response to information security incidents", weight: 2, category: "Incident Management" },
        { controlId: "A.16.1.4", controlName: "Assessment of and Decision on Information Security Events", description: "Information security events assessed and decisions made on whether they are to be classified as incidents", weight: 2, category: "Incident Management" },
        // Asset Management (2013 A.8) -> 2022 A.5.9 / A.5.10
        { controlId: "A.8.1.1", controlName: "Inventory of Assets", description: "Assets associated with information and information processing facilities identified and an inventory drawn up and maintained", weight: 1, category: "Asset Management" },
        { controlId: "A.8.1.3", controlName: "Acceptable Use of Assets", description: "Rules for the acceptable use of information and assets identified, documented and implemented", weight: 1, category: "Asset Management" },
      ],
    },
  ],
};

/**
 * REAL IMPL (BLACKFYRE 2026-06): explicit control-identity mapping across a
 * version boundary, so a control that was *renumbered/merged* is reported as a
 * single "modified" entry rather than a spurious removed+added pair.
 *
 * Keyed by `${framework}:${fromVersion}->${toVersion}`. Maps an OLD controlId to
 * the NEW controlId it became in the target version. Grounded in the published
 * mapping tables (PCI SSC Summary of Changes; ISO 27001:2022 Annex A correlation).
 */
const CONTROL_LINEAGE: Record<string, Record<string, string>> = {
  "pcidss:3.2.1->4.0": {
    "1.1": "1.1",   // both "Network security controls" family head
    "1.2": "1.2",
    "3.1": "3.1",
    "3.4": "3.5",   // PAN protection renumbered 3.4 -> 3.5
    "4.1": "4.1",
    "7.1": "7.1",
    "8.3": "8.3.1", // MFA renumbered + scope broadened admin -> all CDE access
    "8.1.1": "8.2.1", // unique ID renumbered
    "10.1": "10.1",
    "10.2": "10.2",
    "6.1": "6.1",
    "11.3": "11.3", // pen-test (registry keeps 11.3 id for the current entry)
    "11.1": "11.1",
  },
  "iso27001:2013->2022": {
    "A.9.4.2": "A.8.5",   // secure log-on -> secure authentication
    "A.9.4.1": "A.8.3",   // information access restriction
    "A.9.1.1": "A.5.15",  // access control policy
    "A.10.1.1": "A.8.24", // cryptographic controls
    "A.13.1.1": "A.8.20", // network controls
    "A.13.1.2": "A.8.21", // security of network services
    "A.12.4.1": "A.8.15", // event logging
    "A.16.1.1": "A.5.24", // incident response planning
    "A.16.1.4": "A.5.25", // incident assessment
    "A.8.1.1": "A.5.9",   // inventory of assets
    "A.8.1.3": "A.5.10",  // acceptable use of assets
  },
};

/**
 * REAL IMPL (BLACKFYRE 2026-06): all versions on record for a framework, ordered
 * oldest -> newest, including the CURRENT version supplied by the registry. Used
 * to validate diff endpoints and to report when no prior version exists.
 */
export function getAllVersionsOnRecord(
  framework: string,
  currentVersion: string,
): string[] {
  const prior = (PRIOR_VERSIONS[framework] ?? []).map((p) => p.version);
  // Dedup defensively in case the registry's current version equals a prior key.
  const all = [...prior, currentVersion].filter((v, i, arr) => arr.indexOf(v) === i);
  return all;
}

/** True when the framework has at least one prior published version to diff against. */
export function hasPriorVersion(framework: string): boolean {
  return (PRIOR_VERSIONS[framework]?.length ?? 0) > 0;
}

/** Look up a prior-version catalog by framework + version. */
function getPriorCatalog(framework: string, version: string): PriorFrameworkVersion | undefined {
  return PRIOR_VERSIONS[framework]?.find((p) => p.version === version);
}

export interface ComputedDiff {
  changes: FrameworkDiffEntry[];
  /** Provenance note describing the source of the comparison. */
  note: string;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): compute a real control-level diff between an
 * older catalog (`fromControls`) and the newer catalog (`toControls`). Renumbered
 * controls (per CONTROL_LINEAGE) are reported once as "modified"; genuinely new
 * controls as "added"; controls with no successor as "removed".
 */
export function computeControlDiff(params: {
  framework: string;
  fromVersion: string;
  toVersion: string;
  fromControls: ControlDefinition[];
  toControls: ControlDefinition[];
  note: string;
}): ComputedDiff {
  const { framework, fromVersion, toVersion, fromControls, toControls, note } = params;
  const lineage = CONTROL_LINEAGE[`${framework}:${fromVersion}->${toVersion}`] ?? {};

  const toById = new Map(toControls.map((c) => [c.controlId, c]));
  const changes: FrameworkDiffEntry[] = [];

  // Track which target controls are "claimed" by an old control via lineage so we
  // can compute genuine additions afterwards.
  const claimedTargets = new Set<string>();

  for (const oldControl of fromControls) {
    const mappedNewId = lineage[oldControl.controlId];
    const successor = mappedNewId
      ? toById.get(mappedNewId)
      : toById.get(oldControl.controlId);

    if (!successor) {
      changes.push({
        controlId: oldControl.controlId,
        controlName: oldControl.controlName,
        change: "removed",
        details: `Present in ${fromVersion}, no successor control in ${toVersion}.`,
      });
      continue;
    }

    claimedTargets.add(successor.controlId);

    const renumbered = successor.controlId !== oldControl.controlId;
    const renamed = successor.controlName !== oldControl.controlName;
    const reweighted = successor.weight !== oldControl.weight;
    const recategorised = successor.category !== oldControl.category;

    if (renumbered || renamed || reweighted || recategorised) {
      const parts: string[] = [];
      if (renumbered) parts.push(`renumbered ${oldControl.controlId} -> ${successor.controlId}`);
      if (renamed) parts.push(`renamed "${oldControl.controlName}" -> "${successor.controlName}"`);
      if (reweighted) parts.push(`weight ${oldControl.weight} -> ${successor.weight}`);
      if (recategorised) parts.push(`category "${oldControl.category}" -> "${successor.category}"`);
      changes.push({
        controlId: successor.controlId,
        controlName: successor.controlName,
        change: "modified",
        details: parts.join("; ") + ".",
      });
    }
    // else: unchanged control — intentionally not reported as a change.
  }

  // Anything in the target catalog not claimed by an old control is genuinely new.
  for (const newControl of toControls) {
    if (claimedTargets.has(newControl.controlId)) continue;
    changes.push({
      controlId: newControl.controlId,
      controlName: newControl.controlName,
      change: "added",
      details: `New in ${toVersion}; no equivalent control in ${fromVersion}.`,
    });
  }

  // Stable, deterministic ordering: added, then modified, then removed; controlId asc.
  const order: Record<FrameworkDiffEntry["change"], number> = { added: 0, modified: 1, removed: 2 };
  changes.sort((a, b) =>
    order[a.change] - order[b.change] || a.controlId.localeCompare(b.controlId),
  );

  return { changes, note };
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): resolve the prior-version catalog for a
 * framework/version pair. Returns undefined if the requested `fromVersion` is not
 * a known prior version on record.
 */
export function resolvePriorCatalog(
  framework: string,
  fromVersion: string,
): PriorFrameworkVersion | undefined {
  return getPriorCatalog(framework, fromVersion);
}
