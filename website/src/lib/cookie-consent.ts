/**
 * Cookie consent state — minimal localStorage-backed flag for DPDPA/GDPR.
 *
 * Plausible (the only analytics on the site today) is cookieless and does not
 * legally require consent. The banner is kept so the user has a clear path to
 * decline categories ahead of any future non-cookieless analytics being added.
 */

const STORAGE_KEY = "bfy_cookie_consent_v1";

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string; // ISO timestamp
}

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.necessary !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(input: { analytics: boolean; marketing: boolean }): void {
  if (typeof window === "undefined") return;
  const state: ConsentState = {
    necessary: true,
    analytics: input.analytics,
    marketing: input.marketing,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or storage disabled — silently ignore */
  }
}

export function acceptedCategory(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  const state = readConsent();
  if (!state) return false;
  return state[category] === true;
}
