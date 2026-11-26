import { test, expect } from "@playwright/test";
import { one } from "./helpers";

/**
 * Console / network health pass over the public storefront.
 */
const PAGES = ["/", "/eyeglasses", "/sunglasses", "/contact-lenses", "/accessories"];

type Issue = { where: string; kind: string; detail: string };

function collect(page: any, where: string, sink: Issue[]) {
  page.on("console", (m: any) => {
    if (m.type() === "error") sink.push({ where, kind: "console.error", detail: m.text().slice(0, 400) });
  });
  page.on("pageerror", (e: any) => sink.push({ where, kind: "pageerror", detail: String(e).slice(0, 400) }));
  page.on("requestfailed", (r: any) => {
    const t = r.resourceType();
    if (t === "document" || t === "xhr" || t === "fetch" || t === "script") {
      sink.push({ where, kind: `requestfailed(${t})`, detail: `${r.method()} ${r.url()} — ${r.failure()?.errorText}` });
    }
  });
  page.on("response", (r: any) => {
    if (r.status() >= 400 && r.url().includes("localhost:3000")) {
      sink.push({ where, kind: `http ${r.status()}`, detail: `${r.request().method()} ${r.url()}` });
    }
  });
}

test.describe("storefront diagnostics", () => {
  test("no console errors or failed requests while browsing", async ({ page }) => {
    const issues: Issue[] = [];
    collect(page, "boot", issues);

    const paths = [...PAGES];
    const product = await one<{ id: string }>("select id from public_catalog where kind='frame' limit 1");
    if (product) paths.push(`/product/${product.id}`);

    for (const path of paths) {
      collect(page, path, issues);
      const res = await page.goto(path, { waitUntil: "networkidle" });
      expect(res!.status(), `${path} should render`).toBeLessThan(400);
      await page.waitForTimeout(400);
    }

    const real = issues.filter(
      (i) =>
        !/favicon|HMR|Fast Refresh|Download the React DevTools|ResizeObserver loop|net::ERR_ABORTED/i.test(i.detail) &&
        !i.detail.includes("/_next/static/"),
    );

    expect(
      real,
      `Storefront produced ${real.length} console/network issue(s):\n` +
        real.map((i) => `  [${i.where}] ${i.kind}: ${i.detail}`).join("\n"),
    ).toEqual([]);
  });

  test("the 375-product catalogue is reachable from the homepage nav", async ({ page }) => {
    await page.goto("/");
    for (const href of ["/eyeglasses", "/sunglasses", "/contact-lenses", "/accessories"]) {
      await expect(page.locator(`a[href="${href}"]`).first(), `${href} should be linked`).toBeVisible();
    }
  });
});
