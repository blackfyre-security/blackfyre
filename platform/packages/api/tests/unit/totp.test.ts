import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import { generateSecret, generateTOTPUri, verifyTOTP } from "../../src/utils/totp.js";

describe("generateSecret", () => {
  it("returns a non-empty string", () => {
    const secret = generateSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });

  it("returns a valid base32-encoded string (only base32 chars)", () => {
    const secret = generateSecret();
    // Base32 alphabet: A-Z and 2-7
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("returns a string of appropriate length for a 20-byte secret", () => {
    const secret = generateSecret();
    // 20 bytes base32-encoded = 32 characters (plus possible = padding)
    expect(secret.replace(/=/g, "").length).toBeGreaterThanOrEqual(32);
  });

  it("returns a different secret each call", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
  });
});

describe("generateTOTPUri", () => {
  it("returns an otpauth:// URI", () => {
    const secret = generateSecret();
    const uri = generateTOTPUri(secret, "user@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
  });

  it("includes the default issuer BLACKFYRE", () => {
    const secret = generateSecret();
    const uri = generateTOTPUri(secret, "user@example.com");
    expect(uri).toContain("issuer=BLACKFYRE");
  });

  it("includes the email as the account label", () => {
    const secret = generateSecret();
    const email = "user@example.com";
    const uri = generateTOTPUri(secret, email);
    // The label is URL-encoded in the path
    expect(uri).toContain(encodeURIComponent(email));
  });

  it("includes the secret parameter", () => {
    const secret = generateSecret();
    const uri = generateTOTPUri(secret, "user@example.com");
    expect(uri).toContain("secret=");
  });
});

describe("verifyTOTP", () => {
  it("returns true for a currently valid token", () => {
    const secret = generateSecret();
    // Generate a valid token using the same library
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    const validToken = totp.generate();
    expect(verifyTOTP(secret, validToken)).toBe(true);
  });

  it("returns false for a clearly wrong numeric token", () => {
    const secret = generateSecret();
    // Generate the real token and pick something definitively different
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    const validToken = totp.generate();
    // Flip all digits to create a wrong token
    const wrongToken = validToken
      .split("")
      .map((d) => String((Number(d) + 5) % 10))
      .join("");
    // Only assert false if it's actually different from the valid token
    if (wrongToken !== validToken) {
      expect(verifyTOTP(secret, wrongToken)).toBe(false);
    }
  });

  it("returns false for non-numeric input", () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, "abcdef")).toBe(false);
  });

  it("returns false for an empty string", () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, "")).toBe(false);
  });

  it("returns false for a token that is the wrong length", () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, "12345")).toBe(false);
    expect(verifyTOTP(secret, "1234567")).toBe(false);
  });
});
