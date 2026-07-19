"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError(err instanceof Error ? err.message : "Access denied");
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
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-md pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
          transform: "translate(30%, -30%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-md pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
          transform: "translate(-30%, 30%)",
        }}
      />

      <div className="w-full max-w-[380px] relative z-10 animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo-blackfyre.png"
            alt="Blackfyre"
            height={80}
            width={345}
            className="h-20 w-auto select-none mb-2"
            draggable={false}
          />
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            Admin Portal
          </p>
        </div>

        <div
          className="rounded-md p-8"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-overlay)",
          }}
        >
          <h2
            className="text-[15px] font-semibold mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            {mfaChallengeToken ? "Two-Factor Authentication" : "Sign in to your account"}
          </h2>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-[13px]"
              style={{
                background: "var(--critical-bg)",
                border: "1px solid var(--critical)",
                color: "var(--critical-text)",
                borderColor: "rgba(239,68,68,0.3)",
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {!mfaChallengeToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email address
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@blackfyre.io" className="admin-input" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>Password</label>
                  <a href="#" className="text-[12px] transition-colors" style={{ color: "var(--accent)" }}>Forgot password?</a>
                </div>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" className="admin-input" />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2" style={{ marginTop: "20px", height: "40px", fontSize: "14px" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 rounded-md animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                    Signing in...
                  </span>
                ) : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <div>
                <label htmlFor="mfa-code" className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
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
                  className="admin-input"
                  style={{ letterSpacing: "0.5em", textAlign: "center", fontSize: "20px", fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>
              <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn btn-primary w-full mt-2" style={{ marginTop: "20px", height: "40px", fontSize: "14px" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 rounded-md animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                    Verifying...
                  </span>
                ) : "Verify"}
              </button>
              <button type="button" onClick={() => { setMfaChallengeToken(null); setMfaCode(""); setError(""); }} className="w-full text-center text-[12px] mt-2" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                Back to login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[12px] mt-6" style={{ color: "var(--text-muted)" }}>
          BLACKFYRE Admin v1.0 &mdash; Authorized personnel only
        </p>
      </div>
    </div>
  );
}
