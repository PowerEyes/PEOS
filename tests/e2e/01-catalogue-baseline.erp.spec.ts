import { test, expect } from "@playwright/test";
import { rows, one, num, SEEDED, BRANCH, ORG_ID } from "./helpers";

/**
 * Baseline snapshot of the seeded catalogue + branch stock.
 *
 * Runs first (file name is ordered ahead of the mutating specs) so it observes
 * the database before this suite books anything of its own. Other tenants in
 * the same database are deliberately excluded by SEEDED.
 */
test.describe("catalogue baseline", () => {
  test("375 seeded products are stocked in both branches", async () => {
    const byBranch = await rows<{ branch: string; products: string; qty: string }>(
      `select b.name as branch, count(*) as products, sum(s.qty) as qty
         from stock s
         join branches b on b.id = s.branch_id
         join products p on p.id = s.product_id
        where ${SEEDED} and b.org_id = $1
        group by b.name order by b.name`,
      [ORG_ID],
    );

    expect(byBranch.map((r) => r.branch)).toEqual(["Mogappair East", "Mogappair West"]);
    for (const r of byBranch) {
      expect(num(r.products), `${r.branch} should hold every seeded product`).toBe(375);
      expect(num(r.qty), `${r.branch} should hold at least 375 x 10 units`).toBeGreaterThanOrEqual(3750);
    }
  });

  test("the category split matches the 50/50/50/50/50/25x5 brief", async () => {
    const split = await rows<{ kind: string; n: string }>(
      `select kind, count(*) as n from products p where ${SEEDED} group by kind order by kind`,
    );
    expect(Object.fromEntries(split.map((r) => [r.kind, num(r.n)]))).toEqual({
      accessory: 50,
      contact_lens: 125,
      frame: 100,
      sunglass: 100,
    });
  });

  test("every untouched seeded product still holds exactly its 10 GRN units", async () => {
    // Products this suite has previously received against are excluded so the
    // spec stays re-runnable; everything else must be exactly 10 per branch.
    const r = await one<{ n: string; mn: string; mx: string; branches: string }>(
      `with suite as (
         select distinct (jsonb_array_elements(lines) ->> 'product_id')::uuid as pid
           from purchase_orders
          where supplier_name like 'E2E PO Supplier%'
            and status in ('partially_received', 'received')
       )
       select count(*) as n, min(s.qty) as mn, max(s.qty) as mx, count(distinct s.branch_id) as branches
         from stock s
         join branches b on b.id = s.branch_id
         join products p on p.id = s.product_id
        where ${SEEDED} and b.org_id = $1 and s.product_id not in (select pid from suite)`,
      [ORG_ID],
    );
    expect(num(r!.branches)).toBe(2);
    expect(num(r!.n), "both branches stock every untouched product").toBeGreaterThanOrEqual(370 * 2);
    expect(num(r!.mn)).toBe(10);
    expect(num(r!.mx)).toBe(10);
  });

  test("the stock ledger reconciles with the stock table", async () => {
    const mismatches = await rows<{ branch: string; bad: string }>(
      `select b.name as branch, count(*) filter (where s.qty <> m.reconciled) as bad
         from stock s
         join branches b on b.id = s.branch_id
         cross join lateral (
           select coalesce(sum(sm.delta), 0)::int as reconciled
             from stock_movements sm
            where sm.product_id = s.product_id and sm.branch_id = s.branch_id
         ) m
        where b.org_id = $1
        group by b.name`,
      [ORG_ID],
    );
    for (const r of mismatches) expect(num(r.bad), `${r.branch} ledger drift`).toBe(0);
    expect(mismatches.length).toBe(2);
  });

  test("branch inventory valuation is populated", async () => {
    const val = await rows<{ branch: string; qty: string; value: string }>(
      `select b.name as branch, sum(s.qty) as qty, round(sum(s.qty * coalesce(pc.cost_price, 0)), 2) as value
         from stock s
         join branches b on b.id = s.branch_id
         join products p on p.id = s.product_id
         left join product_costs pc on pc.product_id = p.id and pc.org_id = p.org_id
        where ${SEEDED} and b.org_id = $1
        group by b.name order by b.name`,
      [ORG_ID],
    );
    expect(val).toHaveLength(2);
    for (const r of val) {
      expect(num(r.qty)).toBeGreaterThan(0);
      expect(num(r.value), `${r.branch} valuation`).toBeGreaterThan(0);
    }
    // Both branches carry the same catalogue, so the valuations only differ if
    // one branch has been short-received — they must be within a sane margin.
    const [east, west] = val;
    const drift = Math.abs(num(east.value) - num(west.value)) / Math.max(num(east.value), 1);
    expect(drift, "branch valuations have drifted apart").toBeLessThan(0.05);
  });

  test("no seeded product is missing from either branch", async () => {
    const missing = await rows<{ sku: string; branch: string }>(
      `select p.sku, b.name as branch
         from products p
         cross join branches b
        where ${SEEDED} and b.id in ('${BRANCH.east}', '${BRANCH.west}')
          and not exists (select 1 from stock s where s.product_id = p.id and s.branch_id = b.id)`,
    );
    expect(missing).toEqual([]);
  });
});
