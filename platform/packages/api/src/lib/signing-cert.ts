/**
 * BLACKFYRE Reporting Authority — PKCS#12 signing cert loader.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): "signed" PDFs silently fell back to
 * an auto-generated self-signed dev cert protected by the HARD-CODED, public
 * password "blackfyre-dev" — and the export pipeline recorded `signedBy`
 * regardless. That advertised tamper-evidence the platform could not back. We now
 * FAIL CLOSED: a real operator-provided PKCS#12 cert + passphrase MUST be
 * configured via env, otherwise `getSigningP12()` returns `null` and the caller
 * MUST NOT emit a "signed" PDF or record `signedBy`. There is intentionally no
 * cert auto-generation and no default password.
 *
 * Required env for signing to be enabled:
 *   - BLACKFYRE_SIGNING_P12          path to a readable .p12 file
 *   - BLACKFYRE_SIGNING_P12_PASSWORD non-empty passphrase for that .p12
 *   - BLACKFYRE_SIGNING_SUBJECT_CN   (optional) subject CN to stamp as signedBy;
 *                                    defaults to "BLACKFYRE Reporting Authority"
 */

import fs from "node:fs";
import type { FastifyBaseLogger } from "fastify";

const DEFAULT_SUBJECT_CN = "BLACKFYRE Reporting Authority";

export interface SigningP12 {
  buffer: Buffer;
  password: string;
  subjectCN: string;
}

let cached: SigningP12 | null = null;

/**
 * Resolve the configured PKCS#12 signing material.
 *
 * Returns `null` (NOT a dev fallback) when real signing material is not
 * configured. Callers MUST treat `null` as "signing unavailable" and produce an
 * explicitly UNSIGNED artifact instead of falsely claiming a signature.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): removed the hard-coded
 * `blackfyre-dev` password and the on-the-fly self-signed cert generation —
 * both let an unsigned/dev-signed PDF masquerade as authority-signed.
 */
export async function getSigningP12(
  log?: FastifyBaseLogger,
): Promise<SigningP12 | null> {
  if (cached) return cached;

  const envPath = process.env.BLACKFYRE_SIGNING_P12;
  const envPassword = process.env.BLACKFYRE_SIGNING_P12_PASSWORD;
  const subjectCN = process.env.BLACKFYRE_SIGNING_SUBJECT_CN || DEFAULT_SUBJECT_CN;

  // FAIL CLOSED: require an explicit cert path AND a non-empty passphrase.
  // A missing/empty passphrase is rejected so we never re-introduce a known
  // default-password cert.
  if (!envPath || !envPassword) {
    log?.warn(
      { hasCertPath: Boolean(envPath), hasPassphrase: Boolean(envPassword) },
      "[signing-cert] PDF signing disabled: BLACKFYRE_SIGNING_P12 and " +
        "BLACKFYRE_SIGNING_P12_PASSWORD must both be set. Exports will be UNSIGNED.",
    );
    return null;
  }

  if (!fs.existsSync(envPath)) {
    log?.warn(
      { hasCertPath: true },
      "[signing-cert] PDF signing disabled: configured BLACKFYRE_SIGNING_P12 " +
        "path does not exist or is not readable. Exports will be UNSIGNED.",
    );
    return null;
  }

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(envPath);
  } catch (err) {
    log?.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "[signing-cert] PDF signing disabled: failed to read BLACKFYRE_SIGNING_P12. " +
        "Exports will be UNSIGNED.",
    );
    return null;
  }

  cached = { buffer, password: envPassword, subjectCN };
  log?.info("[signing-cert] PDF signing enabled with operator-provided PKCS#12 cert.");
  return cached;
}
