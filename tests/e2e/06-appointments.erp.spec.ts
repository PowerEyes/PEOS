import { test, expect } from "@playwright/test";
import { one, rows, TOKEN, BRANCH } from "./helpers";

const marker = `E2E_APPT_${TOKEN}`;
test.skip(process.env.RUN_MUTATING_E2E !== "1" || !process.env.E2E_DATABASE_URL,
  "Requires RUN_MUTATING_E2E=1 and an explicitly configured disposable E2E_DATABASE_URL.");

test("appointments load, book, edit, and save an examination", async ({ page }) => {
  const customer = await one<{id:string;full_name:string}>("select id,full_name from customers where org_id=$1 order by full_name limit 1", ["00000000-0000-0000-0000-000000000001"]);
  if (!customer) throw new Error("The appointment E2E requires at least one seeded customer.");
  const date = new Date(Date.now() + 86400000).toISOString().slice(0,10);
  const time = "10:37";
  try {
    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.locator('input[type="date"]').first().fill(date);
    await page.getByRole("button", { name: "Book", exact: true }).click();
    await page.getByPlaceholder("Find customer…").fill(customer.full_name);
    await page.getByRole("button", { name: new RegExp(customer.full_name) }).click();
    const dates = page.locator('input[type="date"]'); await dates.nth(1).fill(date);
    const times = page.locator('input[type="time"]'); await times.fill(time);
    await page.locator('input[type="number"]').fill("30");
    await page.locator("select.field").nth(1).selectOption(BRANCH.east);
    await page.getByLabel("Notes").last().fill(marker);
    await page.getByRole("button", { name: "Book", exact: true }).last().click();
    await expect(page.getByText(marker)).toBeVisible();

    await page.getByRole("button", { name: "Edit appointment" }).click();
    await page.getByLabel("Notes").last().fill(`${marker}_EDITED`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`${marker}_EDITED`)).toBeVisible();

    await page.getByRole("button", { name: "Eye Exam" }).click();
    for (const label of ["Next: Refraction", "Next: Clinical Findings", "Next: Fundus", "Next: Prescription & Advice"]) {
      await page.getByRole("button", { name: new RegExp(label) }).click();
    }
    await page.getByRole("button", { name: "Save Examination & Create Prescription" }).click();
    await expect(page.getByRole("heading", { name: "Examination Recorded" })).toBeVisible();
  } finally {
    const appointments = await rows<{id:string}>("select id from appointments where org_id=$1 and notes like $2", ["00000000-0000-0000-0000-000000000001", `${marker}%`]);
    for (const a of appointments) {
      await rows("delete from eye_examinations where appointment_id=$1", [a.id]);
      await rows("delete from appointments where id=$1", [a.id]);
    }
  }
});
