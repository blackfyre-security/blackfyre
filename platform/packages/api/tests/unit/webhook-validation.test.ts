import { describe, it, expect } from "vitest";
import { validateWebhookUrl, escapeLike } from "../../src/utils/security-fixes.js";

describe("validateWebhookUrl", () => {
  it("accepts a valid HTTPS webhook URL", () => {
    expect(() =>
      validateWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx"),
    ).not.toThrow();
  });

  it("throws for HTTP (non-HTTPS) URLs", () => {
    expect(() =>
      validateWebhookUrl("http://hooks.slack.com/services/T00/B00/xxx"),
    ).toThrow("Webhook URL must use HTTPS");
  });

  it("throws for localhost", () => {
    expect(() => validateWebhookUrl("https://localhost/hook")).toThrow(
      "Webhook URL must not target internal or private networks",
    );
  });

  it("throws for 127.0.0.1 (loopback)", () => {
    expect(() => validateWebhookUrl("https://127.0.0.1/hook")).toThrow(
      "Webhook URL must not target internal or private networks",
    );
  });

  it("throws for 169.254.x.x (SSRF link-local / metadata endpoint)", () => {
    expect(() =>
      validateWebhookUrl("https://169.254.169.254/latest/meta-data/"),
    ).toThrow("Webhook URL must not target internal or private networks");
  });

  it("throws for 10.x.x.x (private class A)", () => {
    expect(() => validateWebhookUrl("https://10.0.0.1/hook")).toThrow(
      "Webhook URL must not target internal or private networks",
    );
  });

  it("throws for 192.168.x.x (private class C)", () => {
    expect(() => validateWebhookUrl("https://192.168.1.1/hook")).toThrow(
      "Webhook URL must not target internal or private networks",
    );
  });

  it("throws for 172.16.x.x (private class B range)", () => {
    expect(() => validateWebhookUrl("https://172.16.0.1/hook")).toThrow(
      "Webhook URL must not target internal or private networks",
    );
  });
});

describe("escapeLike", () => {
  it("escapes % characters", () => {
    expect(escapeLike("hello%world")).toBe("hello\\%world");
  });

  it("escapes _ characters", () => {
    expect(escapeLike("test_value")).toBe("test\\_value");
  });

  it("leaves normal strings unchanged", () => {
    expect(escapeLike("normal")).toBe("normal");
  });

  it("escapes multiple special characters in one string", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
  });

  it("escapes backslash characters", () => {
    expect(escapeLike("C:\\path")).toBe("C:\\\\path");
  });
});
