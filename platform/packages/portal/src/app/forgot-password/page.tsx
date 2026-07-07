"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8 animate-fade-up">
          <div className="w-14 h-14 rounded-md flex items-center justify-center mb-4" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
            <ShieldIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-widest" style={{ color: "var(--text-primary)", letterSpacing: "0.25em" }}>
            BLACKFYRE
          </h1>
          <p className="text-xs mono uppercase tracking-widest mt-1.5" style={{ color: "var(--text-muted)" }}>
            Security Audit Portal
          </p>
        </div>

        <div className="card p-7 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <h2 className="text-base font-semibold mb-2 text-center" style={{ color: "var(--text-primary)" }}>
            Reset your password
          </h2>
          <p className="text-sm text-center mb-5" style={{ color: "var(--text-muted)" }}>
            Enter your email address and we&apos;ll send you a reset link.
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

          {submitted ? (
            <div className="space-y-4">
              <div
                className="px-3 py-2.5 rounded-lg text-sm flex items-center gap-2"
                style={{ background: "var(--accent-subtle)", border: "1px solid rgba(16,185,129,0.2)", color: "var(--accent)" }}
                role="status"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                If that email is registered, you&apos;ll receive a reset link shortly.
              </div>
              <Link
                href="/login"
                className="block text-center text-sm"
                style={{ color: "var(--accent)", textDecoration: "none" }}
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="input"
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2" style={{ width: "100%", marginTop: 8 }}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Sending...
                  </span>
                ) : "Send reset link"}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-xs" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs mono mt-5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>v1.0</p>
      </div>
    </div>
  );
}
