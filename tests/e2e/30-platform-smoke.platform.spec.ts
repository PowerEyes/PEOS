import { test, expect } from "@playwright/test";

/**
 * Unauthenticated smoke coverage for the SaaS control plane (3002).
 * The layout guard must send every control-plane page to /login.
 */
test.describe("SaaS platform smoke", () => {
  const guarded = ["/", "/organisations", "/billing", "/support", "/admin/invitations"];

  for (const path of guarded) {
    test(`${path} redirects anonymous users to login`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} should not 500`).toBeLessThan(500);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByText("PowerOS Platform")).toBeVisible();
    });
  }

  test("login page loads with compiled styles", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Sign In to Platform/i })).toBeVisible();
    const stylesheet = await page.locator('link[rel="stylesheet"]').first().getAttribute("href");
    expect(stylesheet, "global CSS should be linked").toBeTruthy();
  });

  test("login API rejects missing credentials", async ({ request }) => {
    const response = await request.post("/api/auth/login", { data: {} });
    expect(response.status()).toBe(400);
  });
});
