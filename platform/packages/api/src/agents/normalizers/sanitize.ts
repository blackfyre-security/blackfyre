/**
 * Input sanitization utilities for external scanner output.
 * All data from Prowler (OCSF) and IaC tools (SARIF) is untrusted.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitizes an unknown input into a safe string.
 * Strips HTML tags, control characters, trims whitespace, and truncates.
 */
export function sanitizeString(input: unknown, maxLength: number): string {
  if (input === null || input === undefined) return "";
  const raw = typeof input === "string" ? input : String(input);
  return raw
    .replace(HTML_TAG_RE, "")
    .replace(CONTROL_CHAR_RE, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates a severity value against known enum values.
 * Returns "medium" for unknown/invalid inputs.
 */
export function validateSeverity(
  input: unknown,
): "critical" | "high" | "medium" | "low" | "info" {
  if (typeof input !== "string") return "medium";
  const normalized = input.toLowerCase().trim();
  const valid = ["critical", "high", "medium", "low", "info"] as const;
  return (valid as readonly string[]).includes(normalized)
    ? (normalized as (typeof valid)[number])
    : "medium";
}

/**
 * Validates a string matches expected pattern (alphanumeric, hyphens, dots, colons, slashes).
 * Used for control IDs and resource identifiers.
 */
export function sanitizeIdentifier(input: unknown, maxLength: number): string {
  const str = sanitizeString(input, maxLength);
  // Allow alphanumeric, hyphens, dots, colons, slashes, underscores, parens
  return str.replace(/[^a-zA-Z0-9\-._:/()[\] ]/g, "");
}
