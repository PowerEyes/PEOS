import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_FILE = path.join(__dirname, "..", ".auth", "erp.json");
const EMAIL = process.env.ERP_EMAIL ?? "";
const PASSWORD = process.env.ERP_PASSWORD ?? "";

setup.skip(!EMAIL || !PASSWORD, "Set ERP_EMAIL and ERP_PASSWORD to use an isolated E2E account.");

setup("sign in to the ERP as the owner", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Sign in")');

  // The login form swaps to "/" once Supabase accepts the session.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
