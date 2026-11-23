import { test, expect } from "@playwright/test";

/**
 * Console / network health pass over the ERP — the equivalent of walking the
 * DevTools console and Network tab after the data seeding.
 */
const PAGES = ["/", "/inventory", "/purchases", "/purchase-invoices", "/finance"];

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
    if (r.status() >= 400 && r.url().includes("localhost:3001")) {
      sink.push({ where, kind: `http ${r.status()}`, detail: `${r.request().method()} ${r.url()}` });
    }
  });
}

test.describe("ERP diagnostics", () => {
  test("no console errors or failed API calls while navigating", async ({ page }) => {
    const issues: Issue[] = [];
    collect(page, "boot", issues);

    for (const path of PAGES) {
      collect(page, path, issues);
      const res = await page.goto(path, { waitUntil: "networkidle" });
      expect(res!.status(), `${path} should render`).toBeLessThan(400);
      await page.waitForTimeout(500);
    }

    // Filter out noise the app itself logs on purpose.
    const real = issues.filter(
      (i) =>
        !/favicon|HMR|Fast Refresh|Download the React DevTools|ResizeObserver loop/i.test(i.detail) &&
        !i.detail.includes("/_next/static/"),
    );

    expect(
      real,
      `ERP produced ${real.length} console/network issue(s):\n` +
        real.map((i) => `  [${i.where}] ${i.kind}: ${i.detail}`).join("\n"),
    ).toEqual([]);
  });
});
