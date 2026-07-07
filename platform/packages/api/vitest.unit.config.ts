import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 15_000,
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): EncryptionProviderService now fails
    // closed at construction when no key material is configured (no insecure default).
    // Provide a test-only key so the suite can boot; this is NOT a real secret.
    env: {
      ENCRYPTION_MASTER_KEY: "0000000000000000000000000000000000000000000000000000000000000001",
    },
  },
  resolve: {
    alias: {
      "@blackfyre/shared": new URL("../shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
