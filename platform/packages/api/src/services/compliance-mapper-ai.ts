/**
 * AI Compliance Mapper — Maps AI-related check types to ISO 42001
 * compliance control mappings for AI governance assessment.
 */

import type { ControlMappingEntry } from "./compliance-mapper-aws.js";

type AI42001Framework = "iso42001";

function m(controlId: string, controlName: string, weight: number): ControlMappingEntry {
  return { framework: "iso42001" as any, controlId, controlName, status: "fail", weight };
}

// ---------------------------------------------------------------------------
// AI Governance check types (20)
// ---------------------------------------------------------------------------

const missing_ai_inventory: ControlMappingEntry[] = [
  m("AI-4.1", "AI System Inventory", 3),
];

const no_ai_governance_policy: ControlMappingEntry[] = [
  m("AI-5.1", "AI Governance Policy", 3),
  m("AI-5.2", "AI Roles and Responsibilities", 2),
];

const missing_ai_risk_assessment: ControlMappingEntry[] = [
  m("AI-6.1", "AI Risk Assessment", 3),
  m("AI-6.2", "AI Risk Treatment Plan", 3),
];

const missing_ai_training: ControlMappingEntry[] = [
  m("AI-7.1", "AI Competence and Training", 2),
  m("AI-7.2", "AI Awareness Program", 1),
];

const no_ai_lifecycle: ControlMappingEntry[] = [
  m("AI-8.1", "AI System Development Lifecycle", 3),
];

const data_quality_issues: ControlMappingEntry[] = [
  m("AI-8.2", "Data Quality Management", 3),
  m("AI-A.7", "AI Data Provenance", 2),
];

const no_model_validation: ControlMappingEntry[] = [
  m("AI-8.3", "Model Validation and Testing", 3),
];

const no_ai_monitoring: ControlMappingEntry[] = [
  m("AI-8.4", "AI System Monitoring", 2),
];

const missing_performance_eval: ControlMappingEntry[] = [
  m("AI-9.1", "AI Performance Evaluation", 2),
];

const no_internal_audit: ControlMappingEntry[] = [
  m("AI-9.2", "Internal Audit of AI Systems", 2),
];

const no_ai_incident_process: ControlMappingEntry[] = [
  m("AI-10.1", "AI Incident Management", 3),
];

const missing_impact_assessment: ControlMappingEntry[] = [
  m("AI-A.2", "AI Impact Assessment", 3),
];

const missing_model_documentation: ControlMappingEntry[] = [
  m("AI-A.3", "AI Transparency and Explainability", 3),
];

const no_bias_testing: ControlMappingEntry[] = [
  m("AI-A.4", "AI Fairness and Bias Prevention", 3),
];

const no_human_oversight: ControlMappingEntry[] = [
  m("AI-A.5", "Human Oversight of AI", 3),
];

const third_party_ai_unmanaged: ControlMappingEntry[] = [
  m("AI-A.6", "Third-Party AI Management", 2),
];

const no_data_provenance: ControlMappingEntry[] = [
  m("AI-A.7", "AI Data Provenance", 2),
  m("AI-8.2", "Data Quality Management", 3),
];

const ai_privacy_gaps: ControlMappingEntry[] = [
  m("AI-A.8", "AI Privacy Protection", 3),
];

const no_ai_roles_defined: ControlMappingEntry[] = [
  m("AI-5.2", "AI Roles and Responsibilities", 2),
  m("AI-5.1", "AI Governance Policy", 3),
];

const no_risk_treatment: ControlMappingEntry[] = [
  m("AI-6.2", "AI Risk Treatment Plan", 3),
];

// ---------------------------------------------------------------------------
// Exports matching the pattern of AWS/Azure/GCP mappers
// ---------------------------------------------------------------------------

export const AI_COMPLIANCE_MAP: Record<string, ControlMappingEntry[]> = {
  missing_ai_inventory,
  no_ai_governance_policy,
  missing_ai_risk_assessment,
  missing_ai_training,
  no_ai_lifecycle,
  data_quality_issues,
  no_model_validation,
  no_ai_monitoring,
  missing_performance_eval,
  no_internal_audit,
  no_ai_incident_process,
  missing_impact_assessment,
  missing_model_documentation,
  no_bias_testing,
  no_human_oversight,
  third_party_ai_unmanaged,
  no_data_provenance,
  ai_privacy_gaps,
  no_ai_roles_defined,
  no_risk_treatment,
};

export const KNOWN_AI_CHECK_TYPES: string[] = Object.keys(AI_COMPLIANCE_MAP);
