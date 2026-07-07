"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Integration, IntegrationStatus } from "@/lib/api";

interface IntegrationTemplate {
  type: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
}

const integrationTemplates: IntegrationTemplate[] = [
  {
    type: "aws",
    name: "AWS",
    category: "Cloud",
    description: "Amazon Web Services — EC2, S3, IAM, CloudTrail",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 8c0 1-1 2-3 2H7c-2 0-3-1-3-2s1-2 3-2h7c2 0 3 1 3 2z" />
        <path d="M7 12c-2 0-3 1-3 2s1 2 3 2h3" />
        <path d="M17 16c2 0 3-1 3-2s-1-2-3-2h-3" />
      </svg>
    ),
  },
  {
    type: "azure",
    name: "Azure",
    category: "Cloud",
    description: "Microsoft Azure — VMs, Storage, Active Directory",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 2 19.5 22 19.5 12 2" />
        <line x1="12" y1="9" x2="7" y2="19.5" />
      </svg>
    ),
  },
  {
    type: "gcp",
    name: "GCP",
    category: "Cloud",
    description: "Google Cloud Platform — Compute, Storage, IAM",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 12h5" />
        <path d="M12 7v5" />
      </svg>
    ),
  },
  {
    type: "okta",
    name: "Okta",
    category: "Identity",
    description: "Identity provider — SSO, MFA, user lifecycle",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    ),
  },
  {
    type: "azure_ad",
    name: "Azure AD",
    category: "Identity",
    description: "Microsoft Entra ID — users, groups, conditional access",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    type: "google_workspace",
    name: "Google Workspace",
    category: "Identity",
    description: "Google Workspace — Gmail, Drive, admin console",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
      </svg>
    ),
  },
  {
    type: "jamf",
    name: "Jamf",
    category: "Endpoint",
    description: "Apple device management — MDM, policies, inventory",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    type: "intune",
    name: "Intune",
    category: "Endpoint",
    description: "Microsoft Intune — Windows/mobile device management",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    type: "crowdstrike",
    name: "CrowdStrike",
    category: "Security",
    description: "EDR platform — threat detection, incidents, IOCs",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    type: "network",
    name: "Network",
    category: "Infrastructure",
    description: "Network devices — routers, switches, firewall logs",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <line x1="12" y1="7" x2="5" y2="17" />
        <line x1="12" y1="7" x2="19" y2="17" />
        <line x1="5" y1="19" x2="19" y2="19" />
      </svg>
    ),
  },
];

const statusConfig: Record<IntegrationStatus, { bg: string; text: string; dotClass: string; label: string }> = {
  connected:    { bg: "bg-[var(--success-bg)]",  text: "text-[var(--success-text)]",  dotClass: "bg-[var(--success)]",    label: "Connected" },
  disconnected: { bg: "bg-[var(--surface-raised)]",   text: "text-[var(--text-secondary)]",   dotClass: "bg-gray-400",   label: "Disconnected" },
  error:        { bg: "bg-[var(--critical-bg)]",    text: "text-[var(--critical-text)]",    dotClass: "bg-[var(--critical)]",  label: "Error" },
};

const categoryColors: Record<string, string> = {
  Cloud:          "text-[var(--low-text)]",
  Identity:       "text-[var(--info-text)]",
  Endpoint:       "text-[var(--success-text)]",
  Infrastructure: "text-[var(--medium-text)]",
  Security:       "text-[var(--critical-text)]",
};

function ConnectModal({
  template,
  onClose,
  onConnected,
}: {
  template: IntegrationTemplate;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields: { key: string; label: string; placeholder: string }[] = {
    aws:              [{ key: "roleArn", label: "IAM Role ARN", placeholder: "arn:aws:iam::123456789:role/BlackfyreScan" }],
    azure:            [{ key: "tenantId", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }, { key: "clientId", label: "Client ID", placeholder: "Application (client) ID" }, { key: "clientSecret", label: "Client Secret", placeholder: "••••••••" }],
    gcp:              [{ key: "projectId", label: "Project ID", placeholder: "my-gcp-project" }, { key: "serviceAccountKey", label: "Service Account JSON", placeholder: '{"type":"service_account",...}' }],
    okta:             [{ key: "domain", label: "Okta Domain", placeholder: "company.okta.com" }, { key: "apiToken", label: "API Token", placeholder: "••••••••" }],
    azure_ad:         [{ key: "tenantId", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }, { key: "clientId", label: "Client ID", placeholder: "Application (client) ID" }, { key: "clientSecret", label: "Client Secret", placeholder: "••••••••" }],
    google_workspace: [{ key: "domain", label: "Domain", placeholder: "company.com" }, { key: "serviceAccountKey", label: "Service Account JSON", placeholder: '{"type":"service_account",...}' }],
    jamf:             [{ key: "serverUrl", label: "Server URL", placeholder: "https://company.jamfcloud.com" }, { key: "clientId", label: "Client ID", placeholder: "••••••••" }, { key: "clientSecret", label: "Client Secret", placeholder: "••••••••" }],
    intune:           [{ key: "tenantId", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }, { key: "clientId", label: "Client ID", placeholder: "Application (client) ID" }, { key: "clientSecret", label: "Client Secret", placeholder: "••••••••" }],
    crowdstrike:      [{ key: "clientId", label: "Client ID", placeholder: "••••••••" }, { key: "clientSecret", label: "Client Secret", placeholder: "••••••••" }, { key: "baseUrl", label: "Base URL", placeholder: "https://api.crowdstrike.com" }],
    network:          [{ key: "host", label: "Host / IP", placeholder: "192.168.1.1" }, { key: "community", label: "SNMP Community", placeholder: "public" }],
  }[template.type] ?? [{ key: "apiKey", label: "API Key", placeholder: "••••••••" }];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createIntegration({ type: template.type, config });
      onConnected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md mx-4 card rounded-md shadow-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
          >
            {template.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Connect {template.name}</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{field.label}</label>
              <input
                type={field.key.toLowerCase().includes("secret") || field.key.toLowerCase().includes("key") || field.key.toLowerCase().includes("token") ? "password" : "text"}
                value={config[field.key] ?? ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="input"
              />
            </div>
          ))}

          {error && <p className="text-xs text-[var(--critical-text)]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_INTEGRATIONS fixture (fabricated
// "connected" cloud integrations) and DEMO_MODE bypass have been removed.
// Integrations are sourced only from the live API (api.getIntegrations).

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectTemplate, setConnectTemplate] = useState<IntegrationTemplate | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  async function fetchIntegrations() {
    // REAL IMPL (BLACKFYRE 2026-06): always load integrations from the live API.
    try {
      setLoading(true);
      setError(null);
      const res = await api.getIntegrations();
      setIntegrations(res.integrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchIntegrations(); }, []);

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await api.testIntegration(id);
      setTestResults((prev) => ({ ...prev, [id]: { ok: res.success, msg: res.message } }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, msg: err instanceof Error ? err.message : "Test failed" } }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDisconnect(id: string) {
    setRemovingId(id);
    try {
      await api.deleteIntegration(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setRemovingId(null);
      setConfirmDisconnect(null);
    }
  }

  // Build a map of type -> live integration
  const connectedByType = new Map<string, Integration>(integrations.map((i) => [i.type, i]));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading integrations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Integrations</h2>
        <div className="card rounded-md p-8 text-center">
          <p className="text-[var(--critical-text)] text-sm">Error: {error}</p>
          <button
            onClick={fetchIntegrations}
            className="mt-3 text-xs transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(integrationTemplates.map((t) => t.category)));

  return (
    <div className="space-y-6 animate-halo-fade-up">
      {connectTemplate && (
        <ConnectModal template={connectTemplate} onClose={() => setConnectTemplate(null)} onConnected={fetchIntegrations} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="halo-eyebrow mb-2">§ 23 · Integrations</p>
          <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Integrations</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Connect cloud providers and third-party services &mdash;{" "}
            <span className="font-medium" style={{ color: "var(--success-text)" }}>{integrations.filter((i) => i.status === "connected").length} connected</span>
          </p>
        </div>
      </div>

      {/* Category groups */}
      {categories.map((category) => {
        const templates = integrationTemplates.filter((t) => t.category === category);
        const categoryColor = categoryColors[category] ?? "text-[var(--text-muted)]";
        return (
          <div key={category}>
            <h3 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${categoryColor}`}>{category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((template) => {
                const live = connectedByType.get(template.type);
                const status: IntegrationStatus = live?.status ?? "disconnected";
                const sc = statusConfig[status] ?? statusConfig.disconnected;
                const tr = testResults[live?.id ?? ""];

                return (
                  <div
                    key={template.type}
                    className="card rounded-md shadow-sm p-5 flex flex-col gap-4"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="w-11 h-11 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                      >
                        {template.icon}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium ${sc.bg} ${sc.text} shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dotClass}`} aria-hidden="true" />
                        {sc.label}
                      </span>
                    </div>

                    {/* Name / description */}
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{template.name}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{template.description}</p>
                      {live?.lastSyncAt && (
                        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                          Last sync: {new Date(live.lastSyncAt).toLocaleDateString()}
                        </p>
                      )}
                      {tr && (
                        <p className={`text-xs mt-1.5 ${tr.ok ? "text-[var(--success-text)]" : "text-[var(--critical-text)]"}`}>{tr.msg}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!live || live.status === "disconnected" ? (
                        <button
                          onClick={() => setConnectTemplate(template)}
                          className="btn btn-primary btn-sm flex-1"
                        >
                          Connect
                        </button>
                      ) : confirmDisconnect === live.id ? (
                        <div className="flex gap-1 w-full">
                          <button
                            className="btn btn-sm flex-1"
                            style={{ background: "var(--critical)", color: "#fff", fontSize: 11 }}
                            onClick={() => handleDisconnect(live.id)}
                            disabled={removingId === live.id}
                          >
                            {removingId === live.id ? "..." : "Confirm"}
                          </button>
                          <button
                            className="btn btn-sm flex-1"
                            style={{ fontSize: 11 }}
                            onClick={() => setConfirmDisconnect(null)}
                            disabled={removingId === live.id}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleTest(live.id)}
                            disabled={testingId === live.id}
                            className="btn btn-secondary btn-sm flex-1"
                          >
                            {testingId === live.id ? "Testing..." : "Test"}
                          </button>
                          <button
                            onClick={() => setConfirmDisconnect(live.id)}
                            disabled={removingId === live.id}
                            className="btn btn-sm px-3 py-1.5 text-xs rounded-lg border border-[var(--critical)]/20 text-[var(--critical-text)] hover:bg-[var(--critical-bg)] transition-colors disabled:opacity-50 font-medium"
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
