// API base URL must be set at build time via NEXT_PUBLIC_API_URL (e.g. via
// Docker --build-arg or .env.local for dev). Empty string = relative paths,
// which lets a single image work behind a reverse proxy in any environment.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

// ---- Cookie helpers ----

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)bf_admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getRefreshToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)bf_admin_refresh=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setTokens(access: string, refresh: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `bf_admin_token=${encodeURIComponent(access)}; path=/; max-age=900; SameSite=Strict${secure}`;
  document.cookie = `bf_admin_refresh=${encodeURIComponent(refresh)}; path=/; max-age=2592000; SameSite=Strict${secure}`;
}

export function clearTokens() {
  document.cookie = "bf_admin_token=; path=/; max-age=0";
  document.cookie = "bf_admin_refresh=; path=/; max-age=0";
}

// ---- Core request handler ----

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTokens(data.accessToken, data.refreshToken);
        headers["Authorization"] = `Bearer ${data.accessToken}`;
        const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
        return retryRes.json();
      }
    }
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: { message?: string } })?.error?.message ||
        `API error: ${res.status}`,
    );
  }

  return res.json();
}

// ---- API surface ----

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<any>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  verifyMfa: (mfaChallengeToken: string, token: string) =>
    request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string };
    }>("/api/auth/mfa/verify", { method: "POST", body: JSON.stringify({ mfaChallengeToken, token }) }),

  // Admin-specific
  getStats: () => request<{ stats: AdminStats }>("/api/admin/stats"),
  getAdminStats: () => request<{ stats: AdminStats }>("/api/admin/stats"),

  getUsers: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ users: AdminUser[] }>(`/api/admin/users${qs}`);
  },
  getAdminUsers: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ users: AdminUser[] }>(`/api/admin/users${qs}`);
  },

  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ logs: AuditLog[] }>(`/api/admin/audit-logs${qs}`);
  },

  getComplianceLeaderboard: () =>
    request<{ leaderboard: LeaderboardEntry[] }>("/api/admin/compliance/leaderboard"),

  getBillingStats: () => request<{ billing: BillingOverview }>("/api/admin/billing"),
  getBillingOverview: () => request<{ billing: BillingOverview }>("/api/admin/billing"),

  getSystemSettings: () => request<{ settings: SystemSettings }>("/api/admin/settings"),
  updateSystemSettings: (data: Partial<SystemSettings>) =>
    request<{ settings: SystemSettings }>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getAIGovernance: () => request<any>("/api/ai-ethics/dashboard"),

  // Clients
  getClients: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ clients: Client[] }>(`/api/clients${qs}`);
  },
  provisionClient: (data: {
    companyName: string;
    ownerEmail: string;
    ownerName: string;
    plan: string;
    industry?: string;
    customPlanLabel?: string;
    monthlyPriceInr?: number;
    featureOverrides?: Array<{ featureKey: string; enabled: boolean; reason?: string }>;
  }) =>
    request<{ client: any; tempPassword: string }>("/api/admin/provision-client", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Admin tenants (feature toggles, custom plans)
  getFeatureCatalog: () => request<{ features: FeatureDef[] }>("/api/admin/features"),
  getAdminTenants: () => request<{ tenants: AdminTenant[] }>("/api/admin/tenants"),
  getAdminTenant: (id: string) =>
    request<AdminTenantDetail>(`/api/admin/tenants/${encodeURIComponent(id)}`),
  updateAdminTenant: (
    id: string,
    data: {
      name?: string;
      plan?: string;
      onboardingStatus?: string;
      customPlanLabel?: string | null;
      monthlyPriceInr?: number | null;
      industryProfile?: string;
    },
  ) =>
    request<{ tenant: AdminTenant }>(`/api/admin/tenants/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  updateAdminTenantFeatures: (
    id: string,
    overrides: Array<{ featureKey: string; enabled: boolean; reason?: string }>,
  ) =>
    request<{ features: EffectiveFeature[] }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/features`,
      { method: "PATCH", body: JSON.stringify({ overrides }) },
    ),

  // Scans
  getScans: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ scans: Scan[] }>(`/api/scans${qs}`);
  },
  createScan: (data: { frameworks: string[]; targets: string[] }) =>
    request<{ scan: Scan }>("/api/scans", { method: "POST", body: JSON.stringify(data) }),
  cancelScan: (id: string) =>
    request<{ scan: Scan }>(`/api/scans/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  getScan: (id: string) =>
    request<{ scan: Scan }>(`/api/scans/${encodeURIComponent(id)}`),

  // Admin user mutations
  createAdminUser: (data: { tenantId: string; email: string; name: string; password: string; role: string }) =>
    request<{ user: AdminUser }>("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateAdminUser: (id: string, data: { name?: string; role?: string }) =>
    request<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAdminUser: (id: string) =>
    request<void>(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Admin finding mutations
  acknowledgeFinding: (id: string) =>
    request<{ finding: { id: string; status: string } }>(`/api/admin/findings/${encodeURIComponent(id)}/acknowledge`, { method: "POST" }),
  dismissFinding: (id: string) =>
    request<{ finding: { id: string; status: string } }>(`/api/admin/findings/${encodeURIComponent(id)}/dismiss`, { method: "POST" }),

  // Admin scan mutations
  cancelAdminScan: (id: string) =>
    request<{ scan: { id: string; status: string } }>(`/api/admin/scans/${encodeURIComponent(id)}/cancel`, { method: "POST" }),

  // Admin evidence
  getAdminEvidence: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ evidence: EvidenceItem[]; pagination: { page: number; limit: number; total: number } }>(`/api/admin/evidence${qs}`);
  },
  accessEvidence: (id: string, reason: string) =>
    request<{ url: string; expiresIn: number }>(`/api/admin/evidence/${encodeURIComponent(id)}/access`, { method: "POST", body: JSON.stringify({ reason }) }),

  // Findings
  getFindings: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ findings: Finding[] }>(`/api/findings${qs}`);
  },

  // Compliance
  getScores: (scanId?: string) =>
    request<{ scores: ComplianceScore[] }>(
      `/api/compliance/scores${scanId ? `?scanId=${scanId}` : ""}`,
    ),
  getComplianceScores: () => request<{ scores: ComplianceScore[] }>("/api/compliance/scores"),
  getComplianceMatrix: (framework: string) =>
    request<any>(`/api/compliance/matrix/${encodeURIComponent(framework)}`),
  getFrameworks: () => request<{ frameworks: Framework[] }>("/api/compliance/frameworks"),

  // Reports
  getReports: () => request<{ reports: Report[] }>("/api/reports"),
  generateReport: (id: string) =>
    request<{ report: Report }>(`/api/reports/${encodeURIComponent(id)}/generate`, {
      method: "POST",
    }),

  // Remediations
  getRemediations: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ remediations: Remediation[] }>(`/api/remediations${qs}`);
  },

  // AI Analysis
  getAiCapabilities: () =>
    request<{ mode: string; capabilities: any[] }>("/api/ai/capabilities"),
  runGapAnalysis: (scanId: string, framework: string) =>
    request<any>("/api/ai/gap-analysis", {
      method: "POST",
      body: JSON.stringify({ scanId, framework }),
    }),
  runMitreMapping: (scanId: string) =>
    request<any>("/api/ai/mitre-mapping", { method: "POST", body: JSON.stringify({ scanId }) }),
  runRiskAssessment: (industry?: string) =>
    request<any>("/api/ai/risk-assessment", { method: "POST", body: JSON.stringify({ industry }) }),
  getExecutiveSummary: (scanId: string) =>
    request<any>("/api/ai/executive-summary", {
      method: "POST",
      body: JSON.stringify({ scanId }),
    }),

  // Threat Intelligence
  getThreatDashboard: () => request<any>("/api/threat-intel/dashboard"),
  getRecentCves: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ cves: any[]; count: number }>(`/api/threat-intel/cves${qs}`);
  },
  getKevCatalog: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<{ vulnerabilities: any[]; count: number }>(`/api/threat-intel/kev${qs}`);
  },
  getCorrelations: () =>
    request<{ correlations: any[]; count: number }>("/api/threat-intel/correlations"),

  // Policy Designer
  getPolicyTemplates: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ templates: any[]; count: number }>(`/api/policies/templates${qs}`);
  },
  generatePolicy: (templateId: string, customization: any) =>
    request<any>("/api/policies/generate", {
      method: "POST",
      body: JSON.stringify({ templateId, customization }),
    }),
  getPolicyGaps: (frameworks?: string) => {
    const qs = frameworks ? `?frameworks=${encodeURIComponent(frameworks)}` : "";
    return request<any>(`/api/policies/gaps${qs}`);
  },
  getGeneratedPolicies: () =>
    request<{ policies: any[]; total: number }>("/api/policies"),

  // Contact submissions (marketing-site leads)
  getContactSubmissions: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return request<{ success: true; data: { items: ContactSubmission[]; total: number; limit: number; offset: number } }>(
      `/api/admin/contact-submissions${qs}`,
    );
  },
  getContactSubmission: (id: string) =>
    request<{ success: true; data: ContactSubmission }>(`/api/admin/contact-submissions/${id}`),
  updateContactSubmission: (id: string, patch: { status?: string; notes?: string }) =>
    request<{ success: true; data: ContactSubmission }>(`/api/admin/contact-submissions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // Lead notification recipients
  getLeadRecipients: () =>
    request<{ success: true; data: LeadNotificationRecipient[] }>("/api/admin/lead-notification-recipients"),
  createLeadRecipient: (input: { email: string; name?: string; isActive?: boolean }) =>
    request<{ success: true; data: LeadNotificationRecipient }>("/api/admin/lead-notification-recipients", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateLeadRecipient: (id: string, patch: { name?: string; isActive?: boolean }) =>
    request<{ success: true; data: LeadNotificationRecipient }>(`/api/admin/lead-notification-recipients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteLeadRecipient: (id: string) =>
    request<void>(`/api/admin/lead-notification-recipients/${id}`, { method: "DELETE" }),
};

// ---- Type definitions ----

export interface AdminStats {
  totalClients: number;
  activeScans: number;
  totalFindings: number;
  criticalFindings: number;
  totalUsers: number;
  avgComplianceScore: number;
  monthlyRevenue: number;
  systemUptime: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  lastLogin: string | null;
  status: "active" | "disabled" | "locked";
  createdAt: string;
}

export interface LeaderboardEntry {
  tenantId: string;
  company: string;
  complianceScore: number;
  findingsResolved: number;
  trend: "up" | "down" | "stable";
}

export interface Client {
  id: string;
  tenantId: string;
  accountNumber: string;
  company: string;
  industry: string;
  plan: string;
  complianceScore: number;
  status: string;
  lastScan: string | null;
}

export type FeatureTier = "Comply" | "Protect" | "Defend";

export interface FeatureDef {
  key: string;
  name: string;
  description: string;
  tier: FeatureTier;
  category: string;
}

export interface EffectiveFeature {
  key: string;
  enabled: boolean;
  source: "tier" | "override";
  tier: FeatureTier;
  name: string;
  description: string;
  category: string;
}

export interface AdminTenant {
  id: string;
  accountNumber: string;
  name: string;
  slug: string;
  plan: string;
  customPlanLabel: string | null;
  monthlyPriceInr: number | null;
  industryProfile: string | null;
  onboardingStatus: string;
  createdAt: string;
  userCount: number;
  overrideCount: number;
}

export interface AdminTenantDetail {
  tenant: AdminTenant;
  owner: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  features: {
    plan: string;
    customPlanLabel: string | null;
    features: EffectiveFeature[];
  };
  stats: {
    complianceScore: number;
    totalScans: number;
    lastScanAt: string | null;
    findingsOpen: number;
    integrations: string[];
    teamMembers: Array<{ name: string; email: string; role: string }>;
    recentScans: Array<{ id: string; date: string; framework: string; status: string }>;
  };
}

export interface Scan {
  id: string;
  tenantId: string;
  triggeredBy: string;
  frameworks: string[];
  targets: string[];
  status: string;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  errorDetails: string | null;
  agentSwarmId: string | null;
}

export interface Finding {
  id: string;
  scanId: string;
  tenantId: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
  category: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceRegion: string | null;
  remediationTier: "auto" | "approval" | "manual";
  autoFixAvailable: boolean;
  dedupHash: string;
}

export interface ComplianceScore {
  framework: string;
  score: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  naCount: number;
  totalControls: number;
  evaluatedControls: number;
}

export interface Framework {
  framework: string;
  version: string;
  totalControls: number;
}

export interface Report {
  id: string;
  tenantId: string;
  type: string;
  framework: string | null;
  status: "ready" | "generating" | "failed";
  storagePath: string | null;
  shareToken: string | null;
  generatedAt: string;
  expiresAt: string | null;
}

export interface EvidenceItem {
  id: string;
  tenantId: string;
  tenantName: string | null;
  type: string;
  framework: string | null;
  collectedAt: string;
  collectedBy: string;
  s3ObjectKey: string | null;
}

export interface Remediation {
  id: string;
  findingId: string;
  tier: "auto" | "approval" | "manual";
  status:
    | "pending"
    | "approved"
    | "executing"
    | "completed"
    | "failed"
    | "rolled_back";
  approvedBy: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  playbookContent: string | null;
  executedAt: string | null;
  completedAt: string | null;
}

export interface BillingOverview {
  totalMRR: number;
  activeSubscriptions: number;
  churnRate: number;
  avgRevenuePerClient: number;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  maxScansPerTenant: number;
  retentionDays: number;
  smtpConfigured: boolean;
  slackConfigured: boolean;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  company: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  topic: string | null;
  message: string | null;
  source: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: "new" | "contacted" | "qualified" | "archived" | "spam";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadNotificationRecipient {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Report Export (tamper-evident PDF flow) ----
// Appended separately so it doesn't conflict with parallel edits to the main
// `api` surface. Wires to POST /api/admin/reports/export and the public GET
// /api/verify/report/:sha256.

export type ExportReportType =
  | "tenant-health"
  | "compliance-overview"
  | "findings-rollup";

export interface ExportReportRequest {
  tenantId: string;
  reportType: ExportReportType;
  dateRange?: { from: string; to: string };
  encrypt?: boolean;
  recipientEmail?: string;
}

export interface ExportReportResponse {
  pdfBase64: string;
  sha256: string;
  reportType: ExportReportType;
  encrypted: boolean;
  password?: string;
  signedBy: string;
  warnings?: string[];
}

(api as unknown as {
  exportReport: (body: ExportReportRequest) => Promise<ExportReportResponse>;
}).exportReport = (body) =>
  request<ExportReportResponse>("/api/admin/reports/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
