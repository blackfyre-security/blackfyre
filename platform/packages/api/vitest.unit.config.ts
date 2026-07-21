import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Back at the original 15s. The suite used to fail 2-4 tests at random here,
    // which was blamed on needing more headroom; raising it to 45s did not fix it.
    // The real cause was services/integration-service.ts importing the agent
    // registry at module scope, pulling all ~34 auditors and the three cloud SDKs
    // into the transform graph (~210s of collect). That import is now lazy, collect
    // dropped to ~24s, and the suite passes comfortably inside the original limit.
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
