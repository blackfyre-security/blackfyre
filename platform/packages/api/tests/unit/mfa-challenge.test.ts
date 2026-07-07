import { describe, it, expect } from "vitest";
import { mfaVerifySchema } from "@blackfyre/shared";

describe("mfaVerifySchema", () => {
  it("accepts a valid mfaChallengeToken and 6-digit token", () => {
    expect(() =>
      mfaVerifySchema.parse({ mfaChallengeToken: "abc123", token: "123456" }),
    ).not.toThrow();

    const result = mfaVerifySchema.parse({
      mfaChallengeToken: "abc123",
      token: "123456",
    });
    expect(result.mfaChallengeToken).toBe("abc123");
    expect(result.token).toBe("123456");
  });

  it("rejects a payload using the old userId field instead of mfaChallengeToken", () => {
    expect(() =>
      mfaVerifySchema.parse({ userId: "some-uuid", token: "123456" }),
    ).toThrow();
  });

  it("rejects a token that is fewer than 6 digits", () => {
    expect(() =>
      mfaVerifySchema.parse({ mfaChallengeToken: "abc", token: "12345" }),
    ).toThrow();
  });

  it("rejects a token that contains non-digit characters", () => {
    expect(() =>
      mfaVerifySchema.parse({ mfaChallengeToken: "abc", token: "abcdef" }),
    ).toThrow();
  });

  it("rejects when mfaChallengeToken is missing", () => {
    expect(() =>
      mfaVerifySchema.parse({ token: "123456" }),
    ).toThrow();
  });

  it("rejects when token is missing", () => {
    expect(() =>
      mfaVerifySchema.parse({ mfaChallengeToken: "abc123" }),
    ).toThrow();
  });

  it("rejects a 7-digit token (must be exactly 6)", () => {
    expect(() =>
      mfaVerifySchema.parse({ mfaChallengeToken: "abc", token: "1234567" }),
    ).toThrow();
  });
});
