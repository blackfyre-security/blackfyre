import { defineConfig } from "vitest/config";

// Smoke tests hit the deployed staging API over the network. They don't
// need the local Postgres/Redis setup that tests/helpers/setup.ts provides
// (and trying to connect to localhost in CI would error). Keep this config
// minimal — just node env + network timeout headroom.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/smoke/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@blackfyre/shared": new URL("../shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
