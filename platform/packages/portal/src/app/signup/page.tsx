"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { PLANS as CANONICAL_PLANS } from "@blackfyre/shared";

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

type Plan = "comply" | "protect" | "defend";

// REAL IMPL (BLACKFYRE 2026-06): pricing is no longer a hand-typed local constant
// (which had drifted to ₹49,999/₹99,999/₹1,99,999). Price, plan name, and feature
// list now derive from @blackfyre/shared PLANS — the single source of truth — so
// the signup table can never disagree with the charge actually created by
// api.createPaymentOrder (which the API also derives from canonical PLANS). Only
// the marketing-only tagline + "most popular" flag remain UI-local metadata.
const PLAN_PRESENTATION: Record<Plan, { tagline: string; popular?: boolean }> = {
  comply: { tagline: "For startups getting compliant" },
  protect: { tagline: "For growing security teams", popular: true },
  defend: { tagline: "For enterprise-grade security" },
};

const PLAN_ORDER: Plan[] = ["comply", "protect", "defend"];

// Indian-grouped INR (e.g. ₹1,19,999) derived from the canonical monthly rupee price.
function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const PLANS: { id: Plan; name: string; price: string; priceMonthly: string; tagline: string; features: string[]; popular?: boolean }[] =
  PLAN_ORDER.map((id) => {
    const canonical = CANONICAL_PLANS[id];
    const presentation = PLAN_PRESENTATION[id];
    return {
      id,
      name: canonical.name,
      price: formatInr(canonical.priceMonthlyINR),
      priceMonthly: "/mo",
      tagline: presentation.tagline,
      features: canonical.features,
      popular: presentation.popular,
    };
  });

type Step = "plan" | "details" | "payment";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Account details
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Whether this deployment has a payment gateway at all. A self-hosted install
  // has none, and must not be shown a checkout for software it is already
  // hosting. null = not yet known; treat as "payments on" until told otherwise so
  // a failed probe can never silently hand out unpaid accounts on a paid
  // deployment.
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .deploymentConfig()
      .then((cfg) => {
        if (!cancelled) setPaymentsEnabled(!cfg.allowUnpaidRegistration);
      })
      .catch(() => {
        if (!cancelled) setPaymentsEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selfHosted = paymentsEnabled === false;

  // Self-hosted: create the tenant and owner directly, no checkout in between.
  async function registerWithoutPayment() {
    setError("");
    setLoading(true);
    try {
      const result = await api.register({ name, email, password, companyName });
      api.setTokens(result.accessToken, result.refreshToken);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account creation failed");
      setLoading(false);
    }
  }

  function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    setError("");
    setStep("details");
  }

  function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (selfHosted) {
      void registerWithoutPayment();
      return;
    }
    setStep("payment");
  }

  async function handlePayment() {
    if (!selectedPlan) return;
    setError("");
    setLoading(true);

    try {
      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(script);
        });
      }

      const orderData = await api.createPaymentOrder(selectedPlan);

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: "BLACKFYRE",
        description: `${PLANS.find((p) => p.id === selectedPlan)?.name} Plan`,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const regResult = await api.register({ name, email, password, companyName });
            api.setTokens(regResult.accessToken, regResult.refreshToken);
            await api.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              plan: selectedPlan,
            });
            router.push("/onboarding");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Account creation failed after payment. Please contact support.");
            setLoading(false);
          }
        },
        prefill: { name, email },
        theme: { color: "#F59E0B" },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        setError(response?.error?.description || "Payment failed. Please try again.");
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment initialization failed");
      setLoading(false);
    }
  }

  const planLabel = selectedPlan ? PLANS.find((p) => p.id === selectedPlan)?.name : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative" style={{ background: "var(--bg)" }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full" style={{ maxWidth: step === "plan" ? 960 : 420 }}>
        {/* Header */}
        <div className="flex flex-col items-center mb-8 animate-fade-up">
          <div className="w-14 h-14 rounded-md flex items-center justify-center mb-4" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
            <ShieldIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-widest" style={{ color: "var(--text-primary)", letterSpacing: "0.25em" }}>
            BLACKFYRE
          </h1>
          <p className="text-xs mono uppercase tracking-widest mt-1.5" style={{ color: "var(--text-muted)" }}>
            {step === "plan" ? "Choose your plan" : step === "details" ? "Account details" : "Complete payment"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {((selfHosted ? ["plan", "details"] : ["plan", "details", "payment"]) as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                style={{
                  background: step === s ? "var(--accent)" : (["plan", "details", "payment"].indexOf(step) > i ? "var(--accent-subtle)" : "var(--surface)"),
                  color: step === s ? "#000" : (["plan", "details", "payment"].indexOf(step) > i ? "var(--accent)" : "var(--text-muted)"),
                  border: step === s ? "none" : `1px solid ${["plan", "details", "payment"].indexOf(step) > i ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {["plan", "details", "payment"].indexOf(step) > i ? <CheckIcon /> : i + 1}
              </div>
              <span className="text-xs" style={{ color: step === s ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s === "plan" ? "Select Plan" : s === "details" ? "Account" : "Payment"}
              </span>
              {i < 2 && <div style={{ width: 24, height: 1, background: "var(--border)" }} />}
            </div>
          ))}
        </div>

        {/* --- Step 1: Plan Selection --- */}
        {step === "plan" && (
          <div className="animate-fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="card"
                  style={{
                    padding: 28,
                    position: "relative",
                    border: plan.popular ? "1px solid var(--accent)" : "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {plan.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--accent)",
                        color: "#000",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "3px 12px",
                        borderRadius: 99,
                        whiteSpace: "nowrap",
                        fontFamily: "inherit",
                      }}
                    >
                      MOST POPULAR
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>{plan.name}</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{plan.tagline}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{plan.price}</span>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>{plan.priceMonthly}</span>
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent)", flexShrink: 0 }}><CheckIcon /></span>
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={plan.popular ? "btn btn-primary btn-lg" : "btn btn-lg"}
                    style={{ width: "100%", marginTop: "auto" }}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    Select {plan.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Step 2: Account Details --- */}
        {step === "details" && (
          <div className="animate-fade-up">
            <div className="card p-7">
              <h2 className="text-base font-semibold mb-1 text-center" style={{ color: "var(--text-primary)" }}>
                Create your account
              </h2>
              <p className="text-xs text-center mb-5" style={{ color: "var(--text-muted)" }}>
                Plan: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{planLabel}</span>
              </p>

              {error && (
                <div
                  className="mb-4 px-3 py-2.5 rounded-lg text-sm animate-scale-in flex items-center gap-2"
                  style={{ background: "var(--critical-bg)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--critical-text)" }}
                  role="alert"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleDetailsSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                  <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" autoComplete="name" className="input" />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Company Name</label>
                  <input id="company" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required placeholder="Acme Inc." autoComplete="organization" className="input" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Work Email</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" autoComplete="email" className="input" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 8 characters" autoComplete="new-password" className="input" />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repeat your password" autoComplete="new-password" className="input" />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="btn btn-lg"
                    style={{ flex: 1 }}
                    onClick={() => { setStep("plan"); setError(""); }}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 2 }}>
                    Continue to Payment
                  </button>
                </div>

                <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  By signing up, you agree to our{" "}
                  <a href="https://blackfyre.tech/terms" style={{ color: "var(--accent)" }}>Terms</a>
                  {" "}and{" "}
                  <a href="https://blackfyre.tech/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</a>.
                </p>
              </form>
            </div>
          </div>
        )}

        {/* --- Step 3: Payment --- */}
        {step === "payment" && (
          <div className="animate-fade-up">
            <div className="card p-7">
              <h2 className="text-base font-semibold mb-1 text-center" style={{ color: "var(--text-primary)" }}>
                Complete your purchase
              </h2>
              <p className="text-xs text-center mb-5" style={{ color: "var(--text-muted)" }}>
                Plan: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{planLabel}</span>
                {" · "}
                <span style={{ color: "var(--text-secondary)" }}>{PLANS.find((p) => p.id === selectedPlan)?.price}/mo</span>
              </p>

              {error && (
                <div
                  className="mb-4 px-3 py-2.5 rounded-lg text-sm animate-scale-in flex items-center gap-2"
                  style={{ background: "var(--critical-bg)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--critical-text)" }}
                  role="alert"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span>Account</span>
                  <span style={{ color: "var(--text-primary)" }}>{email}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span>Company</span>
                  <span style={{ color: "var(--text-primary)" }}>{companyName}</span>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                <div className="flex justify-between text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  <span>{planLabel} Plan</span>
                  <span style={{ color: "var(--accent)" }}>{PLANS.find((p) => p.id === selectedPlan)?.price}/mo</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-lg"
                  style={{ flex: 1 }}
                  disabled={loading}
                  onClick={() => { setStep("details"); setError(""); }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ flex: 2 }}
                  disabled={loading}
                  onClick={handlePayment}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Processing...
                    </span>
                  ) : "Pay & Activate"}
                </button>
              </div>

              <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                Secured by Razorpay · SSL encrypted
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
