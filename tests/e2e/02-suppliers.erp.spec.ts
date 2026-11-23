import { test, expect } from "@playwright/test";
import { one, TOKEN } from "./helpers";

const NAME = `E2E Supplier ${TOKEN}`;
const GSTIN = `33AABCE${String(Date.now() % 10000).padStart(4, "0")}K1Z9`;
const PHONE = "98400 70001";

test.describe("suppliers", () => {
  test("creates a supplier with GSTIN + contact details", async ({ page }) => {
    await page.goto("/purchase-invoices");
    await page.getByRole("button", { name: "suppliers", exact: true }).click();
    await page.getByRole("button", { name: "Add supplier" }).click();

    const modal = page
      .locator("div.fixed.inset-0.z-50")
      .filter({ has: page.getByRole("heading", { name: "Add supplier" }) });
    await expect(modal).toBeVisible();

    await modal.getByLabel("Supplier name").fill(NAME);
    await modal.getByLabel("GSTIN").fill(GSTIN.toLowerCase()); // stored upper-cased
    await modal.getByLabel("Phone").fill(PHONE);
    await modal.getByLabel("Email").fill("e2e@example.test");
    await modal.getByLabel("Contact person").fill("E2E Contact");
    await modal.getByLabel("Address").fill("1 Test Street, Chennai - 600001");
    await modal.getByRole("button", { name: "Add supplier" }).click();

    await expect(modal).toBeHidden();
    await expect(page.getByText(NAME, { exact: true })).toBeVisible();

    const row = await one<{ id: string; gstin: string; phone: string; contact_person: string; status: string }>(
      "select id, gstin, phone, contact_person, status from suppliers where name = $1",
      [NAME],
    );
    expect(row, "supplier should be persisted").toBeTruthy();
    expect(row!.gstin).toBe(GSTIN);
    expect(row!.phone).toBe(PHONE);
    expect(row!.contact_person).toBe("E2E Contact");
    expect(row!.status).toBe("active");
  });

  test("edits the supplier in place", async ({ page }) => {
    await page.goto("/purchase-invoices");
    await page.getByRole("button", { name: "suppliers", exact: true }).click();

    const row = page.locator('div[class*="divide-y"] > div').filter({ hasText: NAME }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit" }).click();

    const modal = page
      .locator("div.fixed.inset-0.z-50")
      .filter({ has: page.getByRole("heading", { name: "Edit supplier" }) });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Supplier name")).toHaveValue(NAME);

    const NEW_PHONE = "98400 70002";
    await modal.getByLabel("Phone").fill(NEW_PHONE);
    await modal.getByLabel("Contact person").fill("E2E Contact Edited");
    await modal.getByRole("button", { name: "Update" }).click();
    await expect(modal).toBeHidden();

    const updated = await one<{ phone: string; contact_person: string }>(
      "select phone, contact_person from suppliers where name = $1",
      [NAME],
    );
    expect(updated!.phone).toBe(NEW_PHONE);
    expect(updated!.contact_person).toBe("E2E Contact Edited");
    await expect(row).toContainText(NEW_PHONE);
  });

  test("a supplier name can only exist once per organisation", async ({ page }) => {
    // suppliers carries UNIQUE (org_id, name), so re-creating NAME must fail.
    await page.goto("/purchase-invoices");
    await page.getByRole("button", { name: "suppliers", exact: true }).click();
    await page.getByRole("button", { name: "Add supplier" }).click();

    const modal = page
      .locator("div.fixed.inset-0.z-50")
      .filter({ has: page.getByRole("heading", { name: "Add supplier" }) });
    await modal.getByLabel("Supplier name").fill(NAME);
    await modal.getByLabel("GSTIN").fill(`33AABCE${String(Date.now() % 10000).padStart(4, "0")}K1Z9`);
    await modal.getByRole("button", { name: "Add supplier" }).click();

    const err = modal.locator("p.rounded-xl.bg-rose-50");
    await expect(err, "duplicate supplier name must surface an error").toBeVisible();

    const count = await one<{ n: string }>("select count(*) as n from suppliers where name = $1", [NAME]);
    expect(Number(count!.n), "no second row may be created").toBe(1);

    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).toBeHidden();
  });
});
