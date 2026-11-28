import { test, expect, type Page } from "@playwright/test";
import { one, rows, num, scalar, until, ORG_ID, BRANCH } from "./helpers";

/** Every product card links to /product/<id>; dedup because power-eligible cards link twice. */
async function cardHrefs(page: Page): Promise<string[]> {
  return page.$$eval('a[href^="/product/"]', (els) =>
    [...new Set(els.map((e) => e.getAttribute("href")))].filter(Boolean) as string[],
  );
}

async function cardText(page: Page, id: string): Promise<string | null> {
  const card = page.locator(`a[href="/product/${id}"]`).first();
  if ((await card.count()) === 0) return null;
  const root = card.locator("xpath=..");
  return root.innerText().catch(() => null);
}

/** Rides out the 60s ISR window on the listing pages. */
async function untilCardSays(page: Page, id: string, want: string, absent = false) {
  await until(
    async () => {
      // Unique query param so Next re-renders instead of serving the ISR copy.
      await page.goto(`/eyeglasses?cb=${Date.now()}`, { waitUntil: "networkidle" });
      const txt = await cardText(page, id);
      if (txt === null) return false;
      return absent ? !txt.includes(want) : txt.includes(want);
    },
    90_000,
    3_000,
  );
}

async function untilProductSays(page: Page, id: string, want: string) {
  await until(
    async () => {
      // networkidle: `in_stock` is fetched client-side after hydration.
      await page.goto(`/product/${id}?cb=${Date.now()}`, { waitUntil: "networkidle" });
      const txt = await page.locator("body").innerText();
      return txt.toLowerCase().includes(want.toLowerCase());
    },
    90_000,
    2_000,
  );
}

/**
 * Moves a product's stock without breaking the ledger invariant that
 * `sum(stock_movements.delta) = stock.qty` (asserted by the ERP baseline spec).
 */
async function setStock(productId: string, qty: number, note: string) {
  const current = await rows<{ branch_id: string; qty: number; reserved_qty: number }>(
    "select branch_id, qty, reserved_qty from stock where product_id = $1",
    [productId],
  );
  for (const s of current) {
    const delta = qty - num(s.qty);
    if (delta === 0) continue;
    // `trg_apply_movement` (AFTER INSERT) posts the delta onto `stock`, so the
    // movement alone keeps `sum(delta) = qty` and the branch floor in one go.
    await rows(
      `insert into stock_movements (org_id, branch_id, product_id, delta, reason, note)
       values ($1, $2, $3, $4, 'adjustment', $5)`,
      [ORG_ID, s.branch_id, productId, delta, note],
    );
  }
  return current;
}

test.describe("storefront", () => {
  test("every category lists its full catalogue", async ({ page }) => {
    const cases: Array<{ path: string; kind: string; seeded: number }> = [
      { path: "/eyeglasses", kind: "frame", seeded: 100 },
      { path: "/sunglasses", kind: "sunglass", seeded: 100 },
      { path: "/contact-lenses", kind: "contact_lens", seeded: 125 },
      { path: "/accessories", kind: "accessory", seeded: 50 },
    ];

    for (const c of cases) {
      const expected = Number(
        (await scalar(`select count(*) from public_catalog where kind = $1`, [c.kind])) ?? 0,
      );
      expect(expected, `${c.kind} catalogue size`).toBeGreaterThanOrEqual(c.seeded);

      await page.goto(c.path);
      const hrefs = await cardHrefs(page);
      expect(hrefs.length, `${c.path} should render every product once`).toBe(expected);
      expect(hrefs.length).toBeGreaterThanOrEqual(c.seeded);
    }
  });

  test("the accessories nav link resolves instead of 404ing", async ({ page }) => {
    const res = await page.goto("/accessories");
    expect(res!.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Accessories", level: 1 })).toBeVisible();
    expect(await cardHrefs(page)).toHaveLength(50);
  });

  test("shape, brand, gender and price filters narrow the grid", async ({ page }) => {
    // Shape — the URL uses the hyphen form, the page maps it back to a space.
    for (const shape of ["round", "square", "aviator", "cat-eye"]) {
      const dbShape = shape.replace(/[-_]+/g, " ");
      const expected = Number(
        (await scalar(
          `select count(*) from public_catalog
            where kind = 'frame' and lower(coalesce(attrs->>'shape','')) = lower($1)`,
          [dbShape],
        )) ?? 0,
      );
      if (expected === 0) continue;
      await page.goto(`/eyeglasses?shape=${shape}`);
      expect((await cardHrefs(page)).length, `?shape=${shape}`).toBe(expected);
    }

    // Brand
    const brand = String(
      (await scalar(`select brand from public_catalog where kind='frame' and brand is not null order by brand limit 1`)) ?? "",
    );
    expect(brand).toBeTruthy();
    const brandCount = Number(
      (await scalar(`select count(*) from public_catalog where kind='frame' and brand = $1`, [brand])) ?? 0,
    );
    await page.goto(`/eyeglasses?brand=${encodeURIComponent(brand)}`);
    expect(await cardHrefs(page)).toHaveLength(brandCount);

    // Gender — values are stored lowercase, so ?gender=Men would return nothing.
    const genderCount = Number(
      (await scalar(`select count(*) from public_catalog where kind='frame' and gender = 'men'`)) ?? 0,
    );
    await page.goto("/eyeglasses?gender=men");
    expect(await cardHrefs(page)).toHaveLength(genderCount);

    // Price band
    const bandCount = Number(
      (await scalar(
        `select count(*) from public_catalog where kind='frame' and selling_price between 1000 and 3000`,
      )) ?? 0,
    );
    await page.goto("/eyeglasses?min=1000&max=3000");
    const hrefs = await cardHrefs(page);
    expect(hrefs).toHaveLength(bandCount);

    const prices = await page.$$eval('a[href^="/product/"]', (anchors) => {
      const seen = new Set<string>();
      const out: number[] = [];
      for (const a of anchors) {
        const href = a.getAttribute("href")!;
        if (seen.has(href)) continue;
        const card = a.closest("div.group");
        // `span.font-bold` also matches the "% OFF" badge — take the ₹ one.
        const el = [...(card?.querySelectorAll("span.font-bold") ?? [])].find((s) =>
          /^₹/.test((s.textContent ?? "").trim()),
        );
        if (!el) continue;
        seen.add(href);
        out.push(Number((el.textContent ?? "").replace(/[^\d.]/g, "")));
      }
      return out;
    });
    expect(prices.length).toBe(bandCount);
    for (const p of prices) {
      expect(p).toBeGreaterThanOrEqual(1000);
      expect(p).toBeLessThanOrEqual(3000);
    }
  });

  test("cards render ₹ pricing with discount and MRP", async ({ page }) => {
    const discounted = Number(
      (await scalar(
        `select count(*) from public_catalog
          where kind = 'frame' and mrp is not null and mrp > selling_price`,
      )) ?? 0,
    );
    expect(discounted, "the seeded catalogue must contain discounted lines").toBeGreaterThan(0);

    await page.goto("/eyeglasses");
    const prices = await page.$$eval('a[href^="/product/"]', (anchors) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const a of anchors) {
        const href = a.getAttribute("href")!;
        if (seen.has(href)) continue;
        const card = a.closest("div.group");
        const el = [...(card?.querySelectorAll("span.font-bold") ?? [])].find((s) =>
          /^₹/.test((s.textContent ?? "").trim()),
        );
        if (el) {
          seen.add(href);
          out.push(el.textContent ?? "");
        }
      }
      return out;
    });
    expect(prices.length).toBeGreaterThanOrEqual(100);
    for (const p of prices) expect(p).toMatch(/₹[\d,]+/);

    // Discount badge + struck-through MRP both render.
    await expect(page.getByText(/\d+% OFF/).first()).toBeVisible();
    expect(await page.locator("span.line-through").count()).toBeGreaterThan(0);
  });

  test("in-stock products are purchasable, zero-stock products read out of stock", async ({ page }) => {
    // Three stock flips, each waiting on a listing re-render.
    test.setTimeout(720_000);
    const product = await one<{ id: string; model: string }>(
      `select p.id, p.model from public_catalog p
        where p.kind = 'frame' and p.in_stock
          and exists (select 1 from stock s where s.product_id = p.id and s.branch_id = $1)
          and exists (select 1 from stock s where s.product_id = p.id and s.branch_id = $2)
        order by p.sku limit 1`,
      [BRANCH.east, BRANCH.west],
    );
    expect(product).toBeTruthy();
    const id = product!.id;

    // --- Phase A: stocked in both branches ---
    await untilProductSays(page, id, "In Stock");
    await untilCardSays(page, id, "Out of stock", true);

    // --- Phase B: drained in both branches ---
    const original = await setStock(id, 0, "E2E out-of-stock probe");
    expect(original.length, "product must be stocked in both branches").toBeGreaterThanOrEqual(2);
    try {
      await untilProductSays(page, id, "Currently Out of Stock");
      await untilCardSays(page, id, "Out of stock");

      // --- Phase C: one unit per branch (2 in total) — low-stock warning ---
      await setStock(id, 1, "E2E low-stock probe");
      await untilProductSays(page, id, "In Stock");
      await untilCardSays(page, id, "Only 2 left in stock");
    } finally {
      for (const s of original) await setStock(id, num(s.qty), "E2E restore");
    }

    // --- Back to normal ---
    await untilProductSays(page, id, "In Stock");
    await untilCardSays(page, id, "Out of stock", true);
  });

  test("a card opens its product detail page", async ({ page }) => {
    await page.goto("/eyeglasses");
    const first = await cardHrefs(page);
    expect(first.length).toBeGreaterThanOrEqual(100);

    const res = await page.goto(first[0]);
    expect(res!.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/In Stock|Currently Out of Stock/i);
  });
});
