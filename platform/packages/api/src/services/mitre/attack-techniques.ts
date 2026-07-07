// REAL IMPL (BLACKFYRE 2026-06): Comprehensive cloud-relevant MITRE ATT&CK
// technique library, replacing the prior 12-entry inline Map that was presented
// as "MITRE ATT&CK mapping".
//
// HONEST COVERAGE STATEMENT
// -------------------------
// This is a CURATED SUBSET of MITRE ATT&CK Enterprise (v15+) focused on the
// techniques that posture/CSPM findings about cloud IAM, storage, network,
// compute, logging, and credentials can be honestly mapped to. It is NOT the
// complete ATT&CK matrix (~200 techniques + ~450 sub-techniques across 14
// tactics). It deliberately concentrates on the IaaS / Identity Provider / SaaS
// platforms (the matrices a posture scanner actually has signal for) and spans
// these tactics: Initial Access, Persistence, Privilege Escalation, Defense
// Evasion, Credential Access, Discovery, Lateral Movement, Collection,
// Exfiltration, and Impact.
//
// Technique IDs, names, tactic assignments, and sub-technique IDs below are the
// REAL identifiers from attack.mitre.org. Mitigations are operator guidance, not
// ATT&CK mitigation-object IDs. Mapping from a finding to a technique is a
// heuristic over finding category/title/resource/severity (see mapFindingToTechniques
// and ai-analysis-service.mitreMapping); it is signature/keyword based, NOT an
// observed-behaviour detection, and callers should treat the mapping confidence
// accordingly.

export type MitreTactic =
  | "Reconnaissance"
  | "Resource Development"
  | "Initial Access"
  | "Execution"
  | "Persistence"
  | "Privilege Escalation"
  | "Defense Evasion"
  | "Credential Access"
  | "Discovery"
  | "Lateral Movement"
  | "Collection"
  | "Command and Control"
  | "Exfiltration"
  | "Impact";

export interface AttackTechnique {
  /** Real ATT&CK technique or sub-technique ID, e.g. "T1078.004". */
  id: string;
  /** Canonical ATT&CK technique/sub-technique name. */
  name: string;
  /** Primary tactic this technique is being mapped under for posture findings. */
  tactic: MitreTactic;
  /** Parent technique ID for sub-techniques (e.g. T1078 for T1078.004); else undefined. */
  parentId?: string;
  /** Operator-facing mitigation guidance (not an ATT&CK mitigation object ID). */
  mitigation: string;
}

/**
 * The curated technique catalog. Keyed by ATT&CK ID so callers can resolve a
 * technique deterministically. Sub-technique IDs use ATT&CK's dotted form.
 */
export const ATTACK_TECHNIQUES: Record<string, AttackTechnique> = {
  /* ---- Initial Access ---- */
  T1078: {
    id: "T1078", name: "Valid Accounts", tactic: "Initial Access",
    mitigation: "Enforce MFA, rotate and vault credentials, and disable default/unused accounts.",
  },
  "T1078.001": {
    id: "T1078.001", name: "Valid Accounts: Default Accounts", tactic: "Initial Access", parentId: "T1078",
    mitigation: "Remove or rotate default/built-in accounts and credentials before production use.",
  },
  "T1078.004": {
    id: "T1078.004", name: "Valid Accounts: Cloud Accounts", tactic: "Initial Access", parentId: "T1078",
    mitigation: "Disable inactive cloud identities, enforce MFA, and review federated access regularly.",
  },
  T1190: {
    id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access",
    mitigation: "Restrict public exposure, place a WAF in front, and patch internet-facing services promptly.",
  },
  T1133: {
    id: "T1133", name: "External Remote Services", tactic: "Initial Access",
    mitigation: "Front remote access (RDP/SSH/VPN) with a bastion, MFA, and IP allow-lists; never expose directly.",
  },
  T1199: {
    id: "T1199", name: "Trusted Relationship", tactic: "Initial Access",
    mitigation: "Scope third-party/cross-account trust to least privilege and review external role assumptions.",
  },
  T1195: {
    id: "T1195", name: "Supply Chain Compromise", tactic: "Initial Access",
    mitigation: "Verify image/artifact provenance, pin and scan dependencies, and enforce signed deployments.",
  },

  /* ---- Persistence ---- */
  T1098: {
    id: "T1098", name: "Account Manipulation", tactic: "Persistence",
    mitigation: "Alert on privilege/role changes, enforce least privilege, and review IAM policy mutations.",
  },
  "T1098.001": {
    id: "T1098.001", name: "Account Manipulation: Additional Cloud Credentials", tactic: "Persistence", parentId: "T1098",
    mitigation: "Detect and alert on new access keys / service-account keys; cap key counts and rotate.",
  },
  "T1098.003": {
    id: "T1098.003", name: "Account Manipulation: Additional Cloud Roles", tactic: "Persistence", parentId: "T1098",
    mitigation: "Review role/permission grants for drift; require approval for privileged-role attachment.",
  },
  T1136: {
    id: "T1136", name: "Create Account", tactic: "Persistence",
    mitigation: "Govern account creation via IaC/approval workflows and alert on out-of-band account creation.",
  },
  "T1136.003": {
    id: "T1136.003", name: "Create Account: Cloud Account", tactic: "Persistence", parentId: "T1136",
    mitigation: "Restrict who can create cloud identities and audit new IAM users/service accounts.",
  },
  T1525: {
    id: "T1525", name: "Implant Internal Image", tactic: "Persistence",
    mitigation: "Lock down image/registry write access and scan images for backdoors before deployment.",
  },

  /* ---- Privilege Escalation ---- */
  T1548: {
    id: "T1548", name: "Abuse Elevation Control Mechanism", tactic: "Privilege Escalation",
    mitigation: "Remove wildcard/iam:PassRole-style escalation paths and apply permission boundaries.",
  },
  "T1098.004": {
    id: "T1098.004", name: "Account Manipulation: SSH Authorized Keys", tactic: "Privilege Escalation", parentId: "T1098",
    mitigation: "Manage SSH keys centrally, disable key-based root login, and rotate authorized_keys.",
  },
  T1484: {
    id: "T1484", name: "Domain or Tenant Policy Modification", tactic: "Privilege Escalation",
    mitigation: "Protect directory/tenant policy with change control and alert on conditional-access edits.",
  },

  /* ---- Defense Evasion ---- */
  T1562: {
    id: "T1562", name: "Impair Defenses", tactic: "Defense Evasion",
    mitigation: "Protect logging/guardrail config from modification and alert on disablement.",
  },
  "T1562.001": {
    id: "T1562.001", name: "Impair Defenses: Disable or Modify Tools", tactic: "Defense Evasion", parentId: "T1562",
    mitigation: "Lock down security-tool/agent config and detect tampering with EDR/guard services.",
  },
  "T1562.008": {
    id: "T1562.008", name: "Impair Defenses: Disable or Modify Cloud Logs", tactic: "Defense Evasion", parentId: "T1562",
    mitigation: "Enable and protect CloudTrail / Activity Logs / Audit Logs; alert on logging changes.",
  },
  T1578: {
    id: "T1578", name: "Modify Cloud Compute Infrastructure", tactic: "Defense Evasion",
    mitigation: "Enforce IaC and drift detection; alert on out-of-band instance/snapshot/image changes.",
  },
  "T1578.001": {
    id: "T1578.001", name: "Modify Cloud Compute Infrastructure: Create Snapshot", tactic: "Defense Evasion", parentId: "T1578",
    mitigation: "Restrict and audit snapshot creation/sharing; detect cross-account snapshot copies.",
  },
  T1535: {
    id: "T1535", name: "Unused/Unsupported Cloud Regions", tactic: "Defense Evasion",
    mitigation: "Apply SCP/region restrictions and alert on activity in regions you do not operate in.",
  },

  /* ---- Credential Access ---- */
  T1552: {
    id: "T1552", name: "Unsecured Credentials", tactic: "Credential Access",
    mitigation: "Move secrets to a managed vault/KMS; enable rotation; never store keys in plaintext.",
  },
  "T1552.001": {
    id: "T1552.001", name: "Unsecured Credentials: Credentials In Files", tactic: "Credential Access", parentId: "T1552",
    mitigation: "Scan repos/objects/user-data for embedded secrets; remediate and rotate exposed keys.",
  },
  "T1552.005": {
    id: "T1552.005", name: "Unsecured Credentials: Cloud Instance Metadata API", tactic: "Credential Access", parentId: "T1552",
    mitigation: "Enforce IMDSv2 / metadata hardening so instance-role creds cannot be trivially harvested.",
  },
  T1556: {
    id: "T1556", name: "Modify Authentication Process", tactic: "Credential Access",
    mitigation: "Protect IdP/auth config, enforce MFA, and alert on auth-policy or federation changes.",
  },
  T1621: {
    id: "T1621", name: "Multi-Factor Authentication Request Generation", tactic: "Credential Access",
    mitigation: "Enable MFA with number-matching/anti-fatigue controls for all users, especially admins.",
  },
  T1557: {
    id: "T1557", name: "Adversary-in-the-Middle", tactic: "Credential Access",
    mitigation: "Enforce TLS 1.2+, HSTS, and certificate validation; disable plaintext protocols.",
  },
  T1110: {
    id: "T1110", name: "Brute Force", tactic: "Credential Access",
    mitigation: "Enforce strong password policy, account lockout, and detection of password spraying.",
  },

  /* ---- Discovery ---- */
  T1046: {
    id: "T1046", name: "Network Service Discovery", tactic: "Discovery",
    mitigation: "Close unnecessary ports, segment networks, and restrict security-group ingress.",
  },
  T1526: {
    id: "T1526", name: "Cloud Service Discovery", tactic: "Discovery",
    mitigation: "Apply least privilege to read/list APIs and monitor enumeration of cloud services.",
  },
  T1580: {
    id: "T1580", name: "Cloud Infrastructure Discovery", tactic: "Discovery",
    mitigation: "Restrict Describe*/List* permissions and alert on broad infrastructure enumeration.",
  },
  T1087: {
    id: "T1087", name: "Account Discovery", tactic: "Discovery",
    mitigation: "Limit IAM read access and detect enumeration of users, roles, and policies.",
  },

  /* ---- Lateral Movement ---- */
  T1021: {
    id: "T1021", name: "Remote Services", tactic: "Lateral Movement",
    mitigation: "Require bastion/MFA for remote services and segment east-west traffic.",
  },
  "T1021.007": {
    id: "T1021.007", name: "Remote Services: Cloud Services", tactic: "Lateral Movement", parentId: "T1021",
    mitigation: "Constrain cross-account role assumption and federated console/API access to least privilege.",
  },
  T1550: {
    id: "T1550", name: "Use Alternate Authentication Material", tactic: "Lateral Movement",
    mitigation: "Short-lived tokens, bind sessions, and revoke leaked access keys/tokens promptly.",
  },

  /* ---- Collection ---- */
  T1530: {
    id: "T1530", name: "Data from Cloud Storage", tactic: "Collection",
    mitigation: "Block public bucket/blob access, enforce encryption, and least-privilege storage IAM.",
  },
  T1213: {
    id: "T1213", name: "Data from Information Repositories", tactic: "Collection",
    mitigation: "Restrict access to databases/repositories and audit bulk reads of sensitive data.",
  },

  /* ---- Exfiltration ---- */
  T1537: {
    id: "T1537", name: "Transfer Data to Cloud Account", tactic: "Exfiltration",
    mitigation: "Restrict cross-account sharing/copy of snapshots, images, and storage; alert on it.",
  },
  T1567: {
    id: "T1567", name: "Exfiltration Over Web Service", tactic: "Exfiltration",
    mitigation: "Egress-filter to known destinations and detect anomalous outbound data volume.",
  },

  /* ---- Impact ---- */
  T1485: {
    id: "T1485", name: "Data Destruction", tactic: "Impact",
    mitigation: "Enable versioning, object lock/immutability, and least-privilege delete permissions.",
  },
  T1486: {
    id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact",
    mitigation: "Maintain offline/immutable backups, restrict KMS key deletion, and test restores.",
  },
  T1490: {
    id: "T1490", name: "Inhibit System Recovery", tactic: "Impact",
    mitigation: "Enable cross-region backups with retention, MFA-delete, and recovery-point immutability.",
  },
  T1565: {
    id: "T1565", name: "Data Manipulation", tactic: "Impact",
    mitigation: "Encrypt data at rest and in transit and enforce integrity controls on stored data.",
  },
  "T1565.001": {
    id: "T1565.001", name: "Data Manipulation: Stored Data Manipulation", tactic: "Impact", parentId: "T1565",
    mitigation: "Enable encryption at rest, object integrity verification, and tamper alerting on stores.",
  },
  T1496: {
    id: "T1496", name: "Resource Hijacking", tactic: "Impact",
    mitigation: "Cap/limit compute provisioning, alert on cost/usage spikes, and lock down spin-up rights.",
  },
};

/**
 * Resolve a technique by ID, returning undefined for unknown IDs.
 */
export function getTechnique(id: string): AttackTechnique | undefined {
  return ATTACK_TECHNIQUES[id];
}

/* ------------------------------------------------------------------ */
/*  Finding → technique heuristic                                      */
/* ------------------------------------------------------------------ */

export interface FindingSignal {
  category?: string | null;
  title?: string | null;
  description?: string | null;
  resourceType?: string | null;
  severity?: string | null;
}

interface Rule {
  /** Regex over the combined lowercased finding text. */
  match: RegExp;
  /** Ordered technique IDs (most specific first). */
  techniqueIds: string[];
}

// REAL IMPL (BLACKFYRE 2026-06): ordered heuristic rules mapping posture-finding
// vocabulary to real ATT&CK technique IDs. First matching rule wins for the
// primary technique; severity can promote to a more impactful technique below.
// This is keyword/signature heuristic mapping, not behavioural detection.
const RULES: Rule[] = [
  // Credential / secret exposure
  { match: /\b(imdsv1|instance metadata|metadata service|imds)\b/, techniqueIds: ["T1552.005", "T1552"] },
  { match: /\b(secret|access key|api key|hardcoded|plaintext credential|credential in)\b/, techniqueIds: ["T1552.001", "T1552"] },
  { match: /\b(mfa|multi-factor|multi factor|2fa)\b/, techniqueIds: ["T1621", "T1556"] },
  { match: /\b(password|brute|spray|weak credential|lockout)\b/, techniqueIds: ["T1110", "T1078"] },
  { match: /\b(key rotation|kms|key management|unrotated key|key age)\b/, techniqueIds: ["T1552", "T1486"] },
  // Transport / MITM
  { match: /\b(tls 1\.0|tls 1\.1|sslv3|plaintext|cleartext|hsts|insecure transport|http only)\b/, techniqueIds: ["T1557"] },
  // Public exposure
  { match: /\b(public(ly)? (accessible|exposed|readable|writable)|public bucket|0\.0\.0\.0\/0|world-readable|anonymous access)\b/, techniqueIds: ["T1530", "T1190"] },
  { match: /\b(public-facing|internet-facing|exposed (app|application|endpoint|service))\b/, techniqueIds: ["T1190"] },
  // Remote access exposure
  { match: /\b(ssh|rdp|port 22|port 3389|bastion|remote desktop|vpn)\b/, techniqueIds: ["T1133", "T1021"] },
  // Network / ports
  { match: /\b(open port|security group|firewall|ingress|0\.0\.0\.0|nacl|network acl|exposed port)\b/, techniqueIds: ["T1046"] },
  // IAM / permissions / privilege
  { match: /\b(wildcard|admin\*|iam:passrole|privilege escalation|over-?privileged|excessive permission|\*:\*|full access)\b/, techniqueIds: ["T1548", "T1098.003"] },
  { match: /\b(permission|privilege|role|policy|iam)\b/, techniqueIds: ["T1098", "T1078.004"] },
  // Stale / inactive accounts
  { match: /\b(stale|inactive|unused|dormant|orphaned) (account|user|credential|key|role)\b/, techniqueIds: ["T1078.004", "T1098.001"] },
  { match: /\b(default account|default credential|default password)\b/, techniqueIds: ["T1078.001"] },
  // Logging / monitoring
  { match: /\b(cloudtrail|audit log|logging disabled|log retention|no logging|monitoring disabled|guardduty|flow log)\b/, techniqueIds: ["T1562.008", "T1562"] },
  // Encryption at rest
  { match: /\b(encrypt(ion)? at rest|unencrypted|server-side encryption|sse|not encrypted)\b/, techniqueIds: ["T1565.001", "T1565"] },
  // Backup / recovery
  { match: /\b(backup|versioning|snapshot|disaster recovery|point-in-time|retention|object lock|mfa delete)\b/, techniqueIds: ["T1490", "T1485"] },
  // Config drift / infra modification
  { match: /\b(drift|configuration change|infrastructure change|out-of-band|iac)\b/, techniqueIds: ["T1578"] },
  // Discovery surfaces
  { match: /\b(enumeration|describe\*|list\*|discovery|reconnaissance)\b/, techniqueIds: ["T1580", "T1526"] },
];

// Category-based fallback when the free-text rules don't fire.
const CATEGORY_FALLBACK: Record<string, string> = {
  iam: "T1098",
  identity: "T1078.004",
  encryption: "T1565.001",
  network: "T1046",
  logging: "T1562.008",
  storage: "T1530",
  compute: "T1578",
  backup: "T1490",
  credential: "T1552",
};

/**
 * Map a single finding to the most relevant ATT&CK technique using the curated
 * catalog. Returns the resolved technique plus the ordered candidate IDs so
 * callers can record alternates. Deterministic and side-effect free.
 *
 * Heuristic, not detection: matching is over finding category/title/description
 * keywords and severity, NOT observed adversary behaviour.
 */
export function mapFindingToTechniques(f: FindingSignal): {
  primary: AttackTechnique;
  candidateIds: string[];
} {
  const text = `${f.category ?? ""} ${f.title ?? ""} ${f.description ?? ""} ${f.resourceType ?? ""}`
    .toLowerCase();

  let candidateIds: string[] | undefined;
  for (const rule of RULES) {
    if (rule.match.test(text)) {
      candidateIds = rule.techniqueIds;
      break;
    }
  }

  if (!candidateIds) {
    const catKey = (f.category ?? "").toLowerCase();
    const fallbackId = CATEGORY_FALLBACK[catKey];
    candidateIds = fallbackId ? [fallbackId] : ["T1578"]; // benign default: infra-change visibility
  }

  // Severity promotion: critical destructive-data findings escalate to Impact
  // techniques when the text hints at deletion/ransom rather than mere exposure.
  const sev = (f.severity ?? "").toLowerCase();
  if ((sev === "critical" || sev === "high") && /\b(delete|destruction|ransom|wipe|encrypt for impact)\b/.test(text)) {
    candidateIds = ["T1485", ...candidateIds];
  }

  // Resolve the first candidate that exists in the catalog.
  let primary: AttackTechnique | undefined;
  for (const id of candidateIds) {
    primary = ATTACK_TECHNIQUES[id];
    if (primary) break;
  }
  // Guaranteed-present default keeps the function total.
  primary = primary ?? ATTACK_TECHNIQUES["T1578"];

  return { primary, candidateIds };
}
