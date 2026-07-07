/**
 * Secret-redaction primitives for BLACKFYRE.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): Credential/secret leakage in API
 * responses and logs — objects carrying credentials (integration configs, OAuth
 * tokens, KMS material, API keys) were being returned and logged verbatim. These
 * helpers deep-clone and mask any value whose key matches a known-secret pattern so
 * responses/logs never carry raw secrets.
 *
 * Usage:
 *   import { redactCredentials, redactSecretString } from "../lib/redact.js";
 *   reply.send(redactCredentials(integration));       // before returning to client
 *   request.log.info({ cfg: redactCredentials(cfg) }); // before logging
 */

/** Substitution emitted in place of any redacted value. */
export const REDACTED = "[REDACTED]";

/**
 * Key fragments that indicate a value is secret. Matched case-insensitively against the
 * object key. Substring match so `clientSecret`, `awsSecretKey`, `db_password`, etc. all hit.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): leakage — broad-but-precise key denylist.
 */
const SECRET_KEY_FRAGMENTS: readonly string[] = [
  "password",
  "passwd",
  "secret", // covers clientSecret, secretKey, webhookSecret, ...
  "token", // covers accessToken, refreshToken, idToken, ...
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "sakey",
  "sa_key",
  "accesskey",
  "secretkey",
  "credential", // covers credential, credentials, credentialRef, ...
  "authorization",
  "auth_token",
  "session",
  "cookie",
  "passphrase",
  "pwd",
];

/**
 * Bare key names that mean a secret on their own but would be too broad as substrings
 * (e.g. "key"). Matched as an exact, case-insensitive equality only.
 */
const SECRET_KEY_EXACT: readonly string[] = ["key", "pass", "pin", "otp", "mfa"];

const MAX_DEPTH = 12;

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SECRET_KEY_EXACT.includes(lower)) return true;
  const stripped = lower.replace(/[_\-\s]/g, "");
  return SECRET_KEY_FRAGMENTS.some((frag) => stripped.includes(frag.replace(/[_\-\s]/g, "")));
}

/**
 * Deep-clone `obj`, replacing the value of any key that looks like a secret with
 * "[REDACTED]". Arrays, nested objects, Maps and Sets are traversed. Non-plain values
 * (Date, Buffer, etc.) are passed through by reference inside the clone. Cyclic refs and
 * over-deep structures are handled safely.
 */
export function redactCredentials<T>(obj: T): T {
  return clone(obj, 0, new WeakMap()) as T;
}

function clone(value: unknown, depth: number, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH) return REDACTED;

  // Cycle guard.
  if (seen.has(value as object)) return seen.get(value as object);

  // Leave special objects intact (don't try to walk their internals).
  if (
    value instanceof Date ||
    value instanceof RegExp ||
    Buffer.isBuffer(value) ||
    ArrayBuffer.isView(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(value, arr);
    for (const item of value) arr.push(clone(item, depth + 1, seen));
    return arr;
  }

  if (value instanceof Map) {
    const out = new Map<unknown, unknown>();
    seen.set(value, out);
    for (const [k, v] of value) {
      out.set(k, typeof k === "string" && isSecretKey(k) ? REDACTED : clone(v, depth + 1, seen));
    }
    return out;
  }

  if (value instanceof Set) {
    const out = new Set<unknown>();
    seen.set(value, out);
    for (const v of value) out.add(clone(v, depth + 1, seen));
    return out;
  }

  // Plain object.
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSecretKey(k) ? REDACTED : clone(v, depth + 1, seen);
  }
  return out;
}

/**
 * Redact a standalone secret string for safe logging — keeps a short, non-reversible
 * fingerprint (first 2 + last 2 chars for strings long enough) so operators can
 * correlate without exposing the value. Short or empty strings collapse to "[REDACTED]".
 */
export function redactSecretString(s: string | null | undefined): string {
  if (s == null || s.length === 0) return REDACTED;
  if (s.length <= 8) return REDACTED;
  return `${s.slice(0, 2)}…${s.slice(-2)} (${REDACTED}, len=${s.length})`;
}
