"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
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
            Set a new password
          </h2>
          {!success && (
            <p className="text-sm text-center mb-5" style={{ color: "var(--text-muted)" }}>
              Choose a strong password for your account.
            </p>
          )}

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

          {success ? (
            <div className="space-y-4">
              <div
                className="px-3 py-2.5 rounded-lg text-sm flex items-center gap-2"
                style={{ background: "var(--accent-subtle)", border: "1px solid rgba(16,185,129,0.2)", color: "var(--accent)" }}
                role="status"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Password has been reset. You can now sign in with your new password.
              </div>
              <Link
                href="/login"
                className="btn btn-primary btn-lg w-full mt-2 text-center block"
                style={{ width: "100%", marginTop: 8, textDecoration: "none" }}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>New password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="input"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm password</label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    className="input"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
                    <EyeIcon off={showConfirm} />
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2" style={{ width: "100%", marginTop: 8 }}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Resetting...
                  </span>
                ) : "Reset password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
