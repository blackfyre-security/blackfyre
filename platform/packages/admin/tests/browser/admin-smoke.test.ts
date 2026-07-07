/**
 * Browser smoke tests — real Chromium via @playwright/test.
 * Walks through the deployed staging admin UI end-to-end.
 *
 * Skipped unless BROWSER_SMOKE=1 is set so casual test runs don't hit
 * staging. The `test:browser` script in package.json sets that flag,
 * and playwright.config.ts ignores all test files otherwise.
 *
 * Why these tests exist alongside the JSON-API smoke tests:
 *   - tests/smoke/ on the api package hits the JSON API directly.
 *     These hit the rendered admin UI so we catch React/build/static-
 *     export/CSP regressions that pure-API tests can't see (e.g. login
 *     submits but the redirect breaks, or the Leads sidebar entry
 *     disappears after a refactor).
 *
 * Conservative scope: read-only flows. Login bumps last_login but is
 * idempotent in shape; the dedicated platform admin account is fine for
 * repeated test runs.
 */
import { test, expect } from "@playwright/test";

const ADMIN = {
  email: "admin@blackfyre.tech",
  password: "admin@blackfyre",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  // Click + wait for the API call to settle. Staging Lambda cold starts
  // can add a few seconds, so we wait explicitly for the login network
  // call rather than relying on UI timing.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.status() === 200, { timeout: 30_000 }),
    page.getByRole("button", { name: /sign in|log\s*in/i }).click(),
  ]);
  // Cookie's set; URL should leave /login. Wait for the redirect to land.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  // Sidebar's "Clients" link is the cheapest reliable signal that the
  // dashboard frame has hydrated.
  await expect(page.getByRole("link", { name: /clients/i })).toBeVisible({ timeout: 15_000 });
}

test.describe("admin browser smoke — staging", () => {
  test("login → dashboard renders", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("link", { name: /findings/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /leads/i })).toBeVisible();
  });

  test("Leads page renders with seeded submissions", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /leads/i }).click();
    await expect(page).toHaveURL(/\/contact-submissions/);
    // Match either the deploy-session smoketest or one of the
    // staging-smoke vitest test runs that POST a row each time.
    await expect(
      page.getByText(/deploy smoketest|smoke test|smoke\+/i).first(),
    ).toBeVisible();
  });

  test("Recipients page lists the seeded founder address", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /leads/i }).click();
    await page.getByRole("link", { name: /manage notification recipients/i }).click();
    await expect(page).toHaveURL(/\/contact-submissions\/recipients/);
    await expect(page.getByText("founder@blackfyre.tech")).toBeVisible();
  });
});
