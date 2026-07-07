'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ── Step types ────────────────────────────────────────────────────────────────

interface CompanyProfile {
  companyName: string;
  industry: string;
  companySize: string;
  frameworks: string[];
}

interface InfraCredential {
  provider: 'aws' | 'azure' | 'gcp' | '';
  accessKeyId: string;
  secretAccessKey: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
  serviceAccountKey: string;
  tested: boolean;
}

interface ScanConfig {
  services: string[];
  regions: string[];
  frequency: string;
}

const INDUSTRIES = [
  { value: 'fintech', label: 'FinTech' },
  { value: 'healthtech', label: 'HealthTech' },
  { value: 'saas', label: 'SaaS' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'aitech', label: 'AI / Tech' },
  { value: 'custom', label: 'Other' },
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–1000', '1000+'];

const FRAMEWORKS = [
  { value: 'soc2', label: 'SOC 2' },
  { value: 'iso27001', label: 'ISO 27001' },
  { value: 'hipaa', label: 'HIPAA' },
  { value: 'gdpr', label: 'GDPR' },
  { value: 'pcidss', label: 'PCI DSS' },
  { value: 'dpdpa', label: 'DPDPA' },
];

const AWS_SERVICES = ['IAM', 'S3', 'EC2', 'VPC', 'CloudTrail', 'KMS', 'RDS', 'Lambda'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-south-1', 'ap-southeast-1'];
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'on_demand', label: 'On-demand only' },
];

const STEPS = ['Company Profile', 'Connect Infrastructure', 'Scan Configuration', 'Launch'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                i < current
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : i === current
                  ? 'bg-[var(--accent-subtle)] border-2 border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              {i < current ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`hidden sm:block text-[10px] font-medium tracking-wide transition-colors duration-200 ${
                i === current ? 'text-[var(--accent)]' : i < current ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 sm:w-16 h-px mt-[-20px] transition-colors duration-300 ${
                i < current ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 text-sm rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 ${
        selected
          ? 'bg-[var(--accent-subtle)] border-[var(--border-accent)] text-[var(--accent)]'
          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
    </button>
  );
}

function InputField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{required && <span className="text-[var(--critical)] ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      />
    </div>
  );
}

// ── Step 1: Company Profile ───────────────────────────────────────────────────

function StepCompanyProfile({
  data,
  onChange,
}: {
  data: CompanyProfile;
  onChange: (d: CompanyProfile) => void;
}) {
  const toggle = (fw: string) => {
    const next = data.frameworks.includes(fw)
      ? data.frameworks.filter((f) => f !== fw)
      : [...data.frameworks, fw];
    onChange({ ...data, frameworks: next });
  };

  return (
    <div className="space-y-5">
      <InputField
        label="Company Name"
        id="company-name"
        value={data.companyName}
        onChange={(v) => onChange({ ...data, companyName: v })}
        placeholder="Acme Corp"
        required
      />

      <div>
        <label htmlFor="industry" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Industry<span className="text-[var(--critical)] ml-0.5">*</span>
        </label>
        <select
          id="industry"
          value={data.industry}
          onChange={(e) => onChange({ ...data, industry: e.target.value })}
          className="w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)] appearance-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <option value="">Select industry</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind.value} value={ind.value}>
              {ind.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Company Size</label>
        <div className="flex flex-wrap gap-2">
          {COMPANY_SIZES.map((size) => (
            <ToggleChip
              key={size}
              label={size}
              selected={data.companySize === size}
              onToggle={() => onChange({ ...data, companySize: size })}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Compliance Frameworks Needed
        </label>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORKS.map((fw) => (
            <ToggleChip
              key={fw.value}
              label={fw.label}
              selected={data.frameworks.includes(fw.value)}
              onToggle={() => toggle(fw.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Connect Infrastructure ───────────────────────────────────────────

function ProviderTab({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: 'aws' | 'azure' | 'gcp';
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 ${
        active
          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-accent)]'
          : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
      }`}
    >
      {label}
    </button>
  );
}

function StepConnectInfra({
  data,
  onChange,
}: {
  data: InfraCredential;
  onChange: (d: InfraCredential) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    if (!data.provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, string> = {};
      if (data.provider === 'aws') {
        payload.accessKeyId = data.accessKeyId;
        payload.secretAccessKey = data.secretAccessKey;
      } else if (data.provider === 'azure') {
        payload.tenantId = data.tenantId;
        payload.clientId = data.clientId;
        payload.clientSecret = data.clientSecret;
      } else if (data.provider === 'gcp') {
        payload.serviceAccountKey = data.serviceAccountKey;
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/integrations/${data.provider}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json() as { ok: boolean; identity?: string; error?: string };
      if (json.ok) {
        setTestResult('success');
        onChange({ ...data, tested: true });
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Select your cloud provider to connect</p>
        <div className="flex gap-2">
          {(['aws', 'azure', 'gcp'] as const).map((p) => (
            <ProviderTab
              key={p}
              label={p.toUpperCase()}
              value={p}
              active={data.provider === p}
              onSelect={() => onChange({ ...data, provider: p, tested: false })}
            />
          ))}
        </div>
      </div>

      {data.provider === 'aws' && (
        <div className="space-y-4 animate-fade-up">
          <InputField
            label="Access Key ID"
            id="aws-key-id"
            value={data.accessKeyId}
            onChange={(v) => onChange({ ...data, accessKeyId: v })}
            placeholder="AKIA..."
            required
          />
          <InputField
            label="Secret Access Key"
            id="aws-secret"
            type="password"
            value={data.secretAccessKey}
            onChange={(v) => onChange({ ...data, secretAccessKey: v })}
            placeholder="••••••••••••••••••••••••••••••••"
            required
          />
        </div>
      )}

      {data.provider === 'azure' && (
        <div className="space-y-4 animate-fade-up">
          <InputField
            label="Tenant ID"
            id="azure-tenant"
            value={data.tenantId}
            onChange={(v) => onChange({ ...data, tenantId: v })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            required
          />
          <InputField
            label="Client ID"
            id="azure-client-id"
            value={data.clientId}
            onChange={(v) => onChange({ ...data, clientId: v })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            required
          />
          <InputField
            label="Client Secret"
            id="azure-secret"
            type="password"
            value={data.clientSecret}
            onChange={(v) => onChange({ ...data, clientSecret: v })}
            placeholder="••••••••••••••••"
            required
          />
        </div>
      )}

      {data.provider === 'gcp' && (
        <div className="space-y-4 animate-fade-up">
          <InputField
            label="Project ID"
            id="gcp-project"
            value={data.projectId}
            onChange={(v) => onChange({ ...data, projectId: v })}
            placeholder="my-gcp-project"
            required
          />
          <div>
            <label htmlFor="gcp-key" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Service Account Key (JSON)<span className="text-[var(--critical)] ml-0.5">*</span>
            </label>
            <textarea
              id="gcp-key"
              value={data.serviceAccountKey}
              onChange={(e) => onChange({ ...data, serviceAccountKey: e.target.value })}
              placeholder='{"type": "service_account", ...}'
              rows={5}
              className="w-full border rounded-md px-3 py-2.5 text-sm font-mono resize-none transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)]"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
      )}

      {data.provider && (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-[var(--border-accent)] text-[var(--accent)] bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)] hover:border-[var(--border-accent)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          >
            {testing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-amber-500/40 border-t-amber-500 rounded-md animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
          {testResult === 'success' && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--accent)] animate-fade-up">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Connection verified
            </span>
          )}
          {testResult === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--critical-text)] animate-fade-up">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Credentials invalid
            </span>
          )}
        </div>
      )}

      {!data.provider && (
        <p className="text-xs text-[var(--text-secondary)] italic">
          You can also skip this step and connect integrations from the Integrations page later.
        </p>
      )}
    </div>
  );
}

// ── Step 3: Scan Configuration ────────────────────────────────────────────────

function StepScanConfig({
  data,
  onChange,
}: {
  data: ScanConfig;
  onChange: (d: ScanConfig) => void;
}) {
  const toggleService = (s: string) => {
    const next = data.services.includes(s)
      ? data.services.filter((x) => x !== s)
      : [...data.services, s];
    onChange({ ...data, services: next });
  };

  const toggleRegion = (r: string) => {
    const next = data.regions.includes(r)
      ? data.regions.filter((x) => x !== r)
      : [...data.regions, r];
    onChange({ ...data, regions: next });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
          Services to Scan
        </label>
        <div className="flex flex-wrap gap-2">
          {AWS_SERVICES.map((s) => (
            <ToggleChip
              key={s}
              label={s}
              selected={data.services.includes(s)}
              onToggle={() => toggleService(s)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Regions</label>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <ToggleChip
              key={r}
              label={r}
              selected={data.regions.includes(r)}
              onToggle={() => toggleRegion(r)}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="frequency" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Scan Frequency
        </label>
        <select
          id="frequency"
          value={data.frequency}
          onChange={(e) => onChange({ ...data, frequency: e.target.value })}
          className="w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)] appearance-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Step 4: Launch ────────────────────────────────────────────────────────────

function StepLaunch({
  company,
  infra,
  scanConfig,
  onLaunch,
  launching,
  launched,
  submitError,
}: {
  company: CompanyProfile;
  infra: InfraCredential;
  scanConfig: ScanConfig;
  onLaunch: () => void;
  launching: boolean;
  launched: boolean;
  submitError: string | null;
}) {
  const providerLabel = infra.provider ? infra.provider.toUpperCase() : 'None connected';
  const frameworkLabels = FRAMEWORKS.filter((f) => company.frameworks.includes(f.value))
    .map((f) => f.label)
    .join(', ') || 'None selected';

  return (
    <div className="space-y-5">
      {!launched ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">Review your configuration before launching the first scan.</p>

          <div className="space-y-3">
            <SummaryRow label="Company" value={company.companyName || '—'} />
            <SummaryRow label="Industry" value={INDUSTRIES.find((i) => i.value === company.industry)?.label ?? '—'} />
            <SummaryRow label="Company Size" value={company.companySize || '—'} />
            <SummaryRow label="Frameworks" value={frameworkLabels} />
            <SummaryRow
              label="Cloud Provider"
              value={providerLabel}
              badge={infra.tested ? 'verified' : undefined}
            />
            <SummaryRow
              label="Services"
              value={scanConfig.services.length > 0 ? scanConfig.services.join(', ') : 'All'}
            />
            <SummaryRow
              label="Regions"
              value={scanConfig.regions.length > 0 ? scanConfig.regions.join(', ') : 'All'}
            />
            <SummaryRow
              label="Frequency"
              value={FREQUENCIES.find((f) => f.value === scanConfig.frequency)?.label ?? '—'}
            />
          </div>

          {submitError && (
            <p className="text-xs text-[var(--critical-text)] px-1">{submitError}</p>
          )}

          <button
            type="button"
            onClick={onLaunch}
            disabled={launching}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-6 rounded-md bg-[var(--accent)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            style={{ color: "var(--accent-fg)", boxShadow: "var(--glow-card)" }}
          >
            {launching ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-md animate-spin" />
                Launching scan...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Launch First Scan
              </>
            )}
          </button>
        </>
      ) : (
        <div className="text-center py-6 space-y-4 animate-fade-up">
          <div className="w-16 h-16 mx-auto rounded-md bg-[var(--accent-subtle)] border border-[var(--border-accent)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--accent)] mb-1">Scan Launched</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your first compliance scan is underway. Head to the Dashboard to track progress.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[var(--accent-subtle)] border border-[var(--border-accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent-subtle)] transition-all duration-200"
          >
            Go to Dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: 'verified';
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 last:border-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-xs shrink-0 w-28" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm text-right flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        {value}
        {badge === 'verified' && (
          <span className="text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-accent)] px-1.5 py-0.5 rounded-md font-medium">
            Verified
          </span>
        )}
      </span>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [company, setCompany] = useState<CompanyProfile>({
    companyName: '',
    industry: '',
    companySize: '',
    frameworks: [],
  });

  const [infra, setInfra] = useState<InfraCredential>({
    provider: '',
    accessKeyId: '',
    secretAccessKey: '',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    projectId: '',
    serviceAccountKey: '',
    tested: false,
  });

  const [scanConfig, setScanConfig] = useState<ScanConfig>({
    services: [],
    regions: ['us-east-1'],
    frequency: 'weekly',
  });

  const canAdvance = (): boolean => {
    if (step === 0) return company.companyName.trim().length > 0 && company.industry !== '';
    if (step === 1) return true; // infrastructure is optional at onboarding
    if (step === 2) return true;
    return false;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setSubmitError(null);
    try {
      const payload: any = {
        companyName: company.companyName,
        industry: company.industry,
        teamSize: company.companySize,
        primaryFrameworks: company.frameworks,
        dataRegions: scanConfig.regions,
        useCase: scanConfig.services.join(', '),
        cloudProvider: infra.provider || undefined,
        scanFrequency: scanConfig.frequency,
        credentials: infra.provider
          ? {
              provider: infra.provider,
              ...(infra.provider === 'aws' && {
                accessKeyId: infra.accessKeyId,
                secretAccessKey: infra.secretAccessKey,
              }),
              ...(infra.provider === 'azure' && {
                tenantId: infra.tenantId,
                clientId: infra.clientId,
                clientSecret: infra.clientSecret,
              }),
              ...(infra.provider === 'gcp' && {
                projectId: infra.projectId,
                serviceAccountKey: infra.serviceAccountKey,
              }),
            }
          : undefined,
      };
      await api.submitOnboarding(payload);
      setLaunched(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Submission failed. Please try again.');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center pt-8 pb-16 px-4 animate-halo-fade-up">

      <div className="relative z-10 w-full max-w-xl">
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="halo-eyebrow justify-center mb-2">§ 18 · Onboarding</p>
          <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: "var(--text-primary)" }}>
            Get Started with BLACKFYRE
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Complete these steps to launch your first compliance scan
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <h2 className="text-base font-semibold text-[var(--accent)] mb-5 accent-underline">
            {STEPS[step]}
          </h2>

          <div className="min-h-[280px]">
            {step === 0 && (
              <StepCompanyProfile data={company} onChange={setCompany} />
            )}
            {step === 1 && (
              <StepConnectInfra data={infra} onChange={setInfra} />
            )}
            {step === 2 && (
              <StepScanConfig data={scanConfig} onChange={setScanConfig} />
            )}
            {step === 3 && (
              <StepLaunch
                company={company}
                infra={infra}
                scanConfig={scanConfig}
                onLaunch={handleLaunch}
                launching={launching}
                launched={launched}
                submitError={submitError}
              />
            )}
          </div>

          {/* Navigation buttons */}
          {!launched && (
            <div className="flex justify-between items-center mt-8 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 0}
                className="px-4 py-2 text-sm font-medium rounded-md border transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Back
              </button>

              {step < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-md bg-[var(--accent-subtle)] border border-[var(--border-accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] hover:border-[var(--border-accent)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                >
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Skip link */}
        {!launched && step < STEPS.length - 1 && (
          <p className="text-center mt-4">
            <a
              href="/"
              className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-muted)" }}
            >
              Skip setup and go to Dashboard
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
