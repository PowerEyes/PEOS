import { test, expect } from "@playwright/test";
import { one, rows, tryQuery } from "./helpers";

const PROBE_MODEL = "E2E duplicate SKU probe";

test.describe("inventory uniqueness guards", () => {
  test.beforeAll(async () => {
    // Left-overs from an earlier aborted run would otherwise skew the baseline.
    await rows("delete from products where model = $1", [PROBE_MODEL]);
  });

  test("products carry a unique (org, sku) constraint", async () => {
    const cons = await rows<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'products'::regclass and conname = 'products_org_id_sku_key'`,
    );
    expect(cons.map((c) => c.conname)).toEqual(["products_org_id_sku_key"]);

    const dupes = await one<{ n: string }>(
      "select count(*) - count(distinct sku) as n from products where org_id = '00000000-0000-0000-0000-000000000001'",
    );
    expect(Number(dupes!.n), "no two products may share a SKU").toBe(0);
  });

  test("the insert trigger regenerates a supplied duplicate SKU", async () => {
    const existing = await one<{ id: string; sku: string; org_id: string }>(
      "select id, sku, org_id from products limit 1",
    );
    expect(existing).toBeTruthy();

    // Ask for a SKU that is already taken: the products_before trigger must
    // rewrite it rather than let a duplicate through the unique index.
    let created: { id: string; sku: string } | null = null;
    let failure: any = null;
    try {
      created = (
        await rows<{ id: string; sku: string }>(
          `insert into products (org_id, kind, model, sku, selling_price)
           values ($1, 'frame', $2, $3, 100) returning id, sku`,
          [existing!.org_id, PROBE_MODEL, existing!.sku],
        )
      )[0]!;
    } catch (e) {
      failure = e;
    }

    if (failure) {
      // Rejected outright — also an acceptable enforcement of the guard.
      expect(String((failure as any).code ?? failure)).toMatch(/23505/);
    } else {
      expect(created!.sku, "a colliding SKU must be regenerated, not stored").not.toBe(existing!.sku);
      const clash = await one<{ n: string }>(
        "select count(*) as n from products where org_id = $1 and sku = $2",
        [existing!.org_id, existing!.sku],
      );
      expect(Number(clash!.n)).toBe(1);
    }

    await rows("delete from products where model = $1", [PROBE_MODEL]);
    const left = await one("select id from products where model = $1", [PROBE_MODEL]);
    expect(left, "probe row must not linger").toBeNull();
  });

  test("a stored SKU cannot be rewritten onto another product", async () => {
    const a = await one<{ id: string; sku: string }>("select id, sku from products order by sku asc limit 1");
    const b = await one<{ id: string; sku: string }>("select id, sku from products order by sku desc limit 1");
    expect(a && b && a.sku !== b.sku).toBe(true);

    // The before-trigger pins new.sku := old.sku on UPDATE, so this is a no-op.
    await tryQuery("update products set sku = $1 where id = $2", [a!.sku, b!.id]);
    const after = await one<{ sku: string }>("select sku from products where id = $1", [b!.id]);
    expect(after!.sku, "SKU must be immutable after creation").toBe(b!.sku);
  });

  test("the product form refuses a barcode that is already in use", async ({ page }) => {
    const clash = await one<{ barcode: string; n: string }>(
      "select barcode, count(*) over () as n from products where barcode is not null limit 1",
    );
    expect(clash).toBeTruthy();
    const before = await one<{ n: string }>("select count(*) as n from products where barcode = $1", [
      clash!.barcode,
    ]);

    await page.goto("/inventory");
    await page.getByRole("button", { name: "Add product" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();

    await dlg.getByLabel("Model").fill("E2E barcode clash");
    await dlg.getByLabel("Barcode").fill(clash!.barcode);
    // Never open the label printer window from the test run.
    await dlg.locator('input[type="checkbox"]').first().uncheck().catch(() => {});

    await dlg.getByRole("button", { name: "Pricing" }).click();
    await dlg.getByLabel("Selling price").fill("500");

    await dlg.getByRole("button", { name: "Display" }).click();
    await dlg.locator("footer button.btn-gold").click();

    await expect(page.getByText("That barcode is already used by another product.")).toBeVisible();
    await expect(dlg, "the drawer stays open so the user can correct it").toBeVisible();

    const after = await one<{ n: string }>("select count(*) as n from products where barcode = $1", [
      clash!.barcode,
    ]);
    expect(Number(after!.n)).toBe(Number(before!.n));
  });
});
