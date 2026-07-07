import { defineConfig, devices } from "@playwright/test";

// Playwright config for cross-origin E2E against the deployed staging admin.
//
// Tests live in tests/browser/ and are opt-in via BROWSER_SMOKE=1 (see the
// `test:browser` script in package.json). Why opt-in: these hit real
// staging endpoints; we don't want every developer's casual `npm test`
// to mutate the database or fail when staging is briefly down.
//
// CI integration is deferred — see docs/BACKLOG.md "Set up Vitest browser
// mode". The integration step will likely run these only on the
// `feat/*` branch push events, not every PR.

const BROWSER_SMOKE = process.env.BROWSER_SMOKE === "1";

export default defineConfig({
  testDir: "./tests/browser",
  // Hard fail-fast on accidentally checking in `.only`
  forbidOnly: !!process.env.CI,
  // 0 retries locally so flakes surface; 1 retry on CI to absorb network blips
  retries: process.env.CI ? 1 : 0,
  // 1 worker locally to keep the staging request pattern predictable
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.ADMIN_BASE_URL ?? "https://admin-staging.blackfyre.tech",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // When BROWSER_SMOKE isn't set, ignore the test files entirely so
  // `playwright test` exits 0 with "no tests found".
  testIgnore: BROWSER_SMOKE ? [] : ["**/*"],
});
