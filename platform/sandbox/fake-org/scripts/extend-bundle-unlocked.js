// Extends scan-bundle.json with sections for the unlocked tier-2/3 pages:
// autopilot, incidents, copilot, calendar, regulatory, aiGovernance.
// Idempotent — re-runs overwrite the listed keys only.
const fs = require('fs');
const path = require('path');

const BUNDLE = path.resolve(__dirname, '..', 'scan-bundle.json');
// Optional: also mirror the bundle to a second location (set HARNESS_BUNDLE_PATH).
const HARNESS = process.env.HARNESS_BUNDLE_PATH;

const b = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));

b.autopilot = {
  frameworks: [
    { name: 'SOC 2',     enabled: true,  scanFreq: 'weekly',   autoFix: 'low severity', nextScan: '2026-05-14', cost: '$12.50/mo' },
    { name: 'ISO 27001', enabled: true,  scanFreq: 'biweekly', autoFix: 'off',          nextScan: '2026-05-21', cost: '$8.00/mo'  },
    { name: 'HIPAA',     enabled: true,  scanFreq: 'monthly',  autoFix: 'off',          nextScan: '2026-06-01', cost: '$6.00/mo'  },
    { name: 'PCI DSS',   enabled: true,  scanFreq: 'monthly',  autoFix: 'off',          nextScan: '2026-06-05', cost: '$10.00/mo' },
    { name: 'ISO 42001', enabled: false, scanFreq: '—',        autoFix: '—',            nextScan: '—',          cost: '—'         },
    { name: 'DPDPA',     enabled: false, scanFreq: '—',        autoFix: '—',            nextScan: '—',          cost: '—'         },
  ],
  agentActivity: [
    { agent: 'SCOUT',  color: '#4ade80', action: 'Completed weekly SOC 2 scan — 3 new findings',           time: '2h ago'  },
    { agent: 'SHIELD', color: '#60a5fa', action: 'Mapped 3 findings to SOC 2 controls',                    time: '2h ago'  },
    { agent: 'HELIX',  color: '#c084fc', action: 'Auto-fixed 1 low-severity finding (S3 versioning)',      time: '1h ago'  },
    { agent: 'LEDGER', color: '#f97316', action: 'Collected 12 evidence artifacts for SOC 2',              time: '1h ago'  },
    { agent: 'SIGNAL', color: '#ef4444', action: 'Alerted: 2 findings require human review',               time: '45m ago' },
    { agent: 'CORTEX', color: '#818cf8', action: 'Updated compliance score: 78% → 79%',                    time: '40m ago' },
    { agent: 'PULSE',  color: '#fbbf24', action: 'Monitoring — no drift detected since last scan',          time: '30m ago' },
    { agent: 'SCOUT',  color: '#4ade80', action: 'ISO 27001 scan scheduled for 2026-05-21',                time: '20m ago' },
  ],
  effectiveness: {
    manualHoursSaved: 42,
    autoFixesApplied: 8,
    evidenceCollected: 156,
    complianceScoreMaintained: '78%+',
    driftEventsHandled: 12,
  },
  cost: {
    monthlyBudget: 100.00,
    usedMtd: 20.50,
    usedPct: 21,
    perAgent: { SCOUT: 8.20, SHIELD: 4.10, HELIX: 3.80, CORTEX: 4.40 },
  },
};

b.incidents = {
  list: [
    { id: 'INC-0001', title: 'Critical S3 Public Access Detected',          severity: 'p1', source: 'scout',  status: 'investigating', sla: 30,  response: 12,  created: '2026-05-07T04:00:00Z' },
    { id: 'INC-0002', title: 'IAM Root Account Activity Anomaly',           severity: 'p1', source: 'pulse',  status: 'triaged',       sla: 30,  response: 8,   created: '2026-05-07T03:00:00Z' },
    { id: 'INC-0003', title: 'Compliance Score Drop >10% in 24h',           severity: 'p2', source: 'signal', status: 'resolved',      sla: 120, response: 45,  created: '2026-05-06T06:00:00Z' },
    { id: 'INC-0004', title: 'Unauthorized Security Group Change',          severity: 'p2', source: 'pulse',  status: 'resolved',      sla: 120, response: 90,  created: '2026-05-05T06:00:00Z' },
    { id: 'INC-0005', title: 'CVE-2026-90001 Matched to EKS Cluster',       severity: 'p3', source: 'signal', status: 'resolved',      sla: 480, response: 120, created: '2026-05-02T06:00:00Z' },
    { id: 'INC-0006', title: 'Evidence Chain Break Detected',               severity: 'p3', source: 'scout',  status: 'closed',        sla: 480, response: 60,  created: '2026-04-30T06:00:00Z' },
    { id: 'INC-0007', title: 'Lambda Cold-Start Spike on Auth Service',     severity: 'p3', source: 'pulse',  status: 'investigating', sla: 480, response: 30,  created: '2026-05-07T01:00:00Z' },
    { id: 'INC-0008', title: 'KMS Key Rotation Overdue (3 keys)',           severity: 'p2', source: 'signal', status: 'detected',      sla: 120, response: 5,   created: '2026-05-07T05:30:00Z' },
  ],
};

b.copilot = {
  suggestedQuestions: [
    'Am I ready for my SOC 2 audit?',
    "What's my biggest security risk?",
    'How do I fix my S3 bucket issues?',
    'Show compliance trend over 90 days',
    'Compare me to industry peers',
    'What changed since last week?',
    'Which findings can be auto-fixed?',
    "What's my HIPAA readiness?",
  ],
  recentConversations: [
    { title: 'HIPAA readiness check',     date: '2026-05-04' },
    { title: 'IAM remediation options',   date: '2026-05-02' },
    { title: 'Evidence collection gaps',  date: '2026-04-29' },
    { title: 'PCI DSS v4.0.1 migration',  date: '2026-04-26' },
  ],
  seedThread: [
    { id: '1', role: 'user', content: 'Am I ready for my SOC 2 Type II audit?', timestamp: '2 min ago' },
    { id: '2', role: 'ai',   timestamp: '2 min ago',
      content: "Based on your current posture, you're at **78% readiness** for SOC 2 Type II.\n\n**3 blockers to address:**\n• CC6.1 — 4 open IAM findings (2 are auto-fixable via HELIX)\n• CC7.1 — CloudTrail not multi-region in 2 AWS accounts\n• CC8.1 — No change management evidence collected since February\n\n**Recommendation:** Run auto-fix on the 2 IAM findings, enable multi-region CloudTrail, then trigger evidence collection. This would bring you to approximately 89% readiness.\n\n**Estimated effort:** 2-3 hours for auto-fixes, 1 hour for CloudTrail config.",
      sources: ['SOC2 CC6.1', 'SOC2 CC7.1', 'SOC2 CC8.1'] },
  ],
};

b.calendar = {
  events: [
    { id: '1', type: 'deadline', title: 'SOC 2 Type II Audit',                   framework: 'SOC 2',     date: '2026-05-22', daysRemaining: 15,  readiness: 78,  urgency: 'critical' },
    { id: '2', type: 'scan',     title: 'Scheduled Weekly Scan (SOC 2)',         framework: 'SOC 2',     date: '2026-05-14', daysRemaining: 7,   readiness: 100, urgency: 'medium'   },
    { id: '3', type: 'renewal',  title: 'ISO 27001 Certification Renewal',       framework: 'ISO 27001', date: '2026-06-25', daysRemaining: 49,  readiness: 72,  urgency: 'medium'   },
    { id: '4', type: 'report',   title: 'Monthly Compliance Report Due',         framework: 'All',       date: '2026-05-31', daysRemaining: 24,  readiness: 100, urgency: 'low'      },
    { id: '5', type: 'deadline', title: 'DPDPA Filing Deadline',                 framework: 'DPDPA',     date: '2026-07-10', daysRemaining: 64,  readiness: 55,  urgency: 'low'      },
    { id: '6', type: 'training', title: 'AI Governance Training (ISO 42001)',    framework: 'ISO 42001', date: '2026-05-18', daysRemaining: 11,  readiness: 30,  urgency: 'high'     },
    { id: '7', type: 'audit',    title: 'HIPAA Annual Assessment',               framework: 'HIPAA',     date: '2026-08-15', daysRemaining: 100, readiness: 45,  urgency: 'low'      },
    { id: '8', type: 'deadline', title: 'PCI DSS v4.0.1 Migration',              framework: 'PCI DSS',   date: '2026-06-30', daysRemaining: 54,  readiness: 60,  urgency: 'medium'   },
  ],
};

b.regulatory = {
  changes: [
    { id: 'REG-001', framework: 'ISO 42001', type: 'new_version', title: 'ISO 42001:2023 — AI Management Systems Published',
      summary: 'First international standard for AI management systems. Organizations using AI must establish an AIMS.',
      impact: 'critical', date: '2023-12-18', controls: ['4.1', '6.1', '8.4'] },
    { id: 'REG-002', framework: 'DPDPA', type: 'amendment', title: 'DPDPA 2023 — Digital Personal Data Protection Act (India)',
      summary: "India's comprehensive data protection law. Establishes Data Protection Board, consent requirements, breach notification.",
      impact: 'critical', date: '2023-08-11', controls: ['DPDPA-S4', 'DPDPA-S8'] },
    { id: 'REG-003', framework: 'PCI DSS', type: 'new_version', title: 'PCI DSS v4.0.1 — Updated Payment Card Standard',
      summary: 'Extended MFA requirements, 12-char passwords, customized validation approach.',
      impact: 'high', date: '2025-03-31', controls: ['Req.8', 'Req.3'] },
    { id: 'REG-004', framework: 'NIST', type: 'guidance', title: 'NIST SP 800-53 Rev 5.1.1 — Updated Security Controls',
      summary: 'Minor updates with clarified supply chain risk management guidance.',
      impact: 'medium', date: '2024-01-15', controls: ['AC-1', 'SR-1'] },
    { id: 'REG-005', framework: 'GDPR', type: 'enforcement', title: 'EDPB Guidelines on AI and GDPR — Final Version',
      summary: 'Guidelines on applying GDPR to AI systems including training data and automated decisions.',
      impact: 'high', date: '2024-06-01', controls: ['Art.25', 'Art.32'] },
    { id: 'REG-006', framework: 'HIPAA', type: 'guidance', title: 'HHS OCR Guidance on HIPAA and Cloud Computing',
      summary: 'Updated guidance on HIPAA requirements for cloud providers handling ePHI.',
      impact: 'medium', date: '2024-03-01', controls: ['164.312(a)', '164.312(e)'] },
    { id: 'REG-007', framework: 'EU AI Act', type: 'new_version', title: 'EU AI Act — High-Risk System Obligations Effective',
      summary: 'High-risk AI systems must meet conformity assessment, documentation, and human oversight requirements.',
      impact: 'critical', date: '2026-02-02', controls: ['Art.6', 'Art.9', 'Art.14'] },
  ],
};

b.aiGovernance = {
  iso42001Clauses: [
    { id: '4',  title: 'Context of the Organization',  status: 'partial', score: 65 },
    { id: '5',  title: 'Leadership',                   status: 'pass',    score: 80 },
    { id: '6',  title: 'Planning',                     status: 'partial', score: 60 },
    { id: '7',  title: 'Support',                      status: 'fail',    score: 40 },
    { id: '8',  title: 'Operation',                    status: 'partial', score: 55 },
    { id: '9',  title: 'Performance Evaluation',       status: 'fail',    score: 35 },
    { id: '10', title: 'Improvement',                  status: 'fail',    score: 30 },
  ],
  systems: [
    { name: 'Compliance Analysis Engine',  model: 'Claude Sonnet 4.6', risk: 'medium', status: 'active', lastReview: '2026-04-15' },
    { name: 'Security Copilot',            model: 'Claude Opus 4.6',   risk: 'high',   status: 'active', lastReview: '2026-05-01' },
    { name: 'Remediation Engine',          model: 'Claude Opus 4.6',   risk: 'high',   status: 'active', lastReview: '2026-05-05' },
    { name: 'Threat Intelligence Matcher', model: 'Claude Sonnet 4.6', risk: 'medium', status: 'active', lastReview: '2026-04-20' },
    { name: 'Evidence Auto-Collector',     model: 'Claude Haiku 4.5',  risk: 'low',    status: 'active', lastReview: '2026-03-28' },
  ],
  ethicsDimensions: [
    { name: 'Bias & Fairness', score: 82, trend: 'up'     },
    { name: 'Explainability',  score: 78, trend: 'up'     },
    { name: 'Privacy',         score: 85, trend: 'stable' },
    { name: 'Safety',          score: 90, trend: 'up'     },
    { name: 'Transparency',    score: 72, trend: 'down'   },
    { name: 'Accountability',  score: 68, trend: 'stable' },
  ],
  decisions: [
    { type: 'Gap Analysis',              confidence: 0.92, model: 'claude-sonnet-4-6', tokens: 4521, time: '2h ago' },
    { type: 'Remediation Recommendation', confidence: 0.88, model: 'claude-opus-4-6',  tokens: 6230, time: '3h ago' },
    { type: 'Executive Summary',         confidence: 0.95, model: 'claude-sonnet-4-6', tokens: 3100, time: '5h ago' },
    { type: 'Risk Assessment',           confidence: 0.85, model: 'claude-opus-4-6',   tokens: 8450, time: '1d ago' },
    { type: 'Compliance Trajectory',     confidence: 0.79, model: 'claude-sonnet-4-6', tokens: 2800, time: '1d ago' },
  ],
};

const json = JSON.stringify(b, null, 2);
fs.writeFileSync(BUNDLE, json);
if (HARNESS) fs.writeFileSync(HARNESS, json);
console.log('Bundle extended with: autopilot, incidents, copilot, calendar, regulatory, aiGovernance');
console.log('  →', BUNDLE);
if (HARNESS) console.log('  →', HARNESS);
