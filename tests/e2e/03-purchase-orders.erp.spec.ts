import { test, expect, type Page, type Locator } from "@playwright/test";
import { one, rows, num, stockQty, pickProducts, BRANCH, BRANCH_NAME, TOKEN } from "./helpers";

/** Typed (not linked) so each run is isolated from the 15 seeded suppliers. */
const SUPPLIER = `E2E PO Supplier ${TOKEN}`;
const CANCEL_SUPPLIER = `E2E PO Supplier Cancel ${TOKEN}`;
const QTY = 5;

type Line = { id: string; sku: string };

let lines: Line[];
let beforeEast: Record<string, number>;
let beforeWest: Record<string, number>;
let poNo: string;

const orderDate = () => new Date().toISOString().slice(0, 10);

async function openNewPO(page: Page) {
  await page.goto("/purchases");
  await page.getByTestId("new-po").click();
  const dlg = page.getByRole("dialog", { name: "New purchase order" });
  await expect(dlg).toBeVisible();
  return dlg;
}

/** Fills the drawer and saves; leaves the dialog handle so callers can inspect errors. */
async function fillPO(page: Page, supplier: string, branch: string, items: Line[], qty: number) {
  const dlg = await openNewPO(page);
  await dlg.getByTestId("po-branch").selectOption({ label: branch });
  await dlg.getByTestId("po-date").fill(orderDate());
  await dlg.getByTestId("po-supplier").fill(supplier);

  for (let i = 0; i < items.length; i++) {
    if (i > 0) await dlg.getByRole("button", { name: "Add line" }).click();
    const line = dlg.getByTestId("po-line").nth(i);
    await line.getByTestId("po-product-search").fill(items[i].sku);
    await line.locator("ul li button").first().click();
    await line.getByTestId("po-qty").fill(String(qty));
  }
  await dlg.getByTestId("po-save").click();
  return dlg;
}

async function rowFor(page: Page, no: string): Promise<Locator> {
  const row = page.locator(`[data-testid="po-row"][data-po-no="${no}"]`);
  await expect(row).toBeVisible();
  return row;
}

/** Rows only render their action buttons once expanded. */
async function expand(row: Locator) {
  const actions = row.locator('[data-testid="row-approve"], [data-testid="row-receive"]');
  if ((await actions.count()) === 0) {
    await row.locator(":scope > div").first().click();
    await expect(actions.first()).toBeVisible();
  }
}

async function fetchPO(no: string) {
  return one<any>("select * from purchase_orders where po_no = $1", [no]);
}

test.describe.configure({ mode: "serial" });

test.describe("purchase orders", () => {
  test.beforeAll(async () => {
    // Drop drafts left behind by an aborted earlier run so the assertions below
    // start from a known state (received POs are kept — they hold real stock).
    await rows(
      `delete from purchase_orders p
        where p.supplier_name like 'E2E PO Supplier%'
          and p.status in ('draft', 'approved', 'cancelled')
          and not exists (select 1 from purchase_order_receipts r where r.po_id = p.id)`,
    );
    lines = await pickProducts("frame", 2, 0);
    expect(lines).toHaveLength(2);
    const ids = lines.map((l) => l.id);
    beforeEast = await stockQty(ids, BRANCH.east);
    beforeWest = await stockQty(ids, BRANCH.west);
  });

  test("creates a two-line draft PO for the East branch", async ({ page }) => {
    const dlg = await fillPO(page, SUPPLIER, BRANCH_NAME.east, lines, QTY);
    await expect(dlg).toBeHidden();

    const po = await fetchPO(
      (await one<{ po_no: string }>(
        "select po_no from purchase_orders where supplier_name = $1 order by created_at desc limit 1",
        [SUPPLIER],
      ))!.po_no,
    );
    poNo = po!.po_no;

    expect(po!.status).toBe("draft");
    expect(po!.branch_id).toBe(BRANCH.east);
    expect(po!.lines).toHaveLength(2);
    expect(po!.supplier_id, "typed supplier is not linked to a suppliers row").toBeNull();

    const subtotal = po!.lines.reduce((a: number, l: any) => a + num(l.qty) * num(l.rate), 0);
    const tax = po!.lines.reduce(
      (a: number, l: any) => a + (num(l.qty) * num(l.rate) * num(l.tax_pct)) / 100,
      0,
    );
    expect(num(po!.subtotal)).toBeCloseTo(subtotal, 2);
    expect(num(po!.grand_total)).toBeCloseTo(subtotal + tax, 2); // per-line tax_pct
    for (const l of po!.lines) expect(num(l.received_qty)).toBe(0);

    const row = await rowFor(page, poNo);
    await expect(row).toHaveAttribute("data-status", "draft");
    await expect(row).toHaveAttribute("data-branch", BRANCH.east);
  });

  test("rejects an identical duplicate PO", async ({ page }) => {
    const dlg = await fillPO(page, SUPPLIER, BRANCH_NAME.east, lines, QTY);
    const err = dlg.getByTestId("po-error");
    await expect(err).toBeVisible();
    await expect(err).toContainText("Duplicate purchase order");
    await expect(err).toContainText(poNo);

    const count = await one<{ n: string }>(
      "select count(*) as n from purchase_orders where supplier_name = $1",
      [SUPPLIER],
    );
    expect(Number(count!.n), "the duplicate must not be persisted").toBe(1);

    await dlg.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dlg).toBeHidden();
  });

  test("approves the draft", async ({ page }) => {
    await page.goto("/purchases");
    const row = await rowFor(page, poNo);
    await expand(row);
    await row.getByTestId("row-approve").click();
    await expect(row).toHaveAttribute("data-status", "approved");

    const po = await fetchPO(poNo);
    expect(po!.approved_at).toBeTruthy();
    // An approved order is no longer editable, so the draft-only actions vanish.
    await expect(row.getByTestId("row-approve")).toHaveCount(0);
  });

  test("a partial receipt books stock into the East branch only", async ({ page }) => {
    await page.goto("/purchases");
    const row = await rowFor(page, poNo);
    await expand(row);
    await row.getByTestId("row-receive").click();

    const dlg = page.getByRole("dialog", { name: new RegExp(`^Receive goods — ${poNo}`) });
    await expect(dlg).toBeVisible();
    const qtys = dlg.getByTestId("recv-qty");
    await expect(qtys).toHaveCount(2);

    // First line in full, second line left at zero.
    await qtys.nth(0).fill(String(QTY));
    await qtys.nth(1).fill("0");
    await dlg.getByTestId("recv-note").fill("GRN partial");
    await dlg.getByTestId("recv-submit").click();
    await expect(dlg).toBeHidden();

    await expect(row).toHaveAttribute("data-status", "partially_received");

    const ids = lines.map((l) => l.id);
    const east = await stockQty(ids, BRANCH.east);
    const west = await stockQty(ids, BRANCH.west);

    expect(east[lines[0].id], "first line lands in the PO branch").toBe(beforeEast[lines[0].id] + QTY);
    expect(east[lines[1].id], "second line not received yet").toBe(beforeEast[lines[1].id]);
    // Cross-branch isolation: the West shelf must not move.
    expect(west[lines[0].id]).toBe(beforeWest[lines[0].id]);
    expect(west[lines[1].id]).toBe(beforeWest[lines[1].id]);

    const receipts = await rows<any>(
      "select lines, note from purchase_order_receipts where po_id = (select id from purchase_orders where po_no = $1)",
      [poNo],
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].note).toContain("GRN partial");
    expect(receipts[0].lines).toHaveLength(1);
  });

  test("the remaining line completes the receipt and raises the supplier invoice", async ({ page }) => {
    await page.goto("/purchases");
    const row = await rowFor(page, poNo);
    await expand(row);
    await row.getByTestId("row-receive").click();

    const dlg = page.getByRole("dialog", { name: new RegExp(`^Receive goods — ${poNo}`) });
    await expect(dlg).toBeVisible();
    const qtys = dlg.getByTestId("recv-qty");
    await expect(qtys.nth(0)).toBeDisabled(); // nothing left on line 1
    await expect(qtys.nth(1)).toHaveValue(String(QTY));
    await dlg.getByTestId("recv-note").fill("GRN balance");
    await dlg.getByTestId("recv-submit").click();
    await expect(dlg).toBeHidden();

    await expect(row).toHaveAttribute("data-status", "received");

    const ids = lines.map((l) => l.id);
    const east = await stockQty(ids, BRANCH.east);
    const west = await stockQty(ids, BRANCH.west);
    expect(east[lines[0].id]).toBe(beforeEast[lines[0].id] + QTY);
    expect(east[lines[1].id]).toBe(beforeEast[lines[1].id] + QTY);
    expect(west[lines[0].id]).toBe(beforeWest[lines[0].id]);
    expect(west[lines[1].id]).toBe(beforeWest[lines[1].id]);

    const po = await fetchPO(poNo);
    expect(po!.invoice_id, "GRN must raise a linked purchase invoice").toBeTruthy();

    const inv = await one<any>("select * from purchase_invoices where id = $1", [po!.invoice_id]);
    expect(inv.invoice_no).toBe(poNo);
    expect(inv.po_ref).toBe(poNo);
    expect(inv.branch_id).toBe(BRANCH.east);
    expect(inv.stock_posted_at).toBeTruthy();
    expect(num(inv.grand_total)).toBeCloseTo(num(po!.grand_total), 2);
    expect(num(inv.subtotal)).toBeCloseTo(num(po!.subtotal), 2);
    expect(num(inv.cgst_amount) + num(inv.sgst_amount) + num(inv.igst_amount)).toBeCloseTo(
      num(inv.grand_total) - num(inv.subtotal),
      2,
    );
    expect(inv.lines.reduce((a: number, l: any) => a + num(l.qty), 0)).toBe(2 * QTY);

    // Cancel is refused once goods have been booked.
    await expect(row.getByTestId("row-cancel")).toHaveCount(0);
    await expect(row.getByTestId("row-receive")).toHaveCount(0);
  });

  test("a draft PO can be cancelled and leaves the open order value", async ({ page }) => {
    const item = (await pickProducts("sunglass", 1, 0))[0];
    const dlg = await fillPO(page, CANCEL_SUPPLIER, BRANCH_NAME.west, [item], 3);
    await expect(dlg).toBeHidden();

    const po = await one<{ po_no: string; grand_total: string }>(
      "select po_no, grand_total from purchase_orders where supplier_name = $1 order by created_at desc limit 1",
      [CANCEL_SUPPLIER],
    );
    expect(po).toBeTruthy();

    const row = await rowFor(page, po!.po_no);
    await expect(row).toHaveAttribute("data-status", "draft");
    await expand(row);
    await row.getByTestId("row-cancel").click();
    await expect(row).toHaveAttribute("data-status", "cancelled");

    const stored = await one<any>("select status, cancelled_at from purchase_orders where po_no = $1", [po!.po_no]);
    expect(stored.status).toBe("cancelled");
    expect(stored.cancelled_at).toBeTruthy();

    // Cancelled orders are excluded from open_po_value.
    const open = await one<{ n: string }>(
      "select count(*) as n from open_po_value where branch_id = $1 and supplier_id is null",
      [BRANCH.west],
    );
    expect(Number(open!.n), "cancelled order must not count as open value").toBe(0);

    // A cancelled order can no longer receive goods.
    await expect(row.getByTestId("row-receive")).toHaveCount(0);
    await expect(row.getByTestId("row-cancel")).toHaveCount(0);
  });
});
