// @node-rs/argon2 — Rust-based Argon2 with prebuilt binaries for linux-x64,
// linux-arm64, darwin, win32. The original `argon2` package ships only a
// host-OS native binary (broke on Lambda when packaged from Windows).
import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  return verify(hashed, password);
}
