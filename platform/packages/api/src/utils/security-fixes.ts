/**
 * Security Fixes Module
 *
 * Provides utility functions to harden the BLACKFYRE platform against
 * common vulnerability classes identified during the security audit.
 *
 * Audit date: 2026-03-26
 */

import { badRequest } from "./errors.js";

// UUID pattern — rejects malformed IDs that could cause
// unexpected ORM behavior or be used for injection probing.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a well-formed UUID v4.
 * Use on every :id route parameter before passing it to the ORM.
 */
export function validateUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Validates a UUID and throws a 400 ApiError if invalid.
 * Convenience wrapper for route handlers.
 */
export function requireUUID(id: string, paramName = "id"): string {
  if (!validateUUID(id)) {
    throw badRequest("INVALID_ID", `Parameter "${paramName}" must be a valid UUID`);
  }
  return id;
}

// Characters that indicate path traversal attempts
const PATH_TRAVERSAL_PATTERNS = [
  "..",
  "~",
  "\\",
  "\0",
  "%2e",
  "%2E",
  "%00",
  "%5c",
  "%5C",
];

/**
 * Sanitizes a storage path to prevent directory traversal attacks.
 *
 * - Rejects paths containing "..", "~", backslash, null bytes, and encoded variants
 * - Rejects absolute paths (starting with / or drive letters)
 * - Normalizes forward slashes
 * - Strips leading slashes
 *
 * Returns the sanitized path or throws if the path is malicious.
 */
export function sanitizePath(path: string): string {
  if (!path || typeof path !== "string") {
    throw badRequest("INVALID_PATH", "Storage path is required");
  }

  // Check for null bytes first (could bypass other checks)
  if (path.includes("\0")) {
    throw badRequest("INVALID_PATH", "Path contains invalid characters");
  }

  // Normalize to forward slashes
  let normalized = path.replace(/\\/g, "/");

  // Reject absolute paths
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw badRequest("INVALID_PATH", "Absolute paths are not allowed");
  }

  // Check for traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
      throw badRequest("INVALID_PATH", "Path traversal is not allowed");
    }
  }

  // Strip any leading slashes after normalization
  normalized = normalized.replace(/^\/+/, "");

  // Reject empty result
  if (normalized.length === 0) {
    throw badRequest("INVALID_PATH", "Storage path cannot be empty");
  }

  return normalized;
}

/**
 * Sanitizes an error message for client responses.
 *
 * - Strips stack traces
 * - Removes file paths that could leak server structure
 * - Removes connection strings / credentials that may appear in DB errors
 * - Caps length at 500 characters
 *
 * Use in error handlers to prevent information leakage.
 */
export function sanitizeErrorMessage(error: Error): string {
  let message = error.message || "An unexpected error occurred";

  // Remove stack trace lines (    at Module._compile ...)
  message = message.replace(/\s+at\s+.+/g, "");

  // Remove file paths (Unix and Windows)
  message = message.replace(/\/[^\s:]+\.[a-z]{1,4}/gi, "[path]");
  message = message.replace(/[A-Z]:\\[^\s:]+\.[a-z]{1,4}/gi, "[path]");

  // Remove connection strings
  message = message.replace(
    /(?:postgres|mysql|mongodb|redis)(?:\+srv)?:\/\/[^\s]+/gi,
    "[redacted]",
  );

  // Remove anything that looks like a secret/token
  message = message.replace(
    /(?:password|secret|token|key|credential|auth)\s*[:=]\s*\S+/gi,
    "[redacted]",
  );

  // Cap length
  if (message.length > 500) {
    message = message.slice(0, 497) + "...";
  }

  return message.trim();
}

export function validateWebhookUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }
  const hostname = parsed.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "[::1]" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Webhook URL must not target internal or private networks");
  }
}

export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Validates that a scan status query parameter is one of the allowed values.
 * Prevents injection of arbitrary strings into SQL template literals.
 */
const VALID_SCAN_STATUSES = new Set([
  "queued",
  "running",
  "completed",
  "completed_partial",
  "failed",
  "cancelled",
]);

export function validateScanStatus(status: string): string {
  if (!VALID_SCAN_STATUSES.has(status)) {
    throw badRequest("INVALID_STATUS", `Invalid scan status: ${status}`);
  }
  return status;
}
