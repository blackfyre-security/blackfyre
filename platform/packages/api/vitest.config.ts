import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // setup.ts connects to Postgres/Redis — only needed for integration tests.
    // Unit tests (tests/unit/**) use mocks and run without external services.
    setupFiles: ["./tests/helpers/setup.ts"],
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): EncryptionProviderService now fails
    // closed without configured key material; supply a test-only key (NOT a real secret).
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
