import { describe, it, expect } from "vitest";
import {
  validateUUID,
  sanitizePath,
  sanitizeErrorMessage,
  validateScanStatus,
} from "../../src/utils/security-fixes.js";
import { ApiError } from "../../src/utils/errors.js";

describe("validateUUID", () => {
  it("accepts valid UUID v4 strings", () => {
    expect(validateUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(validateUUID("6ba7b810-9dad-41d4-80b5-fc0800000000")).toBe(true);
    expect(validateUUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(validateUUID("")).toBe(false);
    expect(validateUUID("not-a-uuid")).toBe(false);
    expect(validateUUID("12345")).toBe(false);
    expect(validateUUID("hello world")).toBe(false);
  });

  it("accepts UUIDs of any version", () => {
    // Version 1 UUID
    expect(validateUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(true);
    // Nil UUID
    expect(validateUUID("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("rejects SQL injection attempts", () => {
    expect(validateUUID("' OR 1=1 --")).toBe(false);
    expect(validateUUID("'; DROP TABLE users; --")).toBe(false);
  });

  it("rejects path traversal strings", () => {
    expect(validateUUID("../../etc/passwd")).toBe(false);
  });
});

describe("sanitizePath", () => {
  it("accepts valid relative paths and returns them unchanged", () => {
    expect(sanitizePath("evidence/tenant-123/report.pdf")).toBe(
      "evidence/tenant-123/report.pdf",
    );
    expect(sanitizePath("reports/2024/q1/report.pdf")).toBe(
      "reports/2024/q1/report.pdf",
    );
  });

  it("blocks directory traversal with '..'", () => {
    expect(() => sanitizePath("../../../etc/passwd")).toThrow(ApiError);
    expect(() => sanitizePath("evidence/../../../etc/shadow")).toThrow(ApiError);
    expect(() => sanitizePath("evidence/..")).toThrow(ApiError);
  });

  it("blocks tilde-based home directory references", () => {
    expect(() => sanitizePath("~/.ssh/id_rsa")).toThrow(ApiError);
  });

  it("blocks null bytes", () => {
    expect(() => sanitizePath("evidence/file.pdf\0.exe")).toThrow(ApiError);
  });

  it("blocks absolute paths (Unix-style)", () => {
    expect(() => sanitizePath("/etc/passwd")).toThrow(ApiError);
  });

  it("blocks absolute paths (Windows-style)", () => {
    expect(() => sanitizePath("C:\\Windows\\system32")).toThrow(ApiError);
  });

  it("blocks encoded traversal patterns (%2e, %00, %5c)", () => {
    expect(() => sanitizePath("evidence/%2e%2e/secret")).toThrow(ApiError);
    expect(() => sanitizePath("%2E%2E/etc/passwd")).toThrow(ApiError);
    expect(() => sanitizePath("evidence/%00")).toThrow(ApiError);
  });

  it("throws on empty string", () => {
    expect(() => sanitizePath("")).toThrow(ApiError);
  });

  it("throws on backslash paths (gets normalized then caught by traversal check)", () => {
    expect(() => sanitizePath("evidence\\..\\..\\secret")).toThrow(ApiError);
  });
});

describe("sanitizeErrorMessage", () => {
  it("strips stack trace lines", () => {
    const err = new Error("Something failed");
    err.message =
      "Something failed    at Module._compile (/app/node_modules/module.js:1:2)";
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("at Module._compile");
    expect(result).toContain("Something failed");
  });

  it("removes Unix file paths", () => {
    const err = new Error("Error reading /var/log/app/server.log for details");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("/var/log/app/server.log");
    expect(result).toContain("[path]");
  });

  it("removes Windows file paths", () => {
    const err = new Error("Cannot open C:\\Users\\admin\\secret.txt right now");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("C:\\Users\\admin\\secret.txt");
    expect(result).toContain("[path]");
  });

  it("redacts connection strings", () => {
    const err = new Error(
      "Connection failed: postgres://user:pass@db.example.com:5432/mydb",
    );
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("postgres://");
    expect(result).toContain("[redacted]");
  });

  it("redacts secret/token/password patterns", () => {
    const err = new Error("Auth failed: password=s3cretValue123");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("s3cretValue123");
    expect(result).toContain("[redacted]");
  });

  it("caps message length at 500 characters", () => {
    const longMessage = "A".repeat(1000);
    const err = new Error(longMessage);
    const result = sanitizeErrorMessage(err);
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it("returns default message when error.message is empty", () => {
    const err = new Error();
    err.message = "";
    const result = sanitizeErrorMessage(err);
    expect(result).toBe("An unexpected error occurred");
  });
});

describe("validateScanStatus", () => {
  it("accepts all valid scan statuses", () => {
    const validStatuses = [
      "queued",
      "running",
      "completed",
      "completed_partial",
      "failed",
      "cancelled",
    ];
    for (const status of validStatuses) {
      expect(validateScanStatus(status)).toBe(status);
    }
  });

  it("rejects invalid status strings", () => {
    expect(() => validateScanStatus("admin")).toThrow(ApiError);
    expect(() => validateScanStatus("")).toThrow(ApiError);
    expect(() => validateScanStatus("unknown")).toThrow(ApiError);
  });

  it("rejects SQL injection attempts in status", () => {
    expect(() => validateScanStatus("'; DROP TABLE scans; --")).toThrow(
      ApiError,
    );
  });
});
