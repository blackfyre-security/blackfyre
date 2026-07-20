import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // 15s was not enough headroom. A handful of tests import a route module or
    // instantiate a service for the first time, which pulls a large dependency
    // graph through the TS transform; in isolation that takes ~11s, but under a
    // full 66-file parallel run it intermittently crossed 15s. The result was a
    // BLOCKING gate that failed 2-4 tests at random, in the same two files, on
    // unmodified main — which makes a red run uninformative and trains everyone
    // to ignore it. The work is first-import cost, not a hang, so the fix is
    // headroom rather than a retry (a retry would hide a genuine hang).
    testTimeout: 45_000,
    hookTimeout: 45_000,
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
