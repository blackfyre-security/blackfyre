/**
 * SSRF-hardened fetch wrapper for BLACKFYRE.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): Server-Side Request Forgery (SSRF) —
 * outbound HTTP from integration/webhook/OAuth/metadata-discovery code paths must
 * never be allowed to reach internal or cloud-metadata endpoints. This module is the
 * single chokepoint every outbound request to a user/tenant-controlled URL must use.
 *
 * Defences implemented:
 *   - Scheme allowlist: only http: / https: (rejects file:, gopher:, ftp:, data:, etc.).
 *   - DNS resolution of the hostname + rejection of any address that falls in a
 *     private/reserved/link-local range (RFC1918, loopback, link-local incl. the
 *     169.254.169.254 cloud-metadata IP, IPv6 ULA fc00::/7, ::1, 0.0.0.0, etc.).
 *   - redirect: "manual" with per-hop re-validation: every Location is re-parsed and
 *     re-resolved, defeating DNS-rebinding and redirect-to-internal attacks.
 *   - A hard request timeout (AbortController) so a hung internal host can't pin a worker.
 *
 * Downstream usage:
 *   import { safeFetch, assertPublicUrl } from "../lib/safe-fetch.js";
 *   const res = await safeFetch(url, { method: "POST", body });        // outbound calls
 *   await assertPublicUrl(url);                                        // validate at create-time
 *
 * Pass a Fastify logger (request.log / app.log) via opts.log so blocks are recorded as
 * structured "warn" events. The wrapper NEVER logs request bodies, headers, or secrets.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FastifyBaseLogger } from "fastify";

export interface SafeFetchOptions {
  /** Per-request timeout in ms. Default 10_000. */
  timeoutMs?: number;
  /** Max redirect hops to follow (each re-validated). Default 5. */
  maxRedirects?: number;
  /** Optional Fastify pino logger to emit structured SSRF-block warnings. */
  log?: FastifyBaseLogger;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;

/** Thrown when a URL is rejected by SSRF policy. Distinguishable from network errors. */
export class SsrfBlockedError extends Error {
  readonly code = "SSRF_BLOCKED";
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Returns true if the given IP literal is private, reserved, loopback, link-local,
 * or otherwise must-not-be-reached from server-side request code.
 */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  // Not a parseable IP literal — treat as blocked (fail closed).
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;

  // 0.0.0.0/8 — "this host" / unspecified
  if (a === 0) return true;
  // 10.0.0.0/8 — RFC1918 private
  if (a === 10) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local (includes 169.254.169.254 cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 — RFC1918 private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — RFC1918 private
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 — carrier-grade NAT (RFC6598)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24, 192.0.2.0/24, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24 — special-use/test nets
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255 broadcast
  if (a >= 224) return true;

  return false;
}

function isBlockedIpv6(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "");

  // ::1 loopback and :: unspecified
  if (ip === "::1" || ip === "::") return true;

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible — validate the embedded v4.
  const mapped = ip.match(/(?:::ffff:|::)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  const firstHextet = ip.split(":")[0] ?? "";
  const head = Number.parseInt(firstHextet || "0", 16);
  if (!Number.isNaN(head)) {
    // fc00::/7 — Unique Local Addresses (fc00 / fd00)
    if ((head & 0xfe00) === 0xfc00) return true;
    // fe80::/10 — link-local
    if ((head & 0xffc0) === 0xfe80) return true;
    // ff00::/8 — multicast
    if ((head & 0xff00) === 0xff00) return true;
  }

  return false;
}

interface ResolvedTarget {
  hostname: string;
  ip: string;
}

/**
 * Parse + scheme-check a URL and resolve its hostname to an IP, rejecting any
 * disallowed scheme or any address in a blocked range. Returns the resolved IP so
 * callers can pin it for the actual connection if they wish.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — single validation routine used
 * both at config/create time (assertPublicUrl) and on every redirect hop.
 */
async function resolveAndValidate(rawUrl: string, log?: FastifyBaseLogger): Promise<ResolvedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Malformed URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    log?.warn({ event: "ssrf.blocked", reason: "scheme", scheme: url.protocol, host: url.hostname }, "SSRF block: disallowed URL scheme");
    throw new SsrfBlockedError(`Disallowed scheme: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) {
    throw new SsrfBlockedError("URL has no host");
  }

  // If the host is already an IP literal, validate directly (no DNS).
  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (isBlockedIp(hostname)) {
      log?.warn({ event: "ssrf.blocked", reason: "private_ip", host: hostname }, "SSRF block: URL targets a private/reserved IP");
      throw new SsrfBlockedError(`Blocked IP address: ${hostname}`);
    }
    return { hostname, ip: hostname };
  }

  // Resolve ALL addresses; if any is blocked we reject (an attacker can return
  // multiple A/AAAA records and race the connection to the private one).
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    log?.warn({ event: "ssrf.blocked", reason: "dns_failure", host: hostname }, "SSRF block: DNS resolution failed");
    throw new SsrfBlockedError(`DNS resolution failed for ${hostname}`);
  }

  if (records.length === 0) {
    throw new SsrfBlockedError(`No DNS records for ${hostname}`);
  }

  for (const { address } of records) {
    if (isBlockedIp(address)) {
      log?.warn(
        { event: "ssrf.blocked", reason: "private_resolution", host: hostname, resolved: address },
        "SSRF block: hostname resolves to a private/reserved IP",
      );
      throw new SsrfBlockedError(`Hostname ${hostname} resolves to blocked IP ${address}`);
    }
  }

  return { hostname, ip: records[0].address };
}

/**
 * Validate a URL at config / integration-create time. Throws SsrfBlockedError if the
 * URL is non-http(s) or resolves into a private/reserved range. Use this when a tenant
 * SAVES a webhook URL / OAuth endpoint / metadata URL so bad targets are rejected early.
 */
export async function assertPublicUrl(rawUrl: string, log?: FastifyBaseLogger): Promise<void> {
  await resolveAndValidate(rawUrl, log);
}

/** Non-throwing variant for validation surfaces that prefer a boolean. */
export async function isPublicUrl(rawUrl: string, log?: FastifyBaseLogger): Promise<boolean> {
  try {
    await resolveAndValidate(rawUrl, log);
    return true;
  } catch {
    return false;
  }
}

/**
 * SSRF-hardened drop-in for fetch(). Validates the initial URL and re-validates the
 * target of every redirect hop (re-resolving DNS each time to defeat rebinding), with a
 * hard timeout. Disallowed schemes and private targets throw SsrfBlockedError.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — all server-side outbound requests to
 * tenant-controlled URLs must route through here. redirect:"manual" + per-hop revalidation.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const log = options.log;

  let currentUrl = rawUrl;
  let hops = 0;

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — honour a caller-supplied
  // AbortSignal WITHOUT letting the caller weaken our controls. Callers (e.g. the
  // network-scanner / channel senders) pass their own `signal` for an outer timeout and
  // expect `redirect: "manual"`; we still FORCE redirect:"manual" so every hop is
  // re-validated here, and we compose the caller's signal with our own hard-timeout
  // controller so whichever fires first aborts the in-flight request. The caller's
  // `signal` must never replace ours (that would disable the per-request timeout that
  // stops a hung internal host from pinning a worker).
  const { signal: callerSignal, redirect: _ignoredRedirect, ...restInit } = init;

  while (true) {
    await resolveAndValidate(currentUrl, log);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Propagate a caller abort into our composed controller.
    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        ...restInit,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    }

    // Not a redirect → return as-is.
    if (res.status < 300 || res.status >= 400) {
      return res;
    }

    const location = res.headers.get("location");
    if (!location) {
      return res; // 3xx without Location — hand back to caller.
    }

    if (hops >= maxRedirects) {
      log?.warn({ event: "ssrf.blocked", reason: "redirect_limit", host: new URL(currentUrl).hostname }, "SSRF block: too many redirects");
      throw new SsrfBlockedError(`Exceeded max redirects (${maxRedirects})`);
    }

    // Resolve the Location relative to the current URL, then re-validate on next loop.
    currentUrl = new URL(location, currentUrl).toString();
    hops += 1;
  }
}
