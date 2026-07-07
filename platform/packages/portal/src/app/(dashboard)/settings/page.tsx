"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface NotificationPrefs {
  email: boolean;
  slack: boolean;
  webhook: boolean;
  sms: boolean;
}

export default function SettingsPage() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  // REAL IMPL (BLACKFYRE 2026-06): the BLACKFYRE customer ID is the real
  // tenant.clientNumber sourced from the onboarding status endpoint — never the
  // fabricated "BFR-2026-000000" placeholder that was hard-coded here before.
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    email: true,
    slack: true,
    webhook: false,
    sms: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // REAL IMPL (BLACKFYRE 2026-06): always load settings/API key from the live
  // API. The demo block that seeded fabricated user PII and a FAKE live-looking
  // API key (bfy_live_sk_...) has been removed — never present a synthetic
  // secret to the operator.
  useEffect(() => {
    // REAL IMPL (BLACKFYRE 2026-06): the real tenant.clientNumber is fetched
    // alongside settings + API key. getOnboardingStatus is non-fatal — if it
    // fails or the number is not yet assigned, the field renders an honest
    // "Not yet assigned" state rather than a fabricated ID.
    Promise.all([
      api.getUserSettings(),
      api.getApiKeys(),
      api.getOnboardingStatus().catch(() => null),
    ])
      .then(([settingsRes, keyRes, onboardingRes]) => {
        setUser(settingsRes.user);
        if (settingsRes.notifications) {
          setNotifications({
            email: settingsRes.notifications.email ?? true,
            slack: settingsRes.notifications.slack ?? true,
            webhook: settingsRes.notifications.webhook ?? false,
            sms: settingsRes.notifications.sms ?? false,
          });
        }
        setApiKey(keyRes.apiKey ?? "");
        setCustomerId(onboardingRes?.tenant?.clientNumber ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load: {error}</div>;

  const toggleNotification = (key: keyof NotificationPrefs) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    setSaving(true);
    api.updateUserSettings({ notifications: next })
      .finally(() => setSaving(false));
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl animate-halo-fade-up">
      <div>
        <p className="halo-eyebrow mb-2">§ 13 · Settings</p>
        <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>
          Settings{saving && <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">Saving...</span>}
        </h2>
      </div>

      {/* Profile Section */}
      <div className="card rounded-md shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Profile</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Name</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {user?.name}
            </span>
          </div>
          <div className="divider" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Email</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {user?.email}
            </span>
          </div>
          <div className="divider" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Role</span>
            <span
              className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {user?.role}
            </span>
          </div>
          <div className="divider" />
          {/* REAL IMPL (BLACKFYRE 2026-06): read-only, immutable BLACKFYRE
              customer ID is the real tenant.clientNumber from the API. When the
              tenant has not yet been assigned one, show an honest empty state
              instead of a synthetic account number. */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>BLACKFYRE Customer ID</span>
            {customerId ? (
              <span
                className="font-mono text-xs px-2 py-1 rounded border"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border)",
                  letterSpacing: "0.05em",
                }}
                title="Immutable BLACKFYRE customer account number"
              >
                {customerId}
              </span>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Not yet assigned
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alert Preferences */}
      <div className="card rounded-md shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Alert Preferences
        </h3>
        <div className="space-y-3">
          {(
            [
              { key: "email" as const, label: "Email Notifications", desc: "Receive alerts via email" },
              { key: "slack" as const, label: "Slack Notifications", desc: "Post alerts to Slack channel" },
              { key: "webhook" as const, label: "Webhook Notifications", desc: "Send alerts to webhook URL" },
              { key: "sms" as const, label: "SMS Notifications", desc: "Receive critical alerts via SMS" },
            ]
          ).map((item, i) => (
            <div key={item.key}>
              {i > 0 && <div className="divider mb-3" />}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={() => toggleNotification(item.key)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="card rounded-md shadow-sm p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>API Key</h3>
        {apiKey ? (
          <>
            <div className="flex items-center gap-3">
              <code
                className="flex-1 px-3 py-2.5 text-sm rounded-md font-mono border"
                style={{
                  background: "var(--surface-raised)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {apiKey}
              </code>
              <button
                onClick={copyApiKey}
                className="btn btn-primary btn-sm shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
              Use this key to authenticate API requests. Keep it secret.
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No API key found.</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card rounded-md shadow-sm p-5 border-2 border-[var(--critical)]/20">
        <h3 className="text-sm font-semibold text-[var(--critical)] mb-4">
          Danger Zone
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Delete Account</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Permanently remove your account and all data
            </p>
          </div>
          <button
            disabled
            className="px-3 py-1.5 text-xs font-medium rounded-md cursor-not-allowed border"
            style={{ background: "var(--critical-bg)", color: "var(--critical-text)", borderColor: "color-mix(in srgb, var(--critical) 20%, transparent)" }}
            title="Contact admin to delete your account"
          >
            Contact admin
          </button>
        </div>
      </div>
    </div>
  );
}
