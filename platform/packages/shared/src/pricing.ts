/**
 * Canonical plan definitions — single source of truth for all pricing data.
 * Marketing site (website/) values are authoritative; all other packages must
 * import from here rather than maintaining local copies.
 *
 * Track H will backfill stripePriceId values.
 */

export type PlanId = "comply" | "protect" | "defend";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthlyINR: number;
  priceMonthlyUSD: number;
  cloudsLimit: number | "unlimited";
  frameworksLimit: number | "unlimited";
  scanCadence: "weekly" | "daily" | "continuous";
  aiEnabled: boolean;
  usersLimit: number | "unlimited";
  razorpayPlanId: string;
  stripePriceId?: string; // Track H will fill these
  features: string[];
};

/**
 * Canonical price table — sourced from website/src/data/content.ts platformTiers.
 * Amounts in INR (whole rupees, not paise).
 *
 * Discrepancies that existed before this file:
 *   - platform/packages/api/src/services/payment-service.ts: comply=49,999 protect=99,999 defend=1,99,999
 *   - platform/packages/api/src/config/plan-features.ts: comply=25,000 protect=75,000 defend=1,50,000
 *   - platform/packages/portal/src/app/signup/page.tsx: comply=49,999 protect=99,999 defend=1,99,999
 * Marketing copy (14,999 / 49,999 / 1,19,999) is the public commitment and wins.
 */
export const PLANS: Record<PlanId, Plan> = {
  comply: {
    id: "comply",
    name: "Comply",
    priceMonthlyINR: 14999,
    priceMonthlyUSD: 180,
    cloudsLimit: 1,
    frameworksLimit: 2,
    scanCadence: "weekly",
    aiEnabled: false,
    usersLimit: 5,
    razorpayPlanId: "", // populate with live Razorpay plan ID
    features: [
      "6 compliance frameworks (SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, DPDPA)",
      "Tamper-evident evidence vault (S3 WORM)",
      "Automated evidence collection & SHA-256 integrity",
      "One-click audit bundle export (PDF + artifacts)",
      "Compliance score tracking & trend dashboard",
      "Email alerts & scheduled scan reports",
    ],
  },
  protect: {
    id: "protect",
    name: "Protect",
    priceMonthlyINR: 49999,
    priceMonthlyUSD: 600,
    cloudsLimit: 3,
    frameworksLimit: 6,
    scanCadence: "daily",
    aiEnabled: true,
    usersLimit: 25,
    razorpayPlanId: "", // populate with live Razorpay plan ID
    features: [
      "Everything in Comply",
      "Multi-cloud scanning (AWS, Azure, GCP) — 10-min reports",
      "On-premise agent (Windows/Linux, Active Directory, SNMP)",
      "VAPT scanning with MITRE ATT&CK mapping",
      "AI-powered gap analysis & remediation playbooks",
      "Real-time SSE dashboard with live findings",
      "Human-approved remediation with impact preview",
      "Slack & webhook integrations",
    ],
  },
  defend: {
    id: "defend",
    name: "Defend",
    priceMonthlyINR: 119999,
    priceMonthlyUSD: 1440,
    cloudsLimit: "unlimited",
    frameworksLimit: "unlimited",
    scanCadence: "continuous",
    aiEnabled: true,
    usersLimit: "unlimited",
    razorpayPlanId: "", // populate with live Razorpay plan ID
    features: [
      "Everything in Protect",
      "Continuous monitoring & drift detection",
      "CVE/KEV threat intelligence correlation",
      "OT/SCADA passive scanning (Modbus, DNP3, BACnet)",
      "CERT-In 6-hour SLA tracking & priority alerts",
      "Stakeholder dashboard with client branding",
      "Dedicated support & custom integrations",
      "DPDPA transparency dashboard & data erasure",
    ],
  },
};

/** Razorpay expects amounts in paise (1 INR = 100 paise). */
export function toPaise(inr: number): number {
  return inr * 100;
}

// REAL IMPL (BLACKFYRE 2026-06): Stripe expects amounts in the smallest currency
// unit (USD cents). Mirror toPaise so every charge path derives from the canonical
// USD figure in PLANS instead of a hand-typed cents constant.
export function toCents(usd: number): number {
  return usd * 100;
}

// REAL IMPL (BLACKFYRE 2026-06): canonical per-plan price tables derived directly
// from PLANS — the SINGLE SOURCE OF TRUTH. Importers must use these instead of
// maintaining local PLAN_PRICES copies, which previously drifted (admin had
// 25k/75k/150k, Stripe had $499/$999/$1999) and produced wrong revenue + charges.

/** Canonical monthly price per plan, in whole INR (rupees). */
export const PLAN_PRICE_INR: Record<PlanId, number> = {
  comply: PLANS.comply.priceMonthlyINR,
  protect: PLANS.protect.priceMonthlyINR,
  defend: PLANS.defend.priceMonthlyINR,
};

/** Canonical monthly price per plan, in paise (INR * 100) — Razorpay charge unit. */
export const PLAN_PRICE_INR_PAISE: Record<PlanId, number> = {
  comply: toPaise(PLANS.comply.priceMonthlyINR),
  protect: toPaise(PLANS.protect.priceMonthlyINR),
  defend: toPaise(PLANS.defend.priceMonthlyINR),
};

/** Canonical monthly price per plan, in USD cents — Stripe charge unit. */
export const PLAN_PRICE_USD_CENTS: Record<PlanId, number> = {
  comply: toCents(PLANS.comply.priceMonthlyUSD),
  protect: toCents(PLANS.protect.priceMonthlyUSD),
  defend: toCents(PLANS.defend.priceMonthlyUSD),
};
