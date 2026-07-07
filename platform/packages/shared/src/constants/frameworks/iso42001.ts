/* ------------------------------------------------------------------ */
/*  ISO 42001:2023 — AI Management System Controls                     */
/* ------------------------------------------------------------------ */

export interface ISO42001SubControl {
  id: string;
  title: string;
  description: string;
  evidenceRequirements: string[];
}

export interface ISO42001Control {
  id: string;
  title: string;
  clause: string;
  description: string;
  subControls: ISO42001SubControl[];
  evidenceRequirements: string[];
  commonFindings: string[];
  remediationPatterns: string[];
}

export const ISO42001_CONTROLS: ISO42001Control[] = [
  // CLAUSE 4 — Context of the Organization
  {
    id: "4.1", title: "Understanding the Organization and Its Context", clause: "4",
    description: "Determine internal and external issues relevant to AI management system purpose and strategic direction",
    subControls: [
      { id: "4.1.1", title: "AI System Inventory", description: "Maintain a complete register of all AI systems", evidenceRequirements: ["AI system register", "System classification records"] },
      { id: "4.1.2", title: "Stakeholder Impact Assessment", description: "Assess impact of AI systems on interested parties", evidenceRequirements: ["Stakeholder impact matrix", "Community impact reports"] },
      { id: "4.1.3", title: "Regulatory Landscape", description: "Identify applicable AI regulations and requirements", evidenceRequirements: ["Regulatory register", "Compliance gap analysis"] },
    ],
    evidenceRequirements: ["AI system inventory", "Stakeholder impact assessment", "Regulatory landscape analysis", "PESTLE analysis for AI context"],
    commonFindings: ["No AI system inventory maintained", "Missing stakeholder analysis", "Regulatory requirements not tracked"],
    remediationPatterns: ["Create and maintain AI system register", "Conduct stakeholder impact assessments annually", "Establish regulatory monitoring process"],
  },
  {
    id: "4.2", title: "Understanding Needs and Expectations of Interested Parties", clause: "4",
    description: "Determine interested parties relevant to AIMS and their requirements",
    subControls: [
      { id: "4.2.1", title: "Stakeholder Identification", description: "Identify all parties affected by AI systems", evidenceRequirements: ["Stakeholder register", "Communication protocols"] },
    ],
    evidenceRequirements: ["Stakeholder register", "Requirements matrix", "Communication plan"],
    commonFindings: ["Incomplete stakeholder identification", "No formal communication protocol"],
    remediationPatterns: ["Map all stakeholders including end-users, regulators, and affected communities"],
  },
  {
    id: "4.3", title: "Determining the Scope of the AIMS", clause: "4",
    description: "Determine boundaries and applicability of AI management system",
    subControls: [
      { id: "4.3.1", title: "AI System Boundary Definition", description: "Define clear boundaries for each AI system", evidenceRequirements: ["System boundary documents", "Data flow diagrams"] },
    ],
    evidenceRequirements: ["AIMS scope statement", "AI system boundary definitions", "Data flow mapping"],
    commonFindings: ["Scope too narrow — excludes third-party AI", "Missing data flow documentation"],
    remediationPatterns: ["Include all AI systems including third-party APIs", "Document complete data flows"],
  },
  {
    id: "4.4", title: "AI Management System", clause: "4",
    description: "Establish, implement, maintain and continually improve an AIMS",
    subControls: [],
    evidenceRequirements: ["AIMS documentation", "Process integration evidence", "Continuous improvement records"],
    commonFindings: ["AIMS exists only on paper", "No integration with existing QMS/ISMS"],
    remediationPatterns: ["Integrate AIMS with existing management systems", "Establish continuous improvement cycle"],
  },

  // CLAUSE 5 — Leadership
  {
    id: "5.1", title: "Leadership and Commitment", clause: "5",
    description: "Top management shall demonstrate leadership and commitment to the AIMS",
    subControls: [
      { id: "5.1.1", title: "Management Review Records", description: "Evidence of management engagement with AIMS", evidenceRequirements: ["Meeting minutes", "Decision records", "Resource allocation approvals"] },
    ],
    evidenceRequirements: ["Management review minutes", "Resource allocation evidence", "Leadership communication records"],
    commonFindings: ["No evidence of management review", "Insufficient resource allocation for AI governance"],
    remediationPatterns: ["Schedule quarterly management reviews", "Allocate dedicated AI governance budget"],
  },
  {
    id: "5.2", title: "AI Policy", clause: "5",
    description: "Establish an AI policy appropriate to the organization's purpose",
    subControls: [
      { id: "5.2.1", title: "Policy Statement", description: "Documented AI policy aligned with organizational values", evidenceRequirements: ["AI policy document", "Board approval records"] },
      { id: "5.2.2", title: "Communication Evidence", description: "Policy communicated to all relevant parties", evidenceRequirements: ["Distribution records", "Acknowledgment logs"] },
    ],
    evidenceRequirements: ["AI policy document", "Approval records", "Distribution evidence", "Acknowledgment logs"],
    commonFindings: ["No formal AI policy", "Policy not communicated to all staff"],
    remediationPatterns: ["Draft AI policy covering ethical principles, risk management, and accountability"],
  },
  {
    id: "5.3", title: "Organizational Roles, Responsibilities and Authorities", clause: "5",
    description: "Assign and communicate responsibilities and authorities for AIMS roles",
    subControls: [
      { id: "5.3.1", title: "RACI Matrix", description: "Clear responsibility assignment for AI governance", evidenceRequirements: ["RACI matrix", "Role descriptions"] },
      { id: "5.3.2", title: "AI Ethics Committee", description: "Establish ethics oversight body", evidenceRequirements: ["Committee charter", "Member list", "Meeting records"] },
    ],
    evidenceRequirements: ["RACI matrix for AI governance", "AI ethics committee charter", "Role descriptions"],
    commonFindings: ["No clear AI governance roles", "No ethics committee established"],
    remediationPatterns: ["Create RACI matrix", "Establish AI ethics committee with charter"],
  },

  // CLAUSE 6 — Planning
  {
    id: "6.1", title: "Actions to Address Risks and Opportunities", clause: "6",
    description: "Determine AI-specific risks and opportunities requiring action",
    subControls: [
      { id: "6.1.1", title: "AI Risk Register", description: "Comprehensive risk register for AI systems", evidenceRequirements: ["Risk register", "Risk assessment methodology"] },
      { id: "6.1.2", title: "Risk Treatment Plans", description: "Plans to address identified AI risks", evidenceRequirements: ["Treatment plans", "Residual risk acceptance records"] },
    ],
    evidenceRequirements: ["AI risk register", "Risk treatment plans", "Residual risk acceptance records", "Opportunity assessment"],
    commonFindings: ["No AI-specific risk register", "Missing bias risk assessment", "No treatment plans for identified risks"],
    remediationPatterns: ["Create AI risk register covering bias, fairness, safety, privacy", "Implement risk treatment per ISO 31000"],
  },
  {
    id: "6.2", title: "AI Objectives and Planning to Achieve Them", clause: "6",
    description: "Establish measurable AI management objectives",
    subControls: [
      { id: "6.2.1", title: "Measurable Objectives", description: "SMART objectives for AI management", evidenceRequirements: ["Objectives document", "KPIs and metrics"] },
    ],
    evidenceRequirements: ["AI objectives document", "KPIs", "Monitoring metrics", "Achievement timelines"],
    commonFindings: ["Objectives not measurable", "No monitoring metrics defined"],
    remediationPatterns: ["Define SMART objectives for each AI system", "Establish KPIs for AI performance and ethics"],
  },

  // CLAUSE 7 — Support
  {
    id: "7.1", title: "Resources", clause: "7",
    description: "Determine and provide resources needed for the AIMS",
    subControls: [],
    evidenceRequirements: ["Resource allocation records", "Budget documentation", "Staffing plans"],
    commonFindings: ["Insufficient AI governance staffing", "No dedicated budget"],
    remediationPatterns: ["Allocate dedicated AI governance resources"],
  },
  {
    id: "7.2", title: "Competence", clause: "7",
    description: "Determine necessary competence for AI management roles",
    subControls: [
      { id: "7.2.1", title: "AI Training Program", description: "Training program for AI-related competencies", evidenceRequirements: ["Training program documentation", "Completion records"] },
      { id: "7.2.2", title: "Competency Assessments", description: "Assessment of AI governance competencies", evidenceRequirements: ["Assessment records", "Skill gap analysis"] },
    ],
    evidenceRequirements: ["Competency requirements", "Training records", "Assessment results"],
    commonFindings: ["No AI-specific training program", "Missing competency assessments"],
    remediationPatterns: ["Implement AI ethics and governance training", "Conduct annual competency assessments"],
  },

  // CLAUSE 8 — Operation
  {
    id: "8.1", title: "Operational Planning and Control", clause: "8",
    description: "Plan, implement and control processes for AI system lifecycle",
    subControls: [
      { id: "8.1.1", title: "AI Development Lifecycle", description: "Documented lifecycle management for AI systems", evidenceRequirements: ["Lifecycle documentation", "Stage gate criteria"] },
    ],
    evidenceRequirements: ["AI development lifecycle documentation", "Change management procedures", "Operational controls"],
    commonFindings: ["No formal AI development lifecycle", "Missing change management for AI models"],
    remediationPatterns: ["Establish AI development lifecycle with stage gates"],
  },
  {
    id: "8.2", title: "AI Risk Assessment", clause: "8",
    description: "Perform AI risk assessment per defined methodology",
    subControls: [
      { id: "8.2.1", title: "Per-System Risk Assessment", description: "Individual risk assessment for each AI system", evidenceRequirements: ["Risk assessment reports per system", "Scoring methodology"] },
    ],
    evidenceRequirements: ["Per-system risk assessments", "Impact classifications", "Scoring methodology documentation"],
    commonFindings: ["No per-system risk assessment conducted", "Missing impact classification methodology"],
    remediationPatterns: ["Conduct risk assessment for each AI system using defined methodology"],
  },
  {
    id: "8.3", title: "AI Risk Treatment", clause: "8",
    description: "Implement AI risk treatment plans",
    subControls: [],
    evidenceRequirements: ["Treatment implementation evidence", "Control effectiveness testing results"],
    commonFindings: ["Risk treatment plans not implemented", "No effectiveness testing"],
    remediationPatterns: ["Implement all risk treatment plans", "Test control effectiveness quarterly"],
  },
  {
    id: "8.4", title: "AI System Impact Assessment", clause: "8",
    description: "Assess impact of AI systems on individuals, groups and society",
    subControls: [
      { id: "8.4.1", title: "Social Impact", description: "Assessment of societal impact of AI systems", evidenceRequirements: ["Social impact report", "Community feedback"] },
      { id: "8.4.2", title: "Fairness Assessment", description: "Bias and fairness evaluation of AI outputs", evidenceRequirements: ["Fairness metrics", "Bias testing results", "Demographic parity analysis"] },
      { id: "8.4.3", title: "Safety Evaluation", description: "Safety assessment for AI system failures", evidenceRequirements: ["Safety assessment report", "Failure mode analysis"] },
    ],
    evidenceRequirements: ["Impact assessment reports", "Fairness metrics", "Safety evaluations", "Environmental impact"],
    commonFindings: ["No impact assessment conducted", "Missing fairness/bias metrics", "No safety evaluation for AI failures"],
    remediationPatterns: ["Conduct AI Impact Assessment (AIIA) per system", "Implement fairness monitoring with demographic parity checks"],
  },

  // CLAUSE 9 — Performance Evaluation
  {
    id: "9.1", title: "Monitoring, Measurement, Analysis and Evaluation", clause: "9",
    description: "Determine what needs to be monitored and measured for AI systems",
    subControls: [
      { id: "9.1.1", title: "AI Performance Metrics", description: "Metrics for AI system performance monitoring", evidenceRequirements: ["Performance dashboards", "Metric definitions", "Threshold documentation"] },
      { id: "9.1.2", title: "Bias Monitoring", description: "Continuous monitoring for AI bias and drift", evidenceRequirements: ["Bias monitoring reports", "Drift detection logs"] },
    ],
    evidenceRequirements: ["AI performance metrics", "Bias monitoring reports", "Drift detection logs", "Analysis reports"],
    commonFindings: ["No continuous AI monitoring", "Missing bias detection", "No performance baselines"],
    remediationPatterns: ["Implement real-time AI performance monitoring", "Deploy bias detection pipeline"],
  },
  {
    id: "9.2", title: "Internal Audit", clause: "9",
    description: "Conduct internal audits of the AIMS at planned intervals",
    subControls: [],
    evidenceRequirements: ["Audit program", "Auditor competence records", "Audit findings and reports"],
    commonFindings: ["No AIMS audit program", "Auditors not trained in AI governance"],
    remediationPatterns: ["Establish annual AIMS audit program", "Train auditors on ISO 42001 requirements"],
  },
  {
    id: "9.3", title: "Management Review", clause: "9",
    description: "Top management shall review the AIMS at planned intervals",
    subControls: [],
    evidenceRequirements: ["Management review inputs", "Review outputs", "Improvement decisions"],
    commonFindings: ["No management review conducted", "Reviews lack AI-specific agenda items"],
    remediationPatterns: ["Include AI governance in quarterly management reviews"],
  },

  // CLAUSE 10 — Improvement
  {
    id: "10.1", title: "Continual Improvement", clause: "10",
    description: "Continually improve the suitability, adequacy and effectiveness of the AIMS",
    subControls: [],
    evidenceRequirements: ["Improvement opportunities register", "Implementation tracking"],
    commonFindings: ["No formal improvement process", "Improvement not tracked"],
    remediationPatterns: ["Establish improvement register", "Track and verify improvements"],
  },
  {
    id: "10.2", title: "Nonconformity and Corrective Action", clause: "10",
    description: "React to nonconformities and take corrective action",
    subControls: [
      { id: "10.2.1", title: "NCR Process", description: "Non-conformity report identification and handling", evidenceRequirements: ["NCR register", "Root cause analysis records"] },
      { id: "10.2.2", title: "CAPA Records", description: "Corrective and preventive action tracking", evidenceRequirements: ["CAPA register", "Effectiveness verification records"] },
    ],
    evidenceRequirements: ["NCR register", "Root cause analysis", "CAPA records", "Effectiveness verification"],
    commonFindings: ["No NCR process for AI issues", "Missing root cause analysis"],
    remediationPatterns: ["Implement NCR process for AI nonconformities", "Conduct RCA for all AI incidents"],
  },

  // ANNEX A Controls
  {
    id: "A.2", title: "AI Policies", clause: "Annex A",
    description: "Policies for AI including ethical AI use, data governance, and responsible AI development",
    subControls: [],
    evidenceRequirements: ["AI policy suite", "Acceptable use policy for AI", "Data governance policy"],
    commonFindings: ["No comprehensive AI policy suite", "Missing acceptable use policy"],
    remediationPatterns: ["Develop AI policy suite covering ethics, data, development, deployment, monitoring"],
  },
  {
    id: "A.5", title: "AI System Lifecycle", clause: "Annex A",
    description: "Controls for AI system design, development, deployment, and retirement",
    subControls: [
      { id: "A.5.1", title: "Design Controls", description: "Controls applied during AI system design", evidenceRequirements: ["Design review records", "Requirements specifications"] },
      { id: "A.5.2", title: "Development Controls", description: "Controls for AI model development and training", evidenceRequirements: ["Development standards", "Code review records", "Testing evidence"] },
      { id: "A.5.3", title: "Deployment Controls", description: "Controls for AI system deployment", evidenceRequirements: ["Deployment procedures", "Go-live checklists", "Rollback plans"] },
    ],
    evidenceRequirements: ["Lifecycle management documentation", "Stage-gate criteria", "Retirement procedures"],
    commonFindings: ["No formal lifecycle management", "Missing retirement procedures"],
    remediationPatterns: ["Implement AI system lifecycle with stage gates from design through retirement"],
  },
  {
    id: "A.6", title: "Data for AI Systems", clause: "Annex A",
    description: "Data governance, quality, and provenance for AI systems",
    subControls: [
      { id: "A.6.1", title: "Data Governance", description: "Governance framework for AI training and inference data", evidenceRequirements: ["Data governance policy", "Data classification scheme"] },
      { id: "A.6.2", title: "Data Quality", description: "Quality assurance for AI data", evidenceRequirements: ["Data quality metrics", "Validation procedures"] },
      { id: "A.6.3", title: "Data Provenance", description: "Traceability of data used in AI systems", evidenceRequirements: ["Provenance records", "Data lineage documentation"] },
    ],
    evidenceRequirements: ["Data governance framework", "Quality metrics", "Provenance documentation"],
    commonFindings: ["No data governance for AI", "Missing data provenance", "No quality validation"],
    remediationPatterns: ["Establish AI data governance framework", "Implement data lineage tracking"],
  },
  {
    id: "A.7", title: "Transparency and Disclosure", clause: "Annex A",
    description: "Transparency and disclosure about AI systems to interested parties",
    subControls: [],
    evidenceRequirements: ["Transparency reports", "Disclosure statements", "User notification records"],
    commonFindings: ["No transparency about AI usage", "Users not informed of AI decisions"],
    remediationPatterns: ["Publish AI transparency report", "Notify users when AI influences decisions"],
  },
  {
    id: "A.8", title: "Use of AI Systems", clause: "Annex A",
    description: "Controls for acceptable use, monitoring, and incident management of AI systems",
    subControls: [],
    evidenceRequirements: ["Acceptable use policy", "Monitoring procedures", "Incident response for AI"],
    commonFindings: ["No acceptable use policy for AI", "No AI incident response procedure"],
    remediationPatterns: ["Create AI acceptable use policy", "Establish AI incident response procedure"],
  },
  {
    id: "A.9", title: "Third-Party and Customer Relationships", clause: "Annex A",
    description: "Managing AI-related risks in third-party and customer relationships",
    subControls: [],
    evidenceRequirements: ["Third-party AI register", "Vendor risk assessments", "Contract requirements"],
    commonFindings: ["Third-party AI not assessed", "Missing contractual AI requirements"],
    remediationPatterns: ["Assess all third-party AI providers", "Include AI governance requirements in contracts"],
  },
];

export const ISO42001_CLAUSE_TITLES: Record<string, string> = {
  "4": "Context of the Organization",
  "5": "Leadership",
  "6": "Planning",
  "7": "Support",
  "8": "Operation",
  "9": "Performance Evaluation",
  "10": "Improvement",
  "Annex A": "Annex A Controls",
};
