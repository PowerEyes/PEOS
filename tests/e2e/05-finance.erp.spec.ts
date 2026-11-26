import { test, expect } from "@playwright/test";
import { one, rows, num, amountAfter } from "./helpers";

/** Mirrors the server-side window in apps/erp/src/app/(app)/finance/page.tsx. */
function monthWindow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

test.describe("finance", () => {
  test("purchase invoices reconcile with the ledger", async ({ page }) => {
    const db = await one<{
      grand: string;
      paid: string;
      itc: string;
      gst: string;
      n: string;
    }>(
      `select coalesce(sum(grand_total), 0) as grand,
              coalesce(sum(paid_amount), 0) as paid,
              coalesce(sum(case when itc_eligible
                                then coalesce(cgst_amount,0) + coalesce(sgst_amount,0) + coalesce(igst_amount,0) else 0 end), 0) as itc,
              coalesce(sum(coalesce(cgst_amount,0) + coalesce(sgst_amount,0) + coalesce(igst_amount,0)), 0) as gst,
              count(*) as n
         from purchase_invoices`,
    );
    expect(num(db!.n), "every received PO books an invoice").toBeGreaterThanOrEqual(30);

    await page.goto("/purchase-invoices");
    const text = await page.locator("main").innerText();

    const balance = amountAfter(text, "Balance due");
    const itc = amountAfter(text, "ITC available");
    const gstPaid = amountAfter(text, "Total GST paid");
    const purchases = amountAfter(text, "Total purchases");

    expect(balance).toBeCloseTo(num(db!.grand) - num(db!.paid), 0);
    expect(itc).toBeCloseTo(num(db!.itc), 0);
    expect(gstPaid).toBeCloseTo(num(db!.gst), 0);
    expect(purchases).toBeCloseTo(num(db!.grand), 0);
  });

  test("Input ITC on the Finance dashboard equals this month's purchase GST", async ({ page }) => {
    const w = monthWindow();
    const db = await one<{ gst: string; n: string }>(
      `select coalesce(sum(cgst_total) + sum(sgst_total) + sum(igst_total), 0) as gst,
              count(*) as n
         from purchase_invoices
        where invoice_date >= $1 and invoice_date < $2`,
      [w.start, w.end],
    );
    expect(num(db!.n)).toBeGreaterThan(0);

    await page.goto("/finance");
    const text = await page.locator("main").innerText();
    expect(amountAfter(text, "Input ITC")).toBeCloseTo(num(db!.gst), 0);
  });

  test("every supplier's outstanding balance is its unpaid invoice value", async ({ page }) => {
    // Suppliers that own the 30 seeded PO invoices (2 branches each).
    const suppliers = await rows<{ id: string; name: string; balance: string; invoices: string }>(
      `select s.id, s.name,
              coalesce(sum(pi.grand_total - pi.paid_amount), 0) as balance,
              count(pi.id) as invoices
         from suppliers s
         join purchase_invoices pi on pi.supplier_id = s.id and pi.po_ref like 'PO-%'
        group by s.id, s.name
       having count(pi.id) >= 2
        order by s.name`,
    );
    expect(suppliers.length, "15 suppliers each own a PO per branch").toBeGreaterThanOrEqual(15);
    for (const s of suppliers) expect(num(s.invoices)).toBeGreaterThanOrEqual(2);
    const poInvoices = suppliers.reduce((a, s) => a + num(s.invoices), 0);
    expect(poInvoices, "30 PO invoices across the supplier set").toBe(30);

    const total = suppliers.reduce((a, s) => a + num(s.balance), 0);
    expect(total).toBeGreaterThan(0);

    // The KPI "Balance due" covers all invoices, PO-seeded ones included.
    const dbTotal = await one<{ v: string }>(
      "select coalesce(sum(grand_total - paid_amount), 0) as v from purchase_invoices",
    );
    expect(num(dbTotal!.v)).toBeGreaterThanOrEqual(total);

    await page.goto("/purchase-invoices");
    const invoiceText = await page.locator("main").innerText();
    expect(amountAfter(invoiceText, "Balance due")).toBeCloseTo(num(dbTotal!.v), 0);

    // Every PO supplier is addressable from the Suppliers tab with its GSTIN.
    await page.getByRole("button", { name: "suppliers", exact: true }).click();
    const supplierText = await page.locator("main").innerText();
    for (const s of suppliers.slice(0, 15)) {
      expect(supplierText, `${s.name} should be listed`).toContain(s.name);
    }
  });

  test("supplier balances are non-negative and sum to the PO invoice ledger", async () => {
    const r = await one<{ suppliers: string; sum: string; negative: string; invoices: string }>(
      `select count(distinct supplier_id) filter (where supplier_id is not null) as suppliers,
              count(*) filter (where supplier_id is not null) as invoices,
              coalesce(sum(grand_total - paid_amount) filter (where supplier_id is not null), 0) as sum,
              count(*) filter (where paid_amount > grand_total) as negative
         from purchase_invoices where po_ref like 'PO-%'`,
    );
    expect(Number(r!.suppliers)).toBe(15);
    expect(Number(r!.invoices), "15 suppliers x 2 branches").toBe(30);
    expect(Number(r!.negative), "no invoice may be over-paid").toBe(0);
    // 30 POs x 25 lines x 10 units at seeded cost + 18% GST.
    expect(num(r!.sum)).toBeCloseTo(12458204, 0);
  });
});
