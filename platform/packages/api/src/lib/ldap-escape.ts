/**
 * LDAP escaping primitives for BLACKFYRE.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP injection — any value interpolated
 * into an LDAP search filter or Distinguished Name from user/tenant input must be
 * escaped, or an attacker can alter filter logic (e.g. `*)(uid=*` auth bypass) or
 * inject DN components. These helpers implement RFC 4515 (filter) and RFC 4514 (DN)
 * escaping. Always escape BEFORE building the filter/DN string.
 *
 * Usage:
 *   import { escapeLdapFilter, escapeLdapDn } from "../lib/ldap-escape.js";
 *   const filter = `(&(objectClass=user)(uid=${escapeLdapFilter(uid)}))`;
 *   const dn = `cn=${escapeLdapDn(name)},${baseDn}`;
 *
 * ENFORCEMENT CONTRACT FOR NEW AD-AUDITOR MODULES (read before adding one):
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP injection — `config.baseDN` (and any
 * other user/tenant-controlled value: sAMAccountName, cn, ou, group names) is attacker-
 * influenced. The reviewer flagged that there is no SYSTEMATIC guarantee that a NEW AD
 * module remembers to escape it. The rule is mechanical:
 *
 *   1. Value goes inside a SEARCH FILTER assertion `(attr=<value>)` → wrap it in
 *      escapeLdapFilter(value). This is the common case (privilege-auditor escapes the
 *      whole assembled group DN with escapeLdapFilter because it is a filter assertion
 *      VALUE, not a DN being parsed).
 *   2. Value is a single RDN attribute value being placed into a DN string
 *      (`cn=<value>,...`) → wrap it in escapeLdapDn(value). Do NOT use escapeLdapDn on a
 *      multi-RDN baseDN — that would escape its legitimate `,`/`=` and corrupt the DN.
 *   3. Value is used verbatim as a base DN passed to the search() base argument (not
 *      interpolated into the filter string) → it is a structural parameter, not filter
 *      syntax, and needs no filter-escaping. Document this explicitly with a comment so a
 *      reviewer can confirm at a glance (e.g. "baseDN is not interpolated into the filter
 *      — safe").
 *
 * Existing modules audited 2026-06-05: privilege-auditor.ts interpolates baseDN into
 * filters and DOES escape (escapeLdapFilter). user-account-auditor / group-policy-auditor /
 * group-membership-auditor do NOT interpolate baseDN into their filter strings and are safe.
 * Before relying on that, a new module MUST self-verify against rules 1-3 above, or use
 * assertNoRawLdapFilterMeta() in a test to fail fast when an unescaped metachar leaks.
 */

/**
 * Escape a string for safe inclusion in an LDAP search filter (RFC 4515 §3).
 *
 * Special characters NUL, *, (, ), and \ are replaced with their `\xx` hex escapes.
 * Every other byte that is < 0x20 or >= 0x7f is also hex-escaped so control bytes and
 * non-ASCII can't smuggle filter syntax. ASCII printables pass through unchanged.
 */
export function escapeLdapFilter(input: string): string {
  if (input == null) return "";
  let out = "";
  // Encode to UTF-8 bytes so multibyte chars are escaped byte-by-byte per RFC 4515.
  const bytes = Buffer.from(String(input), "utf8");
  for (const byte of bytes) {
    switch (byte) {
      case 0x00: // NUL
        out += "\\00";
        break;
      case 0x28: // (
        out += "\\28";
        break;
      case 0x29: // )
        out += "\\29";
        break;
      case 0x2a: // *
        out += "\\2a";
        break;
      case 0x5c: // backslash
        out += "\\5c";
        break;
      default:
        if (byte < 0x20 || byte >= 0x7f) {
          out += "\\" + byte.toString(16).padStart(2, "0");
        } else {
          out += String.fromCharCode(byte);
        }
    }
  }
  return out;
}

/**
 * Escape a string for safe inclusion in a single Distinguished Name component value
 * (RFC 4514 §2.4).
 *
 * Escapes: \ , + " < > ; with a leading backslash; escapes a leading `#` or space and a
 * trailing space; and hex-escapes NUL and other control bytes. The result is suitable as
 * an attribute value within an RDN (e.g. `cn=<value>`).
 */
export function escapeLdapDn(input: string): string {
  if (input == null) return "";
  const value = String(input);
  if (value.length === 0) return "";

  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = value.charCodeAt(i);

    if (code === 0x00) {
      out += "\\00";
      continue;
    }
    // Characters that must always be escaped per RFC 4514.
    if (ch === "\\" || ch === "," || ch === "+" || ch === '"' || ch === "<" || ch === ">" || ch === ";") {
      out += "\\" + ch;
      continue;
    }
    // A `#` or space at the START of the value must be escaped.
    if (i === 0 && (ch === "#" || ch === " ")) {
      out += "\\" + ch;
      continue;
    }
    // A space at the END of the value must be escaped.
    if (i === value.length - 1 && ch === " ") {
      out += "\\ ";
      continue;
    }
    // Other control bytes — hex escape.
    if (code < 0x20 || code === 0x7f) {
      out += "\\" + code.toString(16).padStart(2, "0");
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * RFC 4515 filter metacharacters that, if present UNESCAPED inside an assertion value,
 * indicate a possible LDAP filter-injection: the parenthesis, asterisk, backslash and NUL
 * metacharacters. A literal space is intentionally NOT treated as a metacharacter — spaces
 * are legal inside a filter assertion value (e.g. "Domain Admins") and escapeLdapFilter()
 * leaves them untouched, so flagging them would produce false positives. Used by
 * assertNoRawLdapFilterMeta() below.
 */
const LDAP_FILTER_META = ["(", ")", "*", "\\", "\x00"] as const;

/**
 * Returns true if `value` contains any raw (unescaped) LDAP filter metacharacter.
 *
 * "Unescaped" means a metachar that is NOT part of an existing `\xx` hex escape produced by
 * escapeLdapFilter() (so a value that has already been escaped is reported as safe).
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP injection — systematic enforcement hook.
 * New AD-auditor modules / their tests can call this on the FINAL assertion value they are
 * about to embed in a filter to fail fast if an injection metachar leaked through.
 */
export function hasRawLdapFilterMeta(value: string): boolean {
  if (value == null) return false;
  // Strip valid \xx hex escapes first so legitimately-escaped values aren't flagged.
  const withoutEscapes = String(value).replace(/\\[0-9a-fA-F]{2}/g, "");
  return LDAP_FILTER_META.some((m) => withoutEscapes.includes(m));
}

/**
 * Throws if `value` still contains a raw LDAP filter metacharacter. Intended as a
 * fail-fast guard for tests or as a defensive assertion right before a filter is built in
 * a NEW AD module, giving the "systematic enforcement" the reviewer asked for without
 * touching every auditor by hand.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP injection — enforcement primitive.
 */
export function assertNoRawLdapFilterMeta(value: string, context = "LDAP filter value"): void {
  if (hasRawLdapFilterMeta(value)) {
    throw new Error(
      `Unescaped LDAP filter metacharacter detected in ${context}; wrap user/tenant input in escapeLdapFilter() before building the filter`,
    );
  }
}
