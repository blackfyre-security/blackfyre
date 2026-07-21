// API base URL must be set at build time via NEXT_PUBLIC_API_URL. Empty string
// = relative paths, which lets a single image work behind a reverse proxy.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Cookie names
const ACCESS_COOKIE = "bf_portal_token";
const REFRESH_COOKIE = "bf_portal_refresh";
const CSRF_COOKIE = "csrf_token";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

class ApiClient {
  // --- Token helpers (cookie-based) ---

  getToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${ACCESS_COOKIE}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  getRefreshToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${REFRESH_COOKIE}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  setTokens(access: string, refresh: string) {
    // Auth tokens are now set as HttpOnly by the API via Set-Cookie.
    // This method is kept for backward compatibility with auth-context.
    // The values returned in the response body are still stored in memory via auth-context state.
    void access; void refresh;
  }

  clearTokens() {
    if (typeof document === "undefined") return;
    const exp = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = `${ACCESS_COOKIE}=; path=/; SameSite=Lax; ${exp}`;
    document.cookie = `${REFRESH_COOKIE}=; path=/; SameSite=Lax; ${exp}`;
    document.cookie = `${CSRF_COOKIE}=; path=/; SameSite=Lax; ${exp}`;
    fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken: this.getRefreshToken() ?? "" }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.accessToken ?? null;
    } catch {
      return null;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (MUTATION_METHODS.has(method)) {
      const csrf = this.getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    // 401 → attempt token refresh and retry once
    if (res.status === 401) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        const retryHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        };
        if (MUTATION_METHODS.has(method)) {
          const csrf = this.getCsrfToken();
          if (csrf) retryHeaders["X-CSRF-Token"] = csrf;
        }
        const retryRes = await fetch(`${API_URL}${path}`, {
          method,
          headers: retryHeaders,
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
        });
        if (retryRes.ok) return retryRes.json();
        if (retryRes.status === 401) {
          this.clearTokens();
          if (typeof window !== "undefined") window.location.href = "/login";
          throw new Error("Session expired. Please log in again.");
        }
        const errRetry = await retryRes
          .json()
          .catch(() => ({ error: { message: retryRes.statusText } }));
        throw new Error(errRetry.error?.message || `HTTP ${retryRes.status}`);
      }
      // No refresh token or refresh failed
      this.clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: { message: res.statusText } }));
      // Two error shapes reach here: the API's own { error: { message } }, and
      // Fastify's built-in { statusCode, error, message } for things it rejects
      // before a handler runs (payload too large, malformed JSON). Reading only the
      // former turned those into a bare "HTTP 413" with no explanation.
      throw new Error(err.error?.message || err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // --- Auth ---
  login(email: string, password: string) {
    return this.request<any>("POST", "/api/auth/login", { email, password });
  }

  verifyMfa(mfaChallengeToken: string, token: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string };
    }>("POST", "/api/auth/mfa/verify", { mfaChallengeToken, token });
  }

  // Deployment capabilities. The portal is a static export, so whether this
  // deployment has a payment gateway is a runtime question, not a build-time one.
  deploymentConfig() {
    return this.request<{
      allowUnpaidRegistration: boolean;
      paymentsEnabled: boolean;
      providers: { razorpay: boolean; stripe: boolean };
    }>("GET", "/api/v1/config");
  }

  register(data: { name: string; email: string; password: string; companyName: string }) {
    return this.request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } }>(
      "POST", "/api/auth/register", data,
    );
  }

  forgotPassword(email: string) {
    return this.request<{ success: boolean; message: string }>("POST", "/api/auth/forgot-password", { email });
  }

  resetPassword(token: string, password: string) {
    return this.request<{ success: boolean; message: string }>("POST", "/api/auth/reset-password", { token, password });
  }

  // --- Compliance ---
  getScores(scanId?: string) {
    return this.request<{ scores: ComplianceScore[] }>(
      "GET",
      `/api/compliance/scores${scanId ? `?scanId=${scanId}` : ""}`,
    );
  }

  getMatrix(framework: string) {
    return this.request<{ matrix: ControlMatrix }>(
      "GET",
      `/api/compliance/matrix/${encodeURIComponent(framework)}`,
    );
  }

  getFrameworks() {
    return this.request<{ frameworks: Framework[] }>(
      "GET",
      "/api/compliance/frameworks",
    );
  }

  // --- Findings ---
  getFindings(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ findings: Finding[] }>("GET", `/api/findings${qs}`);
  }

  getFinding(id: string) {
    return this.request<{ finding: Finding }>(
      "GET",
      `/api/findings/${encodeURIComponent(id)}`,
    );
  }

  updateFinding(id: string, data: { status?: string }) {
    return this.request<{ finding: Finding }>(
      "PATCH",
      `/api/findings/${encodeURIComponent(id)}`,
      data,
    );
  }

  // --- Scans ---
  getScans() {
    return this.request<{ scans: Scan[] }>("GET", "/api/scans");
  }

  createScan(data: { frameworks: string[]; targets: string[] }) {
    return this.request<{ scan: Scan }>("POST", "/api/scans", data);
  }

  getScan(id: string) {
    return this.request<{ scan: Scan }>(
      "GET",
      `/api/scans/${encodeURIComponent(id)}`,
    );
  }

  // --- Remediations ---
  getRemediations(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ remediations: Remediation[] }>(
      "GET",
      `/api/remediations${qs}`,
    );
  }

  approveRemediation(id: string) {
    return this.request<{ remediation: Remediation }>(
      "POST",
      `/api/remediations/${encodeURIComponent(id)}/approve`,
    );
  }

  executeRemediation(id: string) {
    return this.request<{ remediation: Remediation }>(
      "POST",
      `/api/remediations/${encodeURIComponent(id)}/execute`,
    );
  }

  rollbackRemediation(id: string) {
    return this.request<{ remediation: Remediation }>(
      "POST",
      `/api/remediations/${encodeURIComponent(id)}/rollback`,
    );
  }

  // --- Reports ---
  getReports() {
    return this.request<{ reports: Report[] }>("GET", "/api/reports");
  }

  generateReport(type: string, framework?: string) {
    return this.request<{ report: Report }>(
      "POST",
      "/api/reports/generate",
      { type, framework },
    );
  }

  downloadReport(id: string) {
    return `${API_URL}/api/reports/${encodeURIComponent(id)}/download`;
  }

  // --- Drift ---
  getDriftEvents(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ driftEvents: DriftEvent[] }>(
      "GET",
      `/api/drift${qs}`,
    );
  }

  getDriftStats() {
    return this.request<{ stats: DriftStats }>("GET", "/api/drift/stats");
  }

  // --- Alerts ---
  getAlerts() {
    return this.request<{ alertRules: AlertRule[] }>("GET", "/api/alerts");
  }

  // --- Clients ---
  getClients(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ clients: Client[] }>("GET", `/api/clients${qs}`);
  }

  // --- Evidence ---
  getEvidence(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ evidence: EvidenceArtifact[] }>(
      "GET",
      `/api/evidence${qs}`,
    );
  }

  // POST /api/evidence takes JSON, not multipart — the API has no multipart parser
  // registered, so the previous FormData body was rejected before it reached a
  // handler. `content` is the file's bytes (base64 for binary), which the evidence
  // worker hashes and uploads; that hash is what makes the record content-verified
  // rather than metadata-only.
  uploadEvidence(data: {
    findingId: string;
    type: EvidenceType;
    framework?: string;
    content: string;
    contentEncoding: "utf8" | "base64";
  }) {
    return this.request<{ evidence: EvidenceArtifact }>("POST", "/api/evidence", data);
  }

  // The download endpoint returns a presigned URL as JSON and requires auth, so it
  // cannot be used as a bare <a href download>. Previously it was, which rendered a
  // 401 body into a file. Resolve the real URL first, then hand it to the browser.
  async downloadEvidence(id: string) {
    const res = await this.request<{ evidenceId: string; downloadUrl: string; expiresIn: number }>(
      "GET", `/api/evidence/${encodeURIComponent(id)}/download`,
    );
    return res.downloadUrl;
  }

  // GET, not POST — the API registers this as GET, so POST 404'd and the Verify
  // button could never succeed.
  verifyEvidence(id: string) {
    return this.request<{
      evidenceId: string;
      integrity: {
        valid: boolean;
        expected: string;
        actual: string;
        hashSource: string;
        reason?: string;
      };
    }>("GET", `/api/evidence/${encodeURIComponent(id)}/verify`);
  }

  // --- Audit log ---
  getAuditLogs(params?: { limit?: number; beforeId?: string; action?: string; outcome?: "success" | "failure" }) {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return this.request<{
      entries: AuditLogEntry[];
      hasMore: boolean;
      nextBeforeId: string | null;
    }>("GET", `/api/audit-logs${qs}`);
  }

  // --- Team ---
  getTeamMembers() {
    return this.request<{ members: TeamMember[] }>("GET", "/api/team");
  }

  inviteTeamMember(data: { email: string; role: TeamRole }) {
    return this.request<{ member: TeamMember }>(
      "POST",
      "/api/team/invite",
      data,
    );
  }

  updateTeamMemberRole(id: string, role: TeamRole) {
    return this.request<{ member: TeamMember }>(
      "PATCH",
      `/api/team/${encodeURIComponent(id)}/role`,
      { role },
    );
  }

  removeTeamMember(id: string) {
    return this.request<{ success: boolean }>(
      "DELETE",
      `/api/team/${encodeURIComponent(id)}`,
    );
  }

  // --- Integrations ---
  getIntegrations() {
    return this.request<{ integrations: Integration[] }>(
      "GET",
      "/api/integrations",
    );
  }

  createIntegration(data: { type: string; config: Record<string, string> }) {
    return this.request<{ integration: Integration }>(
      "POST",
      "/api/integrations",
      data,
    );
  }

  testIntegration(id: string) {
    return this.request<{ success: boolean; message: string }>(
      "POST",
      `/api/integrations/${encodeURIComponent(id)}/test`,
    );
  }

  deleteIntegration(id: string) {
    return this.request<{ success: boolean }>(
      "DELETE",
      `/api/integrations/${encodeURIComponent(id)}`,
    );
  }

  // --- Learning ---
  getInsights(industry: string) {
    return this.request<{ insight: IndustryInsights }>(
      "GET",
      `/api/learning/insights/${encodeURIComponent(industry)}`,
    );
  }

  // --- AI Analysis ---
  getAiCapabilities() {
    return this.request<{ mode: string; capabilities: unknown[] }>(
      "GET",
      "/api/ai/capabilities",
    );
  }

  runGapAnalysis(scanId: string, framework: string) {
    return this.request<unknown>("POST", "/api/ai/gap-analysis", {
      scanId,
      framework,
    });
  }

  getRemediationRecommendation(findingId: string) {
    return this.request<unknown>(
      "POST",
      `/api/ai/remediation/${encodeURIComponent(findingId)}`,
    );
  }

  getRiskAssessment(industry?: string) {
    return this.request<unknown>("POST", "/api/ai/risk-assessment", {
      industry,
    });
  }

  // --- Threat Intelligence ---
  getThreatDashboard() {
    return this.request<unknown>("GET", "/api/threat-intel/dashboard");
  }

  getCorrelations() {
    return this.request<{ correlations: unknown[]; count: number }>(
      "GET",
      "/api/threat-intel/correlations",
    );
  }

  // --- Policy Designer ---
  getPolicyTemplates(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ templates: unknown[] }>(
      "GET",
      `/api/policies/templates${qs}`,
    );
  }

  generatePolicy(templateId: string, customization: unknown) {
    return this.request<unknown>("POST", "/api/policies/generate", {
      templateId,
      customization,
    });
  }

  getPolicyGaps(frameworks?: string) {
    const qs = frameworks
      ? `?frameworks=${encodeURIComponent(frameworks)}`
      : "";
    return this.request<unknown>("GET", `/api/policies/gaps${qs}`);
  }

  getGeneratedPolicies() {
    return this.request<{ policies: unknown[] }>("GET", "/api/policies");
  }

  // --- Settings ---
  getUserSettings() {
    return this.request<UserSettingsResponse>(
      "GET",
      "/api/settings/user",
    );
  }

  updateUserSettings(data: Partial<UserSettingsUpdate>) {
    return this.request<UserSettingsResponse>(
      "PATCH",
      "/api/settings/user",
      data,
    );
  }

  getApiKeys() {
    return this.request<{ apiKey: string; apiKeys?: ApiKey[] }>(
      "GET",
      "/api/settings/api-keys",
    );
  }

  regenerateApiKey(id: string) {
    return this.request<{ apiKey: string }>(
      "POST",
      `/api/settings/api-keys/${encodeURIComponent(id)}/regenerate`,
    );
  }

  // --- Scan Config ---
  getScanConfig() {
    return this.request<ScanConfigResponse>("GET", "/api/scans/config");
  }

  updateScanConfig(data: Partial<ScanConfigResponse>) {
    return this.request<ScanConfigResponse>(
      "PATCH",
      "/api/scans/config",
      data,
    );
  }

  // --- Trust Center ---
  getTrustData() {
    return this.request<TrustDataResponse>("GET", "/api/trust-center");
  }

  getSovereigntyStatus() {
    return this.request<{ sovereignty: SovereigntyStatus }>(
      "GET",
      "/api/trust-center/sovereignty",
    );
  }

  // --- Privacy Shield ---
  getPrivacyDashboard() {
    return this.request<any>("GET", "/api/privacy/dashboard");
  }

  // --- AI Ethics ---
  getAIEthicsDashboard() {
    return this.request<{ dashboard: AIEthicsDashboard }>(
      "GET",
      "/api/ai-ethics/dashboard",
    );
  }

  // --- Payments ---
  createPaymentOrder(plan: string) {
    return this.request<{ orderId: string; amount: number; currency: string; key: string }>(
      "POST", "/api/payments/create-order", { plan },
    );
  }

  verifyPayment(data: { orderId: string; paymentId: string; signature: string; plan: string }) {
    return this.request<{ success: boolean; plan: string }>(
      "POST", "/api/payments/verify", data,
    );
  }

  getSubscription() {
    return this.request<{ plan: string; status: string; nextBillingDate: string | null }>(
      "GET", "/api/payments/subscription",
    );
  }

  // --- Autopilot / Incidents / Copilot / Calendar / Regulatory / AI Governance ---
  getAutopilot() {
    return this.request<{ autopilot: { frameworks: any[]; agentActivity: any[]; effectiveness: any; cost: any } }>(
      "GET",
      "/api/autopilot",
    );
  }

  getIncidents() {
    return this.request<{ incidents: any[]; pagination: any }>("GET", "/api/incidents");
  }

  getCopilot() {
    return this.request<{ copilot: { suggestedQuestions: string[]; recentConversations: any[]; seedThread: any[] } }>(
      "GET",
      "/api/copilot",
    );
  }

  askCopilot(question: string) {
    return this.request<{ answer: { id: string; role: string; content: string; sources: string[]; timestamp: string } }>(
      "POST",
      "/api/copilot/ask",
      { question },
    );
  }

  getCalendarEvents() {
    return this.request<{ events: any[] }>("GET", "/api/calendar");
  }

  getRegulatoryChanges() {
    return this.request<{ changes: any[] }>("GET", "/api/regulatory");
  }

  getAiGovernance() {
    return this.request<{ iso42001Clauses: any[]; systems: any[]; ethicsDimensions: any[]; decisions: any[] }>(
      "GET",
      "/api/ai-governance",
    );
  }

  // --- Onboarding ---
  submitOnboarding(data: OnboardingData) {
    return this.request<{ success: boolean; nextStep?: string }>(
      "POST",
      "/api/onboarding",
      data,
    );
  }

  getOnboardingStatus() {
    return this.request<OnboardingStatus>(
      "GET",
      "/api/onboarding/status",
    );
  }

  submitOnboardingStep1(data: OnboardingStep1Payload) {
    return this.request<{
      ok: boolean;
      tenant: {
        id: string;
        clientNumber: string;
        legalName: string;
        displayName: string;
        region: string;
        onboardingStatus: string;
      };
      nextStep: string;
    }>("POST", "/api/onboarding/step-1", data);
  }
}

export const api = new ApiClient();

// --- Type definitions ---

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

export interface ControlMatrix {
  framework: string;
  version: string;
  score: number;
  entries: ControlMatrixEntry[];
}

export interface ControlMatrixEntry {
  controlId: string;
  controlName: string;
  weight: number;
  category: string;
  status: "pass" | "fail" | "partial" | "na" | "not_evaluated";
  findingIds: string[];
  evidenceCount: number;
}

export interface Framework {
  framework: string;
  version: string;
  totalControls: number;
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

export interface DriftEvent {
  id: string;
  tenantId: string;
  integrationId: string;
  changeType: "created" | "modified" | "deleted";
  resourceType: string;
  resourceId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  severity: "critical" | "high" | "medium" | "low" | "info";
  acknowledged: boolean;
  detectedAt: string;
}

export interface DriftStats {
  total: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
  byChangeType: Record<string, number>;
}

export interface AlertRule {
  id: string;
  tenantId: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  channels: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTz: string | null;
  enabled: boolean;
}

export interface Client {
  id: string;
  tenantId: string;
  company: string;
  industry: string;
  plan: string;
  complianceScore: number;
  status: string;
  lastScan: string | null;
}

export type EvidenceType = "document" | "screenshot" | "log" | "config";

// Mirrors the `evidence` table as returned by GET /api/evidence. Previously this
// declared name/controlId/uploadedAt/uploadedBy, none of which are columns — the
// list view crashed on the first row of any non-empty vault.
export interface EvidenceArtifact {
  id: string;
  tenantId: string;
  findingId: string;
  type: EvidenceType;
  framework: string | null;
  sha256Hash: string;
  // What sha256Hash actually covers. Only "content" and "reference-fetch" mean the
  // hash is tamper-evident over real evidence bytes; "metadata-only" does not.
  hashSource: "content" | "reference-fetch" | "metadata-only";
  integrityVerified: boolean;
  storagePath: string;
  s3ObjectKey: string | null;
  collectedAt: string;
  collectedBy: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorType: string;
  actorEmail: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  ipAddress: string | null;
  createdAt: string;
}

export type TeamRole = "owner" | "admin" | "engineer" | "viewer";

export interface TeamMember {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "active" | "invited" | "suspended";
  lastLoginAt: string | null;
}

export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface Integration {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  config: Record<string, string>;
}

export interface IndustryInsights {
  industry: string;
  commonFindings: {
    category: string;
    occurrenceRate: number;
    sampleSize: number;
  }[];
  avgRemediationDays: { category: string; avgDays: number }[];
  falsePositiveRates: { category: string; rate: number }[];
  predictedGaps: {
    framework: string;
    controlCategory: string;
    likelihood: number;
  }[];
}

// UserSettings response shape — matches what the settings page consumes
export interface UserSettingsResponse {
  user: { name: string; email: string; role: string } | null;
  notifications?: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
    sms: boolean;
    inApp?: boolean;
    [key: string]: boolean | undefined;
  };
  displayName?: string;
  email?: string;
  timezone?: string;
  twoFactorEnabled?: boolean;
}

// Partial update payload for settings
export interface UserSettingsUpdate {
  displayName?: string;
  email?: string;
  timezone?: string;
  twoFactorEnabled?: boolean;
  notifications?: {
    email?: boolean;
    slack?: boolean;
    webhook?: boolean;
    sms?: boolean;
    inApp?: boolean;
    [key: string]: boolean | undefined;
  };
}

// Keep the old name as an alias for backward compat
export type UserSettings = UserSettingsResponse;

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

// ScanConfig response shape — matches what the scan config page consumes
export interface ScanConfigResponse {
  frameworks?: string[];
  frequency?: string;
  targets?: string[];
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone: string;
  };
  notifications?: {
    onComplete: boolean;
    onFailure: boolean;
  };
  [key: string]: unknown;
}

// Keep the old name as an alias for backward compat
export type ScanConfig = ScanConfigResponse;

// Flexible trust data response — the trust page handles multiple API envelope shapes
export type TrustDataResponse = any;

export interface SovereigntyStatus {
  dataResidency: string;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  keyManagement: string;
  auditLogging: boolean;
}

export interface PrivacyDashboard {
  dataSubjectRequests: {
    pending: number;
    completed: number;
    overdue: number;
  };
  consentRecords: number;
  dataProcessingActivities: number;
  lastDpiaDate: string | null;
  retentionPolicies: { category: string; retentionDays: number }[];
}

export interface AIEthicsDashboard {
  modelInventory: {
    id: string;
    name: string;
    purpose: string;
    riskLevel: "low" | "medium" | "high";
    lastReviewDate: string | null;
  }[];
  biasAssessments: {
    modelId: string;
    score: number;
    reviewedAt: string;
  }[];
  explainabilityScore: number;
  complianceStatus: {
    euAiAct: "compliant" | "partial" | "non_compliant";
    nistAiRmf: "compliant" | "partial" | "non_compliant";
  };
}

export interface OnboardingData {
  companyName: string;
  industry: string;
  teamSize: string;
  primaryFrameworks: string[];
  dataRegions: string[];
  useCase: string;
}

export interface OnboardingContactInput {
  name: string;
  email: string;
  phone?: string;
  timezone?: string;
}

export interface OnboardingStep1Payload {
  legalName: string;
  displayName: string;
  websiteUrl?: string;
  region: string;
  dataResidencyRegion?: string;
  primarySpoc: OnboardingContactInput;
  billingContact: OnboardingContactInput;
  securityContact?: OnboardingContactInput;
  tosAccepted: true;
  tosVersion: string;
  dpaSigned: true;
  dpaSignerName: string;
  dpaSignerEmail: string;
}

export interface OnboardingStatus {
  tenant?: {
    id: string;
    clientNumber: string | null;
    legalName: string | null;
    displayName: string | null;
    region: string | null;
    status: string;
    onboardingStatus: string;
    tosAcceptedAt: string | null;
    dpaSignedAt: string | null;
  };
  primarySpoc: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    timezone: string | null;
  } | null;
  step1Complete: boolean;
  onboardingStatus?: string;
}
