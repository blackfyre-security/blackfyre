'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type OnboardingContactInput, type OnboardingStep1Payload } from '@/lib/api';

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-west-2', label: 'EU (London)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'me-south-1', label: 'Middle East (Bahrain)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
];

const TOS_VERSION = '2026-05-v1';

type ContactKey = 'primarySpoc' | 'billingContact' | 'securityContact';

interface FormState {
  legalName: string;
  displayName: string;
  websiteUrl: string;
  region: string;
  dataResidencyRegion: string;
  primarySpoc: OnboardingContactInput;
  billingContact: OnboardingContactInput;
  securityContact: OnboardingContactInput;
  includeSecurityContact: boolean;
  tosAccepted: boolean;
  dpaSigned: boolean;
  dpaSignerName: string;
  dpaSignerEmail: string;
}

const EMPTY_CONTACT: OnboardingContactInput = { name: '', email: '', phone: '', timezone: '' };

const INITIAL_STATE: FormState = {
  legalName: '',
  displayName: '',
  websiteUrl: '',
  region: '',
  dataResidencyRegion: '',
  primarySpoc: { ...EMPTY_CONTACT },
  billingContact: { ...EMPTY_CONTACT },
  securityContact: { ...EMPTY_CONTACT },
  includeSecurityContact: false,
  tosAccepted: false,
  dpaSigned: false,
  dpaSignerName: '',
  dpaSignerEmail: '',
};

// ── UI primitives (match existing onboarding design language) ─────────────────

function InputField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
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
        className="w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)]"
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

function SectionHeader({
  index,
  title,
  subtitle,
}: {
  index: number;
  title: string;
  subtitle: string;
}) {
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

function ContactBlock({
  contact,
  onChange,
  emailHint,
}: {
  contact: OnboardingContactInput;
  onChange: (c: OnboardingContactInput) => void;
  emailHint?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <InputField
        label="Full name"
        id={`${emailHint}-name`}
        value={contact.name}
        onChange={(v) => onChange({ ...contact, name: v })}
        placeholder="Priya Iyer"
        required
      />
      <InputField
        label="Email"
        id={`${emailHint}-email`}
        type="email"
        value={contact.email}
        onChange={(v) => onChange({ ...contact, email: v })}
        placeholder="priya@acme.com"
        required
      />
      <InputField
        label="Phone"
        id={`${emailHint}-phone`}
        type="tel"
        value={contact.phone ?? ''}
        onChange={(v) => onChange({ ...contact, phone: v })}
        placeholder="+91 98XXX XXXXX"
      />
      <InputField
        label="Timezone"
        id={`${emailHint}-tz`}
        value={contact.timezone ?? ''}
        onChange={(v) => onChange({ ...contact, timezone: v })}
        placeholder="Asia/Kolkata"
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingStep1Page() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientNumber, setClientNumber] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.getOnboardingStatus();
        if (cancelled) return;
        if (status.tenant) {
          setClientNumber(status.tenant.clientNumber);
          if (status.step1Complete) {
            setCompletedAt(status.tenant.dpaSignedAt ?? null);
          }
          setForm((prev) => ({
            ...prev,
            legalName: status.tenant?.legalName ?? '',
            displayName: status.tenant?.displayName ?? '',
            region: status.tenant?.region ?? '',
            tosAccepted: Boolean(status.tenant?.tosAcceptedAt),
            dpaSigned: Boolean(status.tenant?.dpaSignedAt),
            primarySpoc: status.primarySpoc
              ? {
                  name: status.primarySpoc.name,
                  email: status.primarySpoc.email,
                  phone: status.primarySpoc.phone ?? '',
                  timezone: status.primarySpoc.timezone ?? '',
                }
              : prev.primarySpoc,
          }));
        }
      } catch {
        // status fetch is best-effort; first-time tenants will hit defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateContact = (key: ContactKey, c: OnboardingContactInput) => {
    setForm((prev) => ({ ...prev, [key]: c }));
  };

  const isValid =
    form.legalName.trim().length > 0 &&
    form.displayName.trim().length > 0 &&
    form.region !== '' &&
    form.primarySpoc.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(form.primarySpoc.email) &&
    form.billingContact.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(form.billingContact.email) &&
    form.tosAccepted &&
    form.dpaSigned &&
    form.dpaSignerName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(form.dpaSignerEmail) &&
    (!form.includeSecurityContact ||
      (form.securityContact.name.trim().length > 0 &&
        /\S+@\S+\.\S+/.test(form.securityContact.email)));

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const cleanContact = (c: OnboardingContactInput): OnboardingContactInput => ({
        name: c.name.trim(),
        email: c.email.trim(),
        ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}),
        ...(c.timezone?.trim() ? { timezone: c.timezone.trim() } : {}),
      });

      const payload: OnboardingStep1Payload = {
        legalName: form.legalName.trim(),
        displayName: form.displayName.trim(),
        ...(form.websiteUrl.trim() ? { websiteUrl: form.websiteUrl.trim() } : {}),
        region: form.region,
        ...(form.dataResidencyRegion && form.dataResidencyRegion !== form.region
          ? { dataResidencyRegion: form.dataResidencyRegion }
          : {}),
        primarySpoc: cleanContact(form.primarySpoc),
        billingContact: cleanContact(form.billingContact),
        ...(form.includeSecurityContact
          ? { securityContact: cleanContact(form.securityContact) }
          : {}),
        tosAccepted: true,
        tosVersion: TOS_VERSION,
        dpaSigned: true,
        dpaSignerName: form.dpaSignerName.trim(),
        dpaSignerEmail: form.dpaSignerEmail.trim(),
      };

      const result = await api.submitOnboardingStep1(payload);
      setClientNumber(result.tenant.clientNumber);
      setCompletedAt(new Date().toISOString());

      // Small delay so the user sees the confirmation, then advance
      setTimeout(() => router.push('/onboarding'), 1400);
    } catch (err: any) {
      setError(err?.message ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-8 pb-16 px-4 animate-halo-fade-up">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Page header */}
        <div className="text-center mb-8">
          <p className="halo-eyebrow justify-center mb-2">§ 01 · Client Onboarding</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Welcome to BLACKFYRE
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Step 1 of 4 — establish your tenant identity and primary points of contact
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 justify-center mb-8">
          {['Identity', 'AWS Connect', 'Frameworks', 'Launch'].map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-300"
                  style={
                    i === 0
                      ? {
                          background: 'var(--accent-subtle)',
                          border: '2px solid var(--accent)',
                          color: 'var(--accent)',
                        }
                      : {
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }
                  }
                >
                  {i + 1}
                </div>
                <span
                  className="hidden sm:block text-[10px] font-medium tracking-wide"
                  style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {label}
                </span>
              </div>
              {i < 3 && <div className="w-8 sm:w-14 h-px mt-[-20px]" style={{ background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* Client number callout */}
        {clientNumber && (
          <div
            className="card p-4 mb-5 flex items-center justify-between gap-3 animate-fade-up"
            style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border-accent)' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--accent)' }}>
                Your Blackfyre Client ID
              </p>
              <p className="text-lg font-mono font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {clientNumber}
              </p>
            </div>
            <span
              className="text-[10px] px-2 py-1 rounded-md font-medium"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-accent)',
                color: 'var(--accent)',
              }}
            >
              {completedAt ? 'COMPLETED' : 'PROVISIONED'}
            </span>
          </div>
        )}

        {/* Form card */}
        <div className="card p-6 sm:p-8 space-y-7">
          {/* 1. Company identity */}
          <section>
            <SectionHeader
              index={1}
              title="Company identity"
              subtitle="Legal entity details. This becomes your audit-of-record."
            />
            <div className="space-y-3.5">
              <InputField
                label="Legal entity name"
                id="legal-name"
                value={form.legalName}
                onChange={(v) => setForm({ ...form, legalName: v })}
                placeholder="Acme Cloud Services Pvt. Ltd."
                required
                hint="Appears on contracts, SOC2 reports, and invoices."
              />
              <InputField
                label="Display name"
                id="display-name"
                value={form.displayName}
                onChange={(v) => setForm({ ...form, displayName: v })}
                placeholder="Acme"
                required
                hint="Shown in dashboards and emails."
              />
              <InputField
                label="Website"
                id="website"
                type="url"
                value={form.websiteUrl}
                onChange={(v) => setForm({ ...form, websiteUrl: v })}
                placeholder="https://acme.com"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Primary region<span className="text-[var(--critical)] ml-0.5">*</span>
                  </label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)] appearance-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select region</option>
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Data residency
                  </label>
                  <select
                    value={form.dataResidencyRegion}
                    onChange={(e) => setForm({ ...form, dataResidencyRegion: e.target.value })}
                    className="w-full border rounded-md px-3 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,77,0,0.12)] appearance-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Same as primary region</option>
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

          {/* 2. Primary SPOC */}
          <section>
            <SectionHeader
              index={2}
              title="Primary SPOC"
              subtitle="Your single point of contact for incidents, audits, and escalations."
            />
            <ContactBlock
              contact={form.primarySpoc}
              onChange={(c) => updateContact('primarySpoc', c)}
              emailHint="spoc"
            />
          </section>

          <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

          {/* 3. Billing */}
          <section>
            <SectionHeader
              index={3}
              title="Billing contact"
              subtitle="Receives invoices and renewal notices."
            />
            <ContactBlock
              contact={form.billingContact}
              onChange={(c) => updateContact('billingContact', c)}
              emailHint="billing"
            />
          </section>

          <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

          {/* 4. Security contact (optional) */}
          <section>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: form.includeSecurityContact ? 'var(--accent-subtle)' : 'var(--surface-raised)',
                    border: `1px solid ${form.includeSecurityContact ? 'var(--border-accent)' : 'var(--border)'}`,
                    color: form.includeSecurityContact ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  4
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Security contact <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Recommended for SOC2 / ISO27001 audits.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, includeSecurityContact: !form.includeSecurityContact })}
                className="px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                style={{
                  background: form.includeSecurityContact ? 'var(--accent-subtle)' : 'var(--surface)',
                  borderColor: form.includeSecurityContact ? 'var(--border-accent)' : 'var(--border)',
                  color: form.includeSecurityContact ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {form.includeSecurityContact ? 'Remove' : '+ Add'}
              </button>
            </div>
            {form.includeSecurityContact && (
              <div className="animate-fade-up">
                <ContactBlock
                  contact={form.securityContact}
                  onChange={(c) => updateContact('securityContact', c)}
                  emailHint="security"
                />
              </div>
            )}
          </section>

          <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

          {/* 5. Legal acceptance */}
          <section>
            <SectionHeader
              index={5}
              title="Legal acceptance"
              subtitle="Required to provision your tenant. Both records are timestamped and stored in the audit chain."
            />
            <div className="space-y-3">
              <label
                className="flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all duration-200 hover:border-[var(--border-strong)]"
                style={{
                  background: form.tosAccepted ? 'var(--accent-subtle)' : 'var(--surface)',
                  borderColor: form.tosAccepted ? 'var(--border-accent)' : 'var(--border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.tosAccepted}
                  onChange={(e) => setForm({ ...form, tosAccepted: e.target.checked })}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    I accept the Blackfyre Master Services Agreement
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Version {TOS_VERSION} ·{' '}
                    <a
                      href="https://blackfyre.io/legal/msa"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:opacity-70"
                      style={{ color: 'var(--accent)' }}
                    >
                      Read full text
                    </a>
                  </p>
                </div>
              </label>

              <label
                className="flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all duration-200 hover:border-[var(--border-strong)]"
                style={{
                  background: form.dpaSigned ? 'var(--accent-subtle)' : 'var(--surface)',
                  borderColor: form.dpaSigned ? 'var(--border-accent)' : 'var(--border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.dpaSigned}
                  onChange={(e) => setForm({ ...form, dpaSigned: e.target.checked })}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    I authorize the Data Processing Addendum (DPA)
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Required under GDPR Art. 28 and India DPDPA Sec. 7 ·{' '}
                    <a
                      href="https://blackfyre.io/legal/dpa"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:opacity-70"
                      style={{ color: 'var(--accent)' }}
                    >
                      Read DPA
                    </a>
                  </p>
                </div>
              </label>

              {form.dpaSigned && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-fade-up pt-1">
                  <InputField
                    label="Signer name"
                    id="dpa-name"
                    value={form.dpaSignerName}
                    onChange={(v) => setForm({ ...form, dpaSignerName: v })}
                    placeholder="Authorized signatory"
                    required
                  />
                  <InputField
                    label="Signer email"
                    id="dpa-email"
                    type="email"
                    value={form.dpaSignerEmail}
                    onChange={(v) => setForm({ ...form, dpaSignerEmail: v })}
                    placeholder="legal@acme.com"
                    required
                  />
                </div>
              )}
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              className="rounded-md p-3 text-xs animate-fade-up"
              style={{
                background: 'rgba(255, 77, 77, 0.08)',
                border: '1px solid rgba(255, 77, 77, 0.3)',
                color: 'var(--critical-text, #ff6b6b)',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <a
              href="/onboarding"
              className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity text-center sm:text-left"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back to onboarding overview
            </a>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="flex items-center justify-center gap-2.5 py-3 px-6 rounded-md font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                boxShadow: isValid && !submitting ? 'var(--glow-card)' : 'none',
              }}
            >
              {submitting ? (
                <>
                  <span
                    className="w-4 h-4 border-2 rounded-md animate-spin"
                    style={{ borderColor: 'rgba(0,0,0,0.3)', borderTopColor: 'currentColor' }}
                  />
                  Provisioning tenant…
                </>
              ) : completedAt ? (
                <>
                  Continue to AWS Connect
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </>
              ) : (
                <>
                  Provision Tenant
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-center mt-5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Your tenant ID and SPOC details are immutable once provisioned. Contact support to change them.
        </p>
      </div>
    </div>
  );
}
