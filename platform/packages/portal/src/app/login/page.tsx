"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, verifyMfa } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.mfaChallengeToken) {
        setMfaChallengeToken(result.mfaChallengeToken);
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyMfa(mfaChallengeToken!, mfaCode);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid MFA code");
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
          <img
            src="/logo-blackfyre.png"
            alt="Blackfyre"
            height={80}
            width={345}
            className="h-20 w-auto select-none mb-3"
            draggable={false}
          />
          <p className="text-xs mono uppercase tracking-widest mt-1.5" style={{ color: "var(--text-muted)" }}>
            Security Audit Portal
          </p>
        </div>

        <div className="card p-7 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <h2 className="text-base font-semibold mb-5 text-center" style={{ color: "var(--text-primary)" }}>
            {mfaChallengeToken ? "Two-Factor Authentication" : "Sign in to your account"}
          </h2>

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

          {!mfaChallengeToken ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" autoComplete="email" className="input" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                <div className="relative">
                  <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" autoComplete="current-password" className="input" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs" style={{ color: "var(--accent)", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2" style={{ width: "100%", marginTop: 8 }}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Signing in...
                  </span>
                ) : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Verification Code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="input"
                  style={{ letterSpacing: "0.5em", textAlign: "center", fontSize: "20px", fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
              <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn btn-primary btn-lg w-full mt-2" style={{ width: "100%", marginTop: 8 }}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Verifying...
                  </span>
                ) : "Verify"}
              </button>
              <button type="button" onClick={() => { setMfaChallengeToken(null); setMfaCode(""); setError(""); }} className="w-full text-center text-xs mt-2" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                Back to login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--accent)" }}>Sign up</Link>
        </p>
        <p className="text-center text-xs mono mt-3" style={{ color: "var(--text-muted)", opacity: 0.6 }}>v1.0</p>
      </div>
    </div>
  );
}
