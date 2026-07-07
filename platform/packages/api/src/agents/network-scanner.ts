import * as net from "node:net";
import * as tls from "node:tls";
import * as dns from "node:dns/promises";
import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — auditHttpHeaders() fetched a
// tenant-controlled domain via raw fetch('https://'+domain), which let a malicious
// target resolve (or DNS-rebind/redirect) to 169.254.169.254 or a private IP. Route
// that outbound request through safeFetch(), which re-resolves DNS on every hop and
// blocks private/reserved/metadata addresses. SsrfBlockedError is caught to distinguish
// a policy block from a benign connection failure.
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

interface NetworkTarget {
  hosts: string[];
  domains: string[];
  ports?: number[];
}

const DANGEROUS_PORTS: Record<number, { service: string; risk: string }> = {
  21:    { service: "FTP",        risk: "Unencrypted file transfer protocol — credentials sent in plaintext" },
  23:    { service: "Telnet",     risk: "Unencrypted remote access — all traffic including passwords visible" },
  25:    { service: "SMTP",       risk: "Open mail relay risk — can be abused for spam/phishing" },
  445:   { service: "SMB",        risk: "SMB file sharing — common target for ransomware (WannaCry, EternalBlue)" },
  1433:  { service: "MSSQL",      risk: "Database directly accessible — SQL injection and brute-force risk" },
  3306:  { service: "MySQL",      risk: "Database directly accessible — SQL injection and brute-force risk" },
  3389:  { service: "RDP",        risk: "Remote Desktop exposed — brute-force and BlueKeep vulnerability risk" },
  5432:  { service: "PostgreSQL", risk: "Database directly accessible — SQL injection and brute-force risk" },
  5900:  { service: "VNC",        risk: "Remote desktop without encryption — eavesdropping risk" },
  6379:  { service: "Redis",      risk: "In-memory database exposed — typically has no authentication by default" },
  27017: { service: "MongoDB",    risk: "NoSQL database exposed — often deployed without authentication" },
  9200:  { service: "Elasticsearch", risk: "Search engine exposed — data exfiltration risk" },
  11211: { service: "Memcached",  risk: "Cache server exposed — data leakage and DDoS amplification risk" },
};

const COMMON_SCAN_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9200, 27017, 11211];

/**
 * Network Scanner Agent
 *
 * Scans: Open ports, SSL/TLS config, DNS security, HTTP headers
 * Integration: Network target hosts/domains from credentialRef
 */
export class NetworkScannerAgent extends BaseAgent {
  readonly type = "network-scanner";
  readonly displayName = "Network Scanner";
  readonly supportedIntegrations = ["network"];

  // RFC 1123 hostname (very permissive) — a-z 0-9 and dots/hyphens, label
  // length <= 63, no leading/trailing hyphen per label. Used to reject
  // junk inputs (CIDR ranges, file paths, urls with schemes) BEFORE we
  // feed them to net.Socket or dns.resolve* — those APIs don't all
  // validate cleanly and can hang in absence of network.
  private static readonly HOSTNAME_RE =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  private static readonly IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

  private static isValidHost(s: string): boolean {
    return NetworkScannerAgent.IPV4_RE.test(s);
  }
  private static isValidDomain(s: string): boolean {
    // Reject anything with `/`, `:`, or schemes — those collapse to ENOTFOUND
    // sometimes but block waiting for DNS in CI environments without
    // resolvers configured.
    if (s.includes("/") || s.includes(":") || s.includes(" ")) return false;
    return NetworkScannerAgent.HOSTNAME_RE.test(s);
  }

  private parseTarget(credentialRef: string): NetworkTarget {
    try {
      return JSON.parse(credentialRef);
    } catch {
      // Treat as comma-separated hosts/domains
      const items = credentialRef
        .replace("vault://network/", "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const hosts = items.filter((i) => NetworkScannerAgent.isValidHost(i));
      const domains = items
        .filter((i) => !NetworkScannerAgent.isValidHost(i))
        .filter((i) => NetworkScannerAgent.isValidDomain(i));
      return { hosts, domains };
    }
  }

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    const target = this.parseTarget(ctx.credentialRef);
    const allTargets = [...target.hosts, ...target.domains].slice(0, 10);

    try {
      ctx.onProgress(0);

      // Phase 1: Port Scan (0-25%)
      for (const host of allTargets) {
        const openPorts = await this.scanPorts(host, target.ports ?? COMMON_SCAN_PORTS);
        for (const port of openPorts) {
          const info = DANGEROUS_PORTS[port];
          if (info) {
            await ctx.onFinding({
              title: `Exposed ${info.service} Port (${port}) on ${host}`,
              description: `Port ${port} (${info.service}) is open and accessible. ${info.risk}. This port should be restricted to known IP ranges or accessed through a VPN/bastion host.`,
              severity: [3389, 445, 6379, 27017, 11211].includes(port) ? "critical" : [1433, 3306, 5432, 23, 21].includes(port) ? "high" : "medium",
              category: "network",
              resourceType: "port",
              resourceId: `${host}:${port}`,
              resourceRegion: null,
              remediationTier: "approval",
              autoFixAvailable: false,
            });
            findingsCount++;
          }
        }
      }
      ctx.onProgress(25);

      // Phase 2: SSL/TLS Audit (25-50%)
      for (const domain of target.domains.slice(0, 5)) {
        const tlsFindings = await this.auditTls(domain);
        for (const f of tlsFindings) {
          await ctx.onFinding(f);
          findingsCount++;
        }
      }
      ctx.onProgress(50);

      // Phase 3: DNS Security Audit (50-75%)
      for (const domain of target.domains.slice(0, 5)) {
        const dnsFindings = await this.auditDns(domain);
        for (const f of dnsFindings) {
          await ctx.onFinding(f);
          findingsCount++;
        }
      }
      ctx.onProgress(75);

      // Phase 4: HTTP Security Headers (75-100%)
      for (const domain of target.domains.slice(0, 5)) {
        const headerFindings = await this.auditHttpHeaders(domain);
        for (const f of headerFindings) {
          await ctx.onFinding(f);
          findingsCount++;
        }
      }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  private scanPorts(host: string, ports: number[]): Promise<number[]> {
    const openPorts: number[] = [];

    // Hard upper-bound timeout per port. `socket.setTimeout` is an
    // *inactivity* timeout — it never fires if the socket is stuck in
    // DNS resolution or pre-connect state (which is what happens for
    // malformed hostnames in environments without working DNS, like CI).
    // Promise.race with a setTimeout guarantees the promise resolves
    // within HARD_TIMEOUT_MS regardless of socket lifecycle.
    const HARD_TIMEOUT_MS = 3_000;

    const checks = ports.map((port) => {
      const socketPromise = new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2_000);
        const done = () => { try { socket.destroy(); } catch { /* already destroyed */ } resolve(); };
        socket.on("connect", () => { openPorts.push(port); done(); });
        socket.on("timeout", done);
        socket.on("error", done);
        try {
          socket.connect(port, host);
        } catch {
          // net.Socket.connect can throw synchronously for invalid args
          // (e.g. a hostname containing '/'). Treat as a closed port.
          done();
        }
      });
      const hardTimeout = new Promise<void>((resolve) => setTimeout(resolve, HARD_TIMEOUT_MS));
      return Promise.race([socketPromise, hardTimeout]);
    });

    return Promise.all(checks).then(() => openPorts.sort((a, b) => a - b));
  }

  private async auditTls(domain: string): Promise<AgentFindingPayload[]> {
    const results: AgentFindingPayload[] = [];
    try {
      const cert = await this.getTlsCertificate(domain);
      if (!cert) return results;

      // Check certificate expiry
      const validTo = new Date(cert.valid_to);
      const daysUntilExpiry = Math.floor((validTo.getTime() - Date.now()) / 86400000);
      if (daysUntilExpiry < 0) {
        results.push({ title: `Expired SSL Certificate: ${domain}`, description: `The SSL certificate for ${domain} expired ${Math.abs(daysUntilExpiry)} days ago. Expired certificates cause browser warnings and break trust.`, severity: "critical", category: "encryption", resourceType: "certificate", resourceId: domain, resourceRegion: null, remediationTier: "approval", autoFixAvailable: false });
      } else if (daysUntilExpiry < 30) {
        results.push({ title: `SSL Certificate Expiring Soon: ${domain}`, description: `The SSL certificate for ${domain} expires in ${daysUntilExpiry} days. Renew immediately to prevent service disruption.`, severity: "high", category: "encryption", resourceType: "certificate", resourceId: domain, resourceRegion: null, remediationTier: "approval", autoFixAvailable: false });
      }

      // Check self-signed
      if (cert.issuer && cert.subject && JSON.stringify(cert.issuer) === JSON.stringify(cert.subject)) {
        results.push({ title: `Self-Signed Certificate: ${domain}`, description: `The SSL certificate for ${domain} is self-signed. Self-signed certificates are not trusted by browsers and clients, creating man-in-the-middle risk.`, severity: "high", category: "encryption", resourceType: "certificate", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }
    } catch { /* TLS connection failed — handled separately */ }
    return results;
  }

  private getTlsCertificate(domain: string): Promise<tls.PeerCertificate | null> {
    // Same hard-timeout pattern as scanPorts — the tls.connect timeout is
    // inactivity-only and won't fire if DNS hangs.
    const HARD_TIMEOUT_MS = 6_000;
    const tlsPromise = new Promise<tls.PeerCertificate | null>((resolve) => {
      let resolved = false;
      const done = (val: tls.PeerCertificate | null) => {
        if (resolved) return;
        resolved = true;
        try { socket.destroy(); } catch { /* already destroyed */ }
        resolve(val);
      };
      const socket = tls.connect(
        { host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 5_000 },
        () => done(socket.getPeerCertificate()),
      );
      socket.on("error", () => done(null));
      socket.on("timeout", () => done(null));
    });
    const hardTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), HARD_TIMEOUT_MS));
    return Promise.race([tlsPromise, hardTimeout]);
  }

  private async auditDns(domain: string): Promise<AgentFindingPayload[]> {
    const results: AgentFindingPayload[] = [];
    try {
      // SPF check
      const txtRecords = await dns.resolveTxt(domain).catch(() => []);
      const spfRecords = txtRecords.flat().filter((r) => r.startsWith("v=spf1"));
      if (spfRecords.length === 0) {
        results.push({ title: `Missing SPF Record: ${domain}`, description: `No SPF (Sender Policy Framework) record found for ${domain}. Without SPF, attackers can send spoofed emails appearing to come from your domain.`, severity: "medium", category: "network", resourceType: "dns", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }

      // DMARC check
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => []);
      const dmarc = dmarcRecords.flat().filter((r) => r.startsWith("v=DMARC1"));
      if (dmarc.length === 0) {
        results.push({ title: `Missing DMARC Record: ${domain}`, description: `No DMARC record found for ${domain}. DMARC prevents email spoofing by telling receivers how to handle unauthenticated emails. This is required for SOC 2 and ISO 27001 compliance.`, severity: "medium", category: "network", resourceType: "dns", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      } else if (dmarc[0].includes("p=none")) {
        results.push({ title: `Weak DMARC Policy: ${domain}`, description: `DMARC policy for ${domain} is set to 'none' (monitoring only). This does not prevent email spoofing. Upgrade to 'quarantine' or 'reject' policy.`, severity: "low", category: "network", resourceType: "dns", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }

      // MX check
      const mxRecords = await dns.resolveMx(domain).catch(() => []);
      if (mxRecords.length > 0 && spfRecords.length === 0) {
        results.push({ title: `Mail Server Without SPF Protection: ${domain}`, description: `${domain} has ${mxRecords.length} MX record(s) but no SPF record. Email authentication is critical for domains that send email.`, severity: "high", category: "network", resourceType: "dns", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }
    } catch { /* DNS resolution failed */ }
    return results;
  }

  private async auditHttpHeaders(domain: string): Promise<AgentFindingPayload[]> {
    const results: AgentFindingPayload[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — replaced raw
      // fetch('https://'+domain) with safeFetch(). The caller's AbortSignal is
      // preserved (composed with safeFetch's own hard timeout) and safeFetch forces
      // redirect:"manual" with per-hop DNS re-resolution, defeating DNS-rebinding and
      // redirect-to-internal attacks against this tenant-controlled domain.
      const res = await safeFetch(`https://${domain}`, { signal: controller.signal }, { timeoutMs: 5000 });
      clearTimeout(timeout);
      const h = res.headers;

      if (!h.get("strict-transport-security")) {
        results.push({ title: `Missing HSTS Header: ${domain}`, description: `${domain} does not send the Strict-Transport-Security header. Without HSTS, users can be downgraded to insecure HTTP connections via man-in-the-middle attacks.`, severity: "medium", category: "network", resourceType: "http_header", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }
      if (!h.get("content-security-policy")) {
        results.push({ title: `Missing Content-Security-Policy: ${domain}`, description: `${domain} does not send a Content-Security-Policy header. CSP prevents XSS attacks by controlling which resources the browser can load.`, severity: "medium", category: "network", resourceType: "http_header", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }
      if (!h.get("x-content-type-options")) {
        results.push({ title: `Missing X-Content-Type-Options: ${domain}`, description: `${domain} does not send X-Content-Type-Options: nosniff. This allows MIME-type sniffing attacks.`, severity: "low", category: "network", resourceType: "http_header", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }
      if ((h.get("server") ?? "").length > 0) {
        results.push({ title: `Server Version Disclosure: ${domain}`, description: `${domain} discloses its server software via the Server header: "${h.get("server")}". This aids attackers in identifying known vulnerabilities for the specific version.`, severity: "low", category: "network", resourceType: "http_header", resourceId: domain, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
      }
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — a blocked target (private/
      // reserved/metadata IP or rebind/redirect) surfaces as SsrfBlockedError; log it at
      // warn for visibility without leaking secrets. Any other error is a benign
      // connection failure and is swallowed as before. Domain is non-sensitive.
      if (err instanceof SsrfBlockedError) {
        console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", agent: this.type, phase: "auditHttpHeaders", domain, reason: err.message }));
      }
      /* else: connection failed — handled as no findings */
    } finally {
      clearTimeout(timeout);
    }
    return results;
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    const target = this.parseTarget(credentialRef);
    const hosts = [...target.hosts, ...target.domains];
    if (hosts.length === 0) return false;
    try {
      await dns.resolve(hosts[0]);
      return true;
    } catch {
      return false;
    }
  }
}
