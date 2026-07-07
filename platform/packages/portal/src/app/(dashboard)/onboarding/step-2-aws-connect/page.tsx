'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ACCESS_COOKIE = 'bf_portal_token';

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${ACCESS_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

const REGION_CHOICES = [
  { value: 'us-east-1', label: 'us-east-1' },
  { value: 'us-east-2', label: 'us-east-2' },
  { value: 'us-west-2', label: 'us-west-2' },
  { value: 'eu-west-1', label: 'eu-west-1' },
  { value: 'eu-central-1', label: 'eu-central-1' },
  { value: 'ap-south-1', label: 'ap-south-1' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1' },
];

interface InitResult {
  cloudAccount: {
    id: string;
    accountId: string;
    externalId: string;
    status: string;
    regions: string[];
  };
  trustPolicy: unknown;
  instructions: {
    cloudformationStackName: string;
    manualSteps: string[];
  };
}

type Phase = 'configure' | 'apply-trust' | 'verifying' | 'verified' | 'error';

// ── UI primitives ─────────────────────────────────────────────────────────────

function InputField({
  label,
  id,
  value,
  onChange,
  placeholder,
  required,
  hint,
  type = 'text',
  monospace,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  type?: string;
  monospace?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span className="text-[var(--critical)] ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)] ${
          monospace ? 'font-mono' : ''
        }`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      />
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0"
        style={{
          background: 'var(--accent-subtle)',
          border: '1px solid var(--border-accent)',
          color: 'var(--accent)',
        }}
      >
        {index}
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ value, label, language = 'json' }: { value: string; label?: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  };
  return (
    <div className="relative group">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
            {label} · {language}
          </span>
          <button
            type="button"
            onClick={copy}
            className="text-[11px] font-medium px-2 py-0.5 rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            style={{
              background: copied ? 'var(--accent-subtle)' : 'var(--surface-raised)',
              border: `1px solid ${copied ? 'var(--border-accent)' : 'var(--border)'}`,
              color: copied ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
      <pre
        className="text-[12px] font-mono p-3 rounded-md overflow-x-auto leading-relaxed"
        style={{
          background: 'var(--surface-raised, #0e0e0e)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </pre>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AwsConnectPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('configure');
  const [accountId, setAccountId] = useState('');
  const [accountAlias, setAccountAlias] = useState('');
  const [regions, setRegions] = useState<string[]>(['us-east-1']);
  const [roleArn, setRoleArn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [init, setInit] = useState<InitResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ callerArn?: string; verifiedAt?: string } | null>(null);

  const toggleRegion = (r: string) => {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  useEffect(() => {
    // If a cloud account already exists for this tenant, surface it
    let cancelled = false;
    (async () => {
      try {
        const list = await apiRequest<{ cloudAccounts: Array<{ id: string; accountId: string; externalId: string; status: string; regions: string[] }> }>(
          'GET',
          '/api/cloud-accounts',
        );
        if (cancelled) return;
        const existing = list.cloudAccounts.find((a: any) => a.status !== 'error');
        if (existing) {
          setAccountId(existing.accountId);
          setRegions(existing.regions);
          setInit({
            cloudAccount: existing,
            trustPolicy: null,
            instructions: {
              cloudformationStackName: 'BlackfyreReadOnlyRole',
              manualSteps: [],
            },
          });
          setPhase(existing.status === 'verified' ? 'verified' : 'apply-trust');
        }
      } catch {
        // first-time tenants land on configure phase
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountIdValid = /^\d{12}$/.test(accountId);
  const roleArnValid = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-/]+$/.test(roleArn);

  const handleInit = async () => {
    if (!accountIdValid || regions.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<InitResult>('POST', '/api/cloud-accounts/aws/init', {
        accountId,
        accountAlias: accountAlias.trim() || undefined,
        regions,
      });
      setInit(result);
      setPhase('apply-trust');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to initialize AWS connection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!init || !roleArnValid) return;
    setSubmitting(true);
    setError(null);
    setPhase('verifying');
    try {
      const result = await apiRequest<{
        ok: boolean;
        cloudAccount: { id: string; status: string; verifiedCallerArn?: string; verifiedAt?: string };
      }>('POST', '/api/cloud-accounts/aws/verify', {
        cloudAccountId: init.cloudAccount.id,
        roleArn,
      });
      if (result.ok && result.cloudAccount.status === 'verified') {
        setVerifyResult({
          callerArn: result.cloudAccount.verifiedCallerArn,
          verifiedAt: result.cloudAccount.verifiedAt,
        });
        setPhase('verified');
      } else {
        setPhase('error');
        setError('Verification did not return a success state. Please retry.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Verification failed. Check the trust policy and try again.');
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const trustPolicyJson = init?.trustPolicy ? JSON.stringify(init.trustPolicy, null, 2) : '';

  return (
    <div className="min-h-screen flex items-start justify-center pt-8 pb-16 px-4 animate-halo-fade-up">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="halo-eyebrow justify-center mb-2">§ 02 · AWS Connect</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Connect Your AWS Account
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Step 2 of 4 — establish a cross-account read-only trust so Blackfyre can scan your infrastructure
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 justify-center mb-8">
          {['Identity', 'AWS Connect', 'Frameworks', 'Launch'].map((label, i) => {
            const done = i < 1 || (i === 1 && phase === 'verified');
            const active = i === 1 && phase !== 'verified';
            return (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-300"
                    style={
                      done
                        ? { background: 'var(--accent)', color: 'var(--accent-fg)', border: '2px solid var(--accent)' }
                        : active
                        ? { background: 'var(--accent-subtle)', border: '2px solid var(--accent)', color: 'var(--accent)' }
                        : { background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                    }
                  >
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className="hidden sm:block text-[10px] font-medium tracking-wide"
                    style={{ color: done || active ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    {label}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className="w-8 sm:w-14 h-px mt-[-20px]"
                    style={{ background: done ? 'var(--accent)' : 'var(--border)' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Phase: verified callout */}
        {phase === 'verified' && verifyResult && (
          <div
            className="card p-4 mb-5 animate-fade-up"
            style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border-accent)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-accent)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  AWS account verified
                </p>
                <p className="text-xs mt-0.5 font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                  {verifyResult.callerArn}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="card p-6 sm:p-8 space-y-7">
          {/* ── Phase: configure ── */}
          {phase === 'configure' && (
            <>
              <section>
                <SectionHeader
                  index={1}
                  title="AWS account details"
                  subtitle="Enter the 12-digit AWS account ID you want Blackfyre to scan."
                />
                <div className="space-y-3.5">
                  <InputField
                    label="AWS Account ID"
                    id="aws-account-id"
                    value={accountId}
                    onChange={(v) => setAccountId(v.replace(/\D/g, '').slice(0, 12))}
                    placeholder="123456789012"
                    monospace
                    required
                    hint="Found in AWS Console → top-right account dropdown."
                  />
                  <InputField
                    label="Account alias"
                    id="aws-alias"
                    value={accountAlias}
                    onChange={setAccountAlias}
                    placeholder="Production · Mumbai"
                    hint="Optional. Helps distinguish accounts in dashboards."
                  />
                </div>
              </section>

              <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

              <section>
                <SectionHeader
                  index={2}
                  title="Regions to scan"
                  subtitle="Select all AWS regions where you have workloads. You can add more later."
                />
                <div className="flex flex-wrap gap-2">
                  {REGION_CHOICES.map((r) => {
                    const sel = regions.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRegion(r.value)}
                        className="px-3 py-1.5 text-sm font-mono rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                        style={{
                          background: sel ? 'var(--accent-subtle)' : 'var(--surface)',
                          borderColor: sel ? 'var(--border-accent)' : 'var(--border)',
                          color: sel ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {regions.length} region{regions.length === 1 ? '' : 's'} selected
                </p>
              </section>

              {error && (
                <div
                  className="rounded-md p-3 text-xs"
                  style={{
                    background: 'rgba(255, 77, 77, 0.08)',
                    border: '1px solid rgba(255, 77, 77, 0.3)',
                    color: 'var(--critical-text, #ff6b6b)',
                  }}
                >
                  {error}
                </div>
              )}

              <div className="pt-2 flex justify-between items-center">
                <a
                  href="/onboarding/step-1"
                  className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ← Back to identity
                </a>
                <button
                  type="button"
                  onClick={handleInit}
                  disabled={!accountIdValid || regions.length === 0 || submitting}
                  className="flex items-center justify-center gap-2.5 py-3 px-6 rounded-md font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    boxShadow: accountIdValid && regions.length > 0 ? 'var(--glow-card)' : 'none',
                  }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="w-4 h-4 border-2 rounded-md animate-spin"
                        style={{ borderColor: 'rgba(0,0,0,0.3)', borderTopColor: 'currentColor' }}
                      />
                      Generating trust policy…
                    </>
                  ) : (
                    <>
                      Generate Trust Policy
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Phase: apply-trust / verifying / error ── */}
          {(phase === 'apply-trust' || phase === 'verifying' || phase === 'error') && init && (
            <>
              <section>
                <SectionHeader
                  index={1}
                  title="Apply the trust policy in your AWS account"
                  subtitle="Paste the policy below into a new IAM role. The external ID prevents the confused-deputy problem."
                />

                <div className="space-y-4">
                  <div
                    className="rounded-md p-3.5 flex items-start gap-3"
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--border-accent)' }}
                    >
                      ID
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                        External ID (one-time, per-tenant)
                      </p>
                      <p className="text-sm font-mono break-all" style={{ color: 'var(--text-primary)' }}>
                        {init.cloudAccount.externalId}
                      </p>
                    </div>
                  </div>

                  {trustPolicyJson && (
                    <CodeBlock value={trustPolicyJson} label="Trust policy" language="json" />
                  )}

                  <ol className="space-y-2 text-xs pl-1" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: 'var(--accent)' }}>1.</span>
                      <span>Open AWS Console → IAM → Roles → Create role.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: 'var(--accent)' }}>2.</span>
                      <span>Choose &quot;Custom trust policy&quot; and paste the JSON above.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: 'var(--accent)' }}>3.</span>
                      <span>
                        Attach the AWS managed policies <code className="font-mono text-[var(--accent)]">SecurityAudit</code>
                        {' '}and <code className="font-mono text-[var(--accent)]">ViewOnlyAccess</code>.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: 'var(--accent)' }}>4.</span>
                      <span>Name the role e.g. <code className="font-mono text-[var(--accent)]">BlackfyreReadOnlyRole</code>, then copy the ARN.</span>
                    </li>
                  </ol>
                </div>
              </section>

              <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

              <section>
                <SectionHeader
                  index={2}
                  title="Verify the connection"
                  subtitle="Paste the role ARN you just created. We'll assume the role and confirm round-trip access."
                />
                <InputField
                  label="IAM role ARN"
                  id="role-arn"
                  value={roleArn}
                  onChange={setRoleArn}
                  placeholder="arn:aws:iam::123456789012:role/BlackfyreReadOnlyRole"
                  monospace
                  required
                />
              </section>

              {error && (
                <div
                  className="rounded-md p-3 text-xs animate-fade-up"
                  style={{
                    background: 'rgba(255, 77, 77, 0.08)',
                    border: '1px solid rgba(255, 77, 77, 0.3)',
                    color: 'var(--critical-text, #ff6b6b)',
                  }}
                >
                  <strong>Verification failed.</strong> {error}
                </div>
              )}

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setPhase('configure')}
                  className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ← Change AWS account
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!roleArnValid || submitting}
                  className="flex items-center justify-center gap-2.5 py-3 px-6 rounded-md font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    boxShadow: roleArnValid && !submitting ? 'var(--glow-card)' : 'none',
                  }}
                >
                  {phase === 'verifying' || submitting ? (
                    <>
                      <span
                        className="w-4 h-4 border-2 rounded-md animate-spin"
                        style={{ borderColor: 'rgba(0,0,0,0.3)', borderTopColor: 'currentColor' }}
                      />
                      Calling sts:AssumeRole…
                    </>
                  ) : (
                    <>
                      Verify Connection
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Phase: verified ── */}
          {phase === 'verified' && (
            <div className="text-center py-4 space-y-5 animate-fade-up">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--accent)' }}>
                  Account
                </p>
                <p className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {init?.cloudAccount.accountId}
                </p>
                {accountAlias && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {accountAlias}
                  </p>
                )}
              </div>
              <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Blackfyre can now scan your AWS workloads across{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{regions.length} region{regions.length === 1 ? '' : 's'}</strong>.
                You can connect additional accounts later from the Cloud Accounts page.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => router.push('/onboarding')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    boxShadow: 'var(--glow-card)',
                  }}
                >
                  Continue to Frameworks
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footnote */}
        {phase !== 'verified' && (
          <p className="text-center mt-5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            We use AWS STS with an external ID, never long-lived access keys. The IAM role grants
            read-only access — Blackfyre cannot modify your infrastructure without an explicit remediation approval.
          </p>
        )}
      </div>
    </div>
  );
}
