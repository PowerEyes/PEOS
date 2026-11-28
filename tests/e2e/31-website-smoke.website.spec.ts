import { test, expect } from "@playwright/test";

/**
 * Unauthenticated smoke coverage for the SaaS marketing site (3003).
 */
test.describe("SaaS website smoke", () => {
  test("landing page renders and pricing links point to checkout", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/PowerOS ERP for/)).toBeVisible();
    await expect(page.locator('a[href="/subscribe"]').first()).toBeVisible();
    const growthLink = page.locator('a[href="/subscribe?plan=growth"]').first();
    await expect(growthLink).toBeVisible();
    await expect(growthLink).toHaveAttribute("href", "/subscribe?plan=growth");
  });

  test("dashboard redirects anonymous users to login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\?next=\/dashboard$/);
    await expect(page.getByText("Sign in to your optical store ERP")).toBeVisible();
  });

  test("onboarding and subscribe are guarded", async ({ page }) => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\?next=\/onboarding$/);
    await page.goto("/subscribe", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\?next=\/subscribe$/);
  });

  test("login API rejects bad credentials without leaking a token", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: { email: "nobody@example.com", password: "wrong-password" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.token).toBeUndefined();
  });
});
