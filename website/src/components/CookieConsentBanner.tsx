"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, writeConsent } from "@/lib/cookie-consent";

/**
 * Brand-matched cookie consent banner. Functional behaviour matches the
 * launch-blockers vanilla-cookieconsent setup (necessary always on, analytics +
 * marketing toggleable, localStorage-persisted), but visuals use halo tokens.
 *
 * Only renders when no decision is on file yet. Click "Accept all" / "Necessary
 * only" closes it; opening preferences offers per-category control.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    writeConsent({ analytics: true, marketing: true });
    setVisible(false);
  };

  const necessaryOnly = () => {
    writeConsent({ analytics: false, marketing: false });
    setVisible(false);
  };

  const savePrefs = () => {
    writeConsent({ analytics, marketing });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-6 shadow-halo-glow backdrop-blur"
    >
      {!showPrefs ? (
        <>
          <p className="halo-eyebrow">§ Privacy</p>
          <h2 className="mt-3 font-display text-[18px] font-medium leading-tight text-text">
            We value your privacy.
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
            Plausible (cookieless) is the only analytics on this site today. The
            banner is here so you keep control if we add anything heavier. See
            our{" "}
            <Link href="/privacy" className="underline hover:text-text">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={acceptAll}
              className="halo-btn-accent text-[12px]"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={necessaryOnly}
              className="halo-btn-ghost text-[12px]"
            >
              Necessary only
            </button>
            <button
              type="button"
              onClick={() => setShowPrefs(true)}
              className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
            >
              Manage
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="halo-eyebrow">§ Cookie preferences</p>
          <ul className="mt-4 space-y-3 text-[13px]">
            <li className="flex items-start gap-3">
              <input
                type="checkbox"
                checked
                disabled
                aria-label="Strictly necessary (always on)"
                className="mt-1"
              />
              <div>
                <p className="font-medium text-text">Strictly necessary</p>
                <p className="text-text-muted">
                  Required for auth, security, and core platform functions. Cannot
                  be disabled.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <input
                id="cookie-analytics"
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="cookie-analytics" className="cursor-pointer">
                <p className="font-medium text-text">Analytics</p>
                <p className="text-text-muted">
                  Gates any future non-cookieless analytics (Plausible today is
                  cookieless and runs regardless).
                </p>
              </label>
            </li>
            <li className="flex items-start gap-3">
              <input
                id="cookie-marketing"
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="cookie-marketing" className="cursor-pointer">
                <p className="font-medium text-text">Marketing</p>
                <p className="text-text-muted">
                  Reserved for future targeted-ad pixels. No marketing scripts
                  active today.
                </p>
              </label>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={savePrefs}
              className="halo-btn-accent text-[12px]"
            >
              Save preferences
            </button>
            <button
              type="button"
              onClick={() => setShowPrefs(false)}
              className="halo-btn-ghost text-[12px]"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
