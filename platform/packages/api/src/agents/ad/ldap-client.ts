import type { ADConfig } from "../ad-auditor.js";
import { OptionalDependencyMissingError, isOptionalDependencyMissing } from "../optional-dependency.js";

export type LdapEntry = Record<string, string | string[] | undefined>;

export interface LdapQuery {
  base?: string;
  scope: "sub";
  filter: string;
  attributes?: string[];
}

export type LdapSearchFn = (config: ADConfig, query: LdapQuery) => Promise<LdapEntry[]>;

/** Return the first string value from an LDAP attribute that may be multi-valued. */
export function firstAttr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "0";
  return value ?? "0";
}

/** Build a basic sub-tree LDAP query object. */
export function buildQuery(filter: string, attributes?: string[]): LdapQuery {
  return { scope: "sub", filter, attributes };
}

/**
 * Parse Active Directory FILETIME (100-nanosecond intervals since 1601-01-01)
 * into a Unix timestamp in milliseconds.
 */
export function parseAdTimestamp(value: string): number {
  try {
    const n = BigInt(value);
    if (n === 0n || n === 9223372036854775807n) return 0; // never logged / not set
    // FILETIME epoch is 1601-01-01, Unix epoch is 1970-01-01 — 11644473600 second delta
    return Number((n / 10000n) - 11644473600000n);
  } catch {
    return 0;
  }
}


/**
 * Production LDAP search using ldapjs.
 *
 * Throws OptionalDependencyMissingError when ldapjs is not installed — a missing
 * module must never look like a clean directory. Connection/search failures still
 * return an empty array, so callers fall through to configuration-level findings.
 */
export async function ldapSearch(config: ADConfig, query: LdapQuery): Promise<LdapEntry[]> {
  try {
    // Dynamic import — ldapjs is an OPTIONAL dependency, deliberately not in
    // package.json so cloud-only installs (the overwhelming majority) do not carry
    // it. But a missing module previously returned [] indistinguishably from "the
    // directory is clean", so four AD auditors reported success while collecting
    // nothing. Say so loudly instead; the caller still degrades to config-level
    // findings rather than failing the scan.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ldap = await import("ldapjs" as any).catch(() => null) as any;
    if (!ldap) {
      throw new OptionalDependencyMissingError("ldapjs", "Active Directory auditing");
    }

    return await new Promise<LdapEntry[]>((resolve) => {
      const client = ldap.createClient({
        url: `${config.useTLS ? "ldaps" : "ldap"}://${config.host}:${config.port}`,
        timeout: 10000,
        connectTimeout: 8000,
      });

      client.on("error", () => resolve([]));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.bind(config.bindDN, config.bindCredential, (bindErr: any) => {
        if (bindErr) { client.destroy(); resolve([]); return; }

        const entries: LdapEntry[] = [];
        const base = query.base ?? config.baseDN;

        client.search(base, {
          scope: query.scope,
          filter: query.filter,
          attributes: query.attributes ?? [],
          paged: { pageSize: 500 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, (searchErr: any, res: any) => {
          if (searchErr) { client.destroy(); resolve([]); return; }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.on("searchEntry", (entry: any) => {
            const obj: LdapEntry = {};
            for (const attr of entry.attributes) {
              obj[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
            }
            entries.push(obj);
          });

          res.on("error", () => { client.destroy(); resolve(entries); });
          res.on("end", () => { client.unbind(); resolve(entries); });
        });
      });
    });
  } catch (err) {
    // A missing optional dependency is a real, actionable condition — never let the
    // catch-all turn it back into a silent empty result.
    if (isOptionalDependencyMissing(err)) throw err;
    return [];
  }
}
