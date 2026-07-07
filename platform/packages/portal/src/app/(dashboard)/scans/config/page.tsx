"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";

interface Framework {
  id: string;
  name: string;
  controls: number;
}

interface Integration {
  name: string;
  type: string;
  connected: boolean;
}

const FRAMEWORK_META: Framework[] = [
  { id: "soc2", name: "SOC 2", controls: 64 },
  { id: "iso27001", name: "ISO 27001", controls: 114 },
  { id: "hipaa", name: "HIPAA", controls: 54 },
  { id: "gdpr", name: "GDPR", controls: 39 },
  { id: "pcidss", name: "PCI-DSS", controls: 78 },
  { id: "iso42001", name: "ISO 42001", controls: 22 },
];

const frequencies = ["daily", "weekly", "monthly", "manual"] as const;

export default function ScanConfigPage() {
  const [activeFrameworks, setActiveFrameworks] = useState<Set<string>>(new Set());
  const [frequency, setFrequency] = useState<string>("weekly");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);

  // REAL IMPL (BLACKFYRE 2026-06): always load scan config + integrations from
  // the live API. The demo block that seeded fabricated "connected" integrations
  // and frameworks has been removed.
  useEffect(() => {
    Promise.all([api.getScanConfig(), api.getIntegrations()])
      .then(([configRes, intgRes]) => {
        if (configRes.frameworks?.length) {
          setActiveFrameworks(new Set(configRes.frameworks));
        } else {
          setActiveFrameworks(new Set(["soc2", "hipaa"]));
        }
        if (configRes.frequency) setFrequency(configRes.frequency);
        setIntegrations(
          (intgRes.integrations ?? []).map((intg) => ({
            name: intg.name,
            type: intg.type,
            connected: intg.status === "connected",
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load: {error}</div>;

  const toggleFramework = (id: string) => {
    setActiveFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateScanConfig({ frameworks: Array.from(activeFrameworks), frequency });
    } finally {
      setSaving(false);
    }
  };

  const handleStartScan = async () => {
    setLaunching(true);
    try {
      await api.createScan({ frameworks: Array.from(activeFrameworks), targets: [] });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Scans", href: "/scans/config" }, { label: "Configuration" }]} />

      {/* Header */}
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Scan Configuration</h2>

      {/* Framework Selection */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Framework Selection</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FRAMEWORK_META.map((fw) => {
            const active = activeFrameworks.has(fw.id);
            return (
              <button
                key={fw.id}
                onClick={() => toggleFramework(fw.id)}
                className="rounded-md p-4 text-left transition-all border-2"
                style={
                  active
                    ? {
                        borderColor: "var(--accent)",
                        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        boxShadow: "var(--glow-card)",
                      }
                    : {
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                      }
                }
              >
                <p className="font-semibold text-sm" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                  {fw.name}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{fw.controls} controls</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration Sources */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Integration Sources</h3>
        {integrations.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No integrations configured. Connect integrations from the Integrations page.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {integrations.map((intg) => (
              <div key={intg.name} className="glass-card p-4 flex items-center gap-4">
                <div className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                  {intg.name.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{intg.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{intg.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: intg.connected ? "var(--success)" : "var(--text-muted)" }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium" style={{ color: intg.connected ? "var(--success-text)" : "var(--text-muted)" }}>
                    {intg.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Schedule</h3>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="px-3 py-2 text-sm rounded-md input w-48"
        >
          {frequencies.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold rounded-md text-black transition-colors disabled:opacity-60"
          style={{ background: 'var(--accent)', boxShadow: 'var(--glow-card)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
        <button
          onClick={handleStartScan}
          disabled={launching}
          className="px-5 py-2.5 text-sm font-semibold rounded-md border transition-colors disabled:opacity-60"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          {launching ? "Starting..." : "Start Scan"}
        </button>
      </div>
    </div>
  );
}
