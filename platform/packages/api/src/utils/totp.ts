import * as OTPAuth from "otpauth";

export function generateSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function generateTOTPUri(secret: string, email: string, issuer = "BLACKFYRE"): string {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: email,
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.toString();
}

export function verifyTOTP(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
