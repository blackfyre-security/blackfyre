import type { Framework, ControlStatus } from "./control-mapping.js";
import type { IndustryProfile } from "./tenant.js";

export interface ControlDefinition {
  controlId: string;
  controlName: string;
  description: string;
  weight: 1 | 2 | 3; // standard, important, critical
  category: string;   // grouping within framework (e.g., "Access Control", "Encryption")
}

export interface FrameworkRegistry {
  framework: Framework;
  version: string;
  totalControls: number;
  controls: ControlDefinition[];
}

export interface FrameworkScore {
  framework: Framework;
  score: number;          // 0-100 weighted percentage
  passCount: number;
  partialCount: number;
  failCount: number;
  naCount: number;
  totalControls: number;
  evaluatedControls: number;
}

export interface ComplianceScoreSnapshot {
  id: string;
  tenantId: string;
  scanId: string;
  framework: Framework;
  score: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  naCount: number;
  totalControls: number;
  snapshotAt: Date;
}

export interface ControlMatrixEntry {
  controlId: string;
  controlName: string;
  weight: 1 | 2 | 3;
  category: string;
  status: ControlStatus | "not_evaluated";
  findingIds: string[];    // findings that map to this control
  evidenceCount: number;
}

export interface ComplianceMatrix {
  framework: Framework;
  version: string;
  score: number;
  entries: ControlMatrixEntry[];
}

export interface ComplianceTrendPoint {
  scanId: string;
  score: number;
  snapshotAt: Date;
}

export interface ComplianceTrend {
  framework: Framework;
  points: ComplianceTrendPoint[];
}

export interface FrameworkDiffEntry {
  controlId: string;
  controlName: string;
  change: "added" | "removed" | "modified";
  details: string;
}

export interface FrameworkDiff {
  framework: Framework;
  fromVersion: string;
  toVersion: string;
  changes: FrameworkDiffEntry[];
}

export interface IndustryBaselineProfile {
  id: IndustryProfile;
  name: string;
  priorityFrameworks: Framework[];
  focusAreas: string[];
}
