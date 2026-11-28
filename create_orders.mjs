import { Pool } from 'pg';

if (process.env.ALLOW_RLS_OFF_SCRIPTS !== "1") {
  throw new Error("RLS-off diagnostics are retired; use an isolated staging database only.");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: DATABASE_URL });

const ORG_ID = 'aa4fd022-272b-4d96-80cc-9005ad7313ad';
const BRANCH_MAIN = '4055cd6f-c715-4a4a-88c7-be628d0166b1';
const BRANCH_WEST = 'ed1aa618-9046-4021-9f03-2f62630a1558';
const OWNER_UID = 'a8d9238e-2711-46ee-84bf-52f57ff08425';

async function nextCode(client, key, prefix) {
  const { rows } = await client.query(
    `SELECT public.next_code($1::uuid, $2::text, $3::text) as code`,
    [ORG_ID, key, prefix]
  );
  return rows[0].code;
}

const computeLine = (unit, qty, disc, taxPct) => {
  const tot = Math.round((unit * qty * (1 - disc / 100)) * 100) / 100;
  const taxable = taxPct > 0 ? Math.round((tot / (1 + taxPct / 100)) * 100) / 100 : tot;
  const taxAmt = tot - taxable;
  return { tot, taxable, taxAmt };
};

const insertSaleLine = async (client, saleId, lineNo, lineType, productId, lensPackageId, description, qty, unitPrice, discPct, taxPct, hsn, brandName, kind) => {
  const line = computeLine(unitPrice, qty, discPct, taxPct);
  const cgstPct = taxPct / 2;
  const sgstPct = taxPct / 2;
  const igstPct = 0;
  const cgstAmt = Math.round((line.taxAmt / 2) * 100) / 100;
  const sgstAmt = line.taxAmt - cgstAmt;
  const igstAmt = 0;
  await client.query(
    `INSERT INTO sale_lines (org_id, sale_id, line_no, line_type, product_id, lens_package_id, description, details, qty, unit_price, discount_pct, tax_pct, line_total, hsn, price_mode, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'inclusive', $15, $16, $17, $18, $19, $20, $21)`,
    [ORG_ID, saleId, lineNo, lineType, productId, lensPackageId, description, null, qty, unitPrice, discPct, taxPct, line.tot, hsn, line.taxable, cgstPct, cgstAmt, sgstPct, sgstAmt, igstPct, igstAmt]
  );
  return line.tot;
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query("SET row_security = off");
    await client.query(`SET auth.uid = '${OWNER_UID}'`);

    // Initialize counters
    await client.query(
      `INSERT INTO counters (org_id, key, value) VALUES 
       ($1, 'sale', 0)
       ON CONFLICT (org_id, key) DO NOTHING`,
      [ORG_ID]
    );

    // Get reference data
    const { rows: customers } = await client.query(
      "SELECT id FROM customers WHERE org_id = $1 LIMIT 10",
      [ORG_ID]
    );
    const { rows: prescriptions } = await client.query(
      "SELECT id, customer_id, valid_till, status FROM prescriptions WHERE org_id = $1 AND status = 'active' LIMIT 10",
      [ORG_ID]
    );
    const { rows: products } = await client.query(
      "SELECT id, kind, selling_price, tax_pct, hsn FROM products WHERE org_id = $1 AND status = 'active' LIMIT 100",
      [ORG_ID]
    );
    const { rows: lensPackages } = await client.query(
      "SELECT id, name, base_price, tax_pct FROM lens_packages WHERE org_id = $1 AND status = 'active' LIMIT 5",
      [ORG_ID]
    );

    if (customers.length === 0 || products.length === 0) {
      console.error('Missing customers or products');
      return;
    }

    const brandMap = new Map();
    const { rows: brands } = await client.query("SELECT id, name FROM brands WHERE org_id = $1", [ORG_ID]);
    brands.forEach(b => brandMap.set(b.id, b.name));

    let orderCount = 0;

    // Helper to insert a complete sale
    const createSale = async ({ cust, branch, kind, status, payStatus, rxId, lines, payAmount, payMethod, payRef, validUntil, needsLab = false }) => {
      const code = await nextCode(client, 'sale', kind === 'quotation' ? 'QT-' : 'ORD-');
      
      // Compute totals
      let grandTotal = 0, taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
      for (const l of lines) grandTotal += l.lineTotal;
      for (const l of lines) { taxableTotal += l.taxable; cgstTotal += l.cgstAmt; sgstTotal += l.sgstAmt; igstTotal += l.igstAmt; }

      const insertRes = await client.query(
        `INSERT INTO sales (org_id, branch_id, kind, customer_id, prescription_id, code, status, payment_status, subtotal, grand_total, paid_total, taxable_total, cgst_total, sgst_total, igst_total, needs_lab, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id, code`,
        [ORG_ID, branch, kind, cust, rxId, code, status, grandTotal, grandTotal, 0, taxableTotal, cgstTotal, sgstTotal, igstTotal, needsLab, validUntil]
      );
      const saleId = insertRes.rows[0].id;
      const saleCode = insertRes.rows[0].code;

      let lineNo = 0;
      for (const l of lines) {
        lineNo++;
        await insertSaleLine(client, saleId, lineNo, l.lineType, l.productId, l.lensPackageId, l.description, l.qty, l.unitPrice, l.discPct, l.taxPct, l.hsn, l.brandName, l.kind);
      }

      // Stock deduction for product orders
      if (kind === 'order') {
        for (const l of lines) {
          if (l.productId) {
            await client.query(
              `INSERT INTO stock_movements (org_id, branch_id, product_id, delta, reason, note) VALUES ($1, $2, $3, $4, 'sale', $5)`,
              [ORG_ID, branch, l.productId, -l.qty, code]
            );
          }
        }
      }

      // Payment
      if (kind === 'order' && payAmount > 0) {
        await client.query(
          `INSERT INTO payments (org_id, sale_id, amount, method, reference) VALUES ($1, $2, $3, $4, $5)`,
          [ORG_ID, saleId, payAmount, payMethod, payRef]
        );
      }

      // Lab orders for lens items with prescription
      if (kind === 'order' && needsLab && rxId) {
        const rx = await client.query("SELECT * FROM prescriptions WHERE id = $1", [rxId]);
        const r = rx.rows[0];
        const lensLine = lines.find(l => l.lineType === 'lens');
        if (lensLine) {
          await client.query(
            `INSERT INTO lab_orders (org_id, branch_id, sale_id, customer_id, lens_package_id, lens_desc, status, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, 'to_buy', $7)`,
            [ORG_ID, branch, saleId, cust, lensLine.lensPackageId, lensLine.description, new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
          );
        }
      }

      return { code: saleCode, id: saleId, grandTotal };
    };

    // ── Order 1: Draft order (frame only, unpaid) ──
    {
      const cust = customers[0].id;
      const frame = products.find(p => p.kind === 'frame');
      const lineTotal = Math.round(frame.selling_price * 100) / 100;
      const lines = [{
        lineType: 'product', productId: frame.id, lensPackageId: null,
        description: frame.kind, qty: 1, unitPrice: frame.selling_price, discPct: 0, taxPct: frame.tax_pct,
        hsn: frame.hsn, brandName: null, kind: frame.kind,
        lineTotal, taxable: lineTotal / (1 + frame.tax_pct / 100), cgstAmt: 0, sgstAmt: 0, igstAmt: 0
      }];
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'order', status: 'draft', payStatus: 'unpaid', rxId: null, lines, payAmount: 0, payMethod: 'cash', payRef: null });
      console.log('Order 1 (draft, unpaid, frame):', res.code);
      orderCount++;
    }

    // ── Order 2: Ready order (frame + accessory, paid) ──
    {
      const cust = customers[1].id;
      const frame = products.find(p => p.kind === 'frame');
      const acc = products.find(p => p.kind === 'accessory');
      const fLine = computeLine(frame.selling_price, 1, 0, frame.tax_pct);
      const aLine = computeLine(acc.selling_price, 2, 0, acc.tax_pct);
      const lines = [
        { lineType: 'product', productId: frame.id, lensPackageId: null, description: frame.kind, qty: 1, unitPrice: frame.selling_price, discPct: 0, taxPct: frame.tax_pct, hsn: frame.hsn, brandName: null, kind: frame.kind, lineTotal: fLine.tot, taxable: fLine.taxable, cgstAmt: fLine.taxAmt / 2, sgstAmt: fLine.taxAmt / 2, igstAmt: 0 },
        { lineType: 'product', productId: acc.id, lensPackageId: null, description: acc.kind, qty: 2, unitPrice: acc.selling_price, discPct: 0, taxPct: acc.tax_pct, hsn: acc.hsn, brandName: null, kind: acc.kind, lineTotal: aLine.tot, taxable: aLine.taxable, cgstAmt: aLine.taxAmt / 2, sgstAmt: aLine.taxAmt / 2, igstAmt: 0 }
      ];
      const grand = fLine.tot + aLine.tot;
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'order', status: 'ready', payStatus: 'paid', rxId: null, lines, payAmount: grand, payMethod: 'cash', payRef: 'PAY-001' });
      console.log('Order 2 (ready, paid, frame+accessory):', res.code);
      orderCount++;
    }

    // ── Order 3: Lab pending order (frame + lenses with prescription) ──
    {
      const cust = customers[2].id;
      const rx = prescriptions.find(p => p.customer_id === customers[2].id) || prescriptions[0];
      const frame = products.find(p => p.kind === 'frame');
      const pkg = lensPackages[0];
      const fLine = computeLine(frame.selling_price, 1, 0, frame.tax_pct);
      const pkgLine = computeLine(pkg.base_price, 1, 0, pkg.tax_pct);
      const lines = [
        { lineType: 'product', productId: frame.id, lensPackageId: null, description: frame.kind, qty: 1, unitPrice: frame.selling_price, discPct: 0, taxPct: frame.tax_pct, hsn: frame.hsn, brandName: null, kind: frame.kind, lineTotal: fLine.tot, taxable: fLine.taxable, cgstAmt: fLine.taxAmt / 2, sgstAmt: fLine.taxAmt / 2, igstAmt: 0 },
        { lineType: 'lens', productId: null, lensPackageId: pkg.id, description: pkg.name || ' lenses', qty: 1, unitPrice: pkg.base_price, discPct: 0, taxPct: pkg.tax_pct, hsn: '900150', brandName: null, kind: 'lens', lineTotal: pkgLine.tot, taxable: pkgLine.taxable, cgstAmt: pkgLine.taxAmt / 2, sgstAmt: pkgLine.taxAmt / 2, igstAmt: 0 }
      ];
      const grand = fLine.tot + pkgLine.tot;
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'order', status: 'lab_pending', payStatus: 'partial', rxId: rx.id, lines, payAmount: 3000, payMethod: 'upi', payRef: 'UPI-001', needsLab: true });
      console.log('Order 3 (lab_pending, partial, frame+lenses):', res.code);
      orderCount++;
    }

    // ── Order 4: Quotation (draft, unpaid) ──
    {
      const cust = customers[3].id;
      const prod = products.find(p => p.kind === 'sunglass');
      const line = computeLine(prod.selling_price, 1, 0, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 1, unitPrice: prod.selling_price, discPct: 0, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await createSale({ cust, branch: BRANCH_WEST, kind: 'quotation', status: 'draft', payStatus: 'unpaid', rxId: null, lines, payAmount: 0, payMethod: 'cash', payRef: null, validUntil });
      console.log('Order 4 (quotation, draft, unpaid):', res.code);
      orderCount++;
    }

    // ── Order 5: Delivered order (paid, contact lenses) ──
    {
      const cust = customers[4].id;
      const prod = products.find(p => p.kind === 'contact_lens');
      const line = computeLine(prod.selling_price, 3, 5, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 3, unitPrice: prod.selling_price, discPct: 5, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const res = await createSale({ cust, branch: BRANCH_WEST, kind: 'order', status: 'delivered', payStatus: 'paid', rxId: null, lines, payAmount: line.tot, payMethod: 'card', payRef: 'CARD-001' });
      console.log('Order 5 (delivered, paid, contact lenses):', res.code);
      orderCount++;
    }

    // ── Order 6: In workshop order (frame + lenses) ──
    {
      const cust = customers[5].id;
      const rx = prescriptions[1];
      const frame = products.find(p => p.kind === 'frame');
      const pkg = lensPackages[1];
      const fLine = computeLine(frame.selling_price, 1, 0, frame.tax_pct);
      const pkgLine = computeLine(pkg.base_price, 1, 0, pkg.tax_pct);
      const lines = [
        { lineType: 'product', productId: frame.id, lensPackageId: null, description: frame.kind, qty: 1, unitPrice: frame.selling_price, discPct: 0, taxPct: frame.tax_pct, hsn: frame.hsn, brandName: null, kind: frame.kind, lineTotal: fLine.tot, taxable: fLine.taxable, cgstAmt: fLine.taxAmt / 2, sgstAmt: fLine.taxAmt / 2, igstAmt: 0 },
        { lineType: 'lens', productId: null, lensPackageId: pkg.id, description: pkg.name || ' lenses', qty: 1, unitPrice: pkg.base_price, discPct: 0, taxPct: pkg.tax_pct, hsn: '900150', brandName: null, kind: 'lens', lineTotal: pkgLine.tot, taxable: pkgLine.taxable, cgstAmt: pkgLine.taxAmt / 2, sgstAmt: pkgLine.taxAmt / 2, igstAmt: 0 }
      ];
      const grand = fLine.tot + pkgLine.tot;
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'order', status: 'in_workshop', payStatus: 'partial', rxId: rx.id, lines, payAmount: 2000, payMethod: 'cash', payRef: null, needsLab: true });
      console.log('Order 6 (in_workshop, partial, frame+lenses):', res.code);
      orderCount++;
    }

    // ── Order 7: QC order (accessories, paid) ──
    {
      const cust = customers[6].id;
      const prod = products.find(p => p.kind === 'accessory');
      const line = computeLine(prod.selling_price, 5, 10, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 5, unitPrice: prod.selling_price, discPct: 10, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const res = await createSale({ cust, branch: BRANCH_WEST, kind: 'order', status: 'qc', payStatus: 'paid', rxId: null, lines, payAmount: line.tot, payMethod: 'cash', payRef: 'PAY-002' });
      console.log('Order 7 (qc, paid, accessories):', res.code);
      orderCount++;
    }

    // ── Order 8: Cancelled order (frame, unpaid) ──
    {
      const cust = customers[7].id;
      const prod = products.find(p => p.kind === 'frame');
      const line = computeLine(prod.selling_price, 1, 0, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 1, unitPrice: prod.selling_price, discPct: 0, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'order', status: 'cancelled', payStatus: 'unpaid', rxId: null, lines, payAmount: 0, payMethod: 'cash', payRef: null });
      console.log('Order 8 (cancelled, unpaid, frame):', res.code);
      orderCount++;
    }

    // ── Order 9: Sent quotation (sunglass, unpaid) ──
    {
      const cust = customers[8].id;
      const prod = products.find(p => p.kind === 'sunglass');
      const line = computeLine(prod.selling_price, 2, 0, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 2, unitPrice: prod.selling_price, discPct: 0, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await createSale({ cust, branch: BRANCH_WEST, kind: 'quotation', status: 'sent', payStatus: 'unpaid', rxId: null, lines, payAmount: 0, payMethod: 'cash', payRef: null, validUntil });
      console.log('Order 9 (quotation, sent, unpaid):', res.code);
      orderCount++;
    }

    // ── Order 10: Progressive lens order (lab pending, paid) ──
    {
      const cust = customers[9].id;
      const rx = prescriptions[2];
      const frame = products.find(p => p.kind === 'frame');
      const pkg = lensPackages[3]; // Progressive 1.60
      const fLine = computeLine(frame.selling_price, 1, 0, frame.tax_pct);
      const pkgLine = computeLine(pkg.base_price, 1, 0, pkg.tax_pct);
      const lines = [
        { lineType: 'product', productId: frame.id, lensPackageId: null, description: frame.kind, qty: 1, unitPrice: frame.selling_price, discPct: 0, taxPct: frame.tax_pct, hsn: frame.hsn, brandName: null, kind: frame.kind, lineTotal: fLine.tot, taxable: fLine.taxable, cgstAmt: fLine.taxAmt / 2, sgstAmt: fLine.taxAmt / 2, igstAmt: 0 },
        { lineType: 'lens', productId: null, lensPackageId: pkg.id, description: pkg.name || ' lenses', qty: 1, unitPrice: pkg.base_price, discPct: 0, taxPct: pkg.tax_pct, hsn: '900150', brandName: null, kind: 'lens', lineTotal: pkgLine.tot, taxable: pkgLine.taxable, cgstAmt: pkgLine.taxAmt / 2, sgstAmt: pkgLine.taxAmt / 2, igstAmt: 0 }
      ];
      const grand = fLine.tot + pkgLine.tot;
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'order', status: 'lab_pending', payStatus: 'paid', rxId: rx.id, lines, payAmount: grand, payMethod: 'card', payRef: 'CARD-002', needsLab: true });
      console.log('Order 10 (lab_pending, paid, progressive lenses):', res.code);
      orderCount++;
    }

    // ── Order 11: Rejected quotation (accessory, unpaid) ──
    {
      const cust = customers[0].id;
      const prod = products.find(p => p.kind === 'accessory');
      const line = computeLine(prod.selling_price, 10, 0, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 10, unitPrice: prod.selling_price, discPct: 0, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const res = await createSale({ cust, branch: BRANCH_MAIN, kind: 'quotation', status: 'rejected', payStatus: 'unpaid', rxId: null, lines, payAmount: 0, payMethod: 'cash', payRef: null });
      console.log('Order 11 (quotation, rejected, unpaid):', res.code);
      orderCount++;
    }

    // ── Order 12: Ready order (paid, sunglass) ──
    {
      const cust = customers[1].id;
      const prod = products.find(p => p.kind === 'sunglass');
      const line = computeLine(prod.selling_price, 1, 0, prod.tax_pct);
      const lines = [{
        lineType: 'product', productId: prod.id, lensPackageId: null, description: prod.kind, qty: 1, unitPrice: prod.selling_price, discPct: 0, taxPct: prod.tax_pct, hsn: prod.hsn, brandName: null, kind: prod.kind, lineTotal: line.tot, taxable: line.taxable, cgstAmt: line.taxAmt / 2, sgstAmt: line.taxAmt / 2, igstAmt: 0
      }];
      const res = await createSale({ cust, branch: BRANCH_WEST, kind: 'order', status: 'ready', payStatus: 'paid', rxId: null, lines, payAmount: line.tot, payMethod: 'cash', payRef: null });
      console.log('Order 12 (ready, paid, sunglass):', res.code);
      orderCount++;
    }

    console.log(`\n=== Created ${orderCount} test orders ===\n`);

    // Summary
    const { rows: orderSummary } = await client.query(
      `SELECT kind, status, payment_status, count(*) as cnt 
       FROM sales WHERE org_id = $1 
       GROUP BY kind, status, payment_status 
       ORDER BY kind, status, payment_status`,
      [ORG_ID]
    );
    console.log('Order breakdown:');
    orderSummary.forEach(r => console.log(`  ${r.kind.padEnd(10)} ${r.status.padEnd(15)} ${r.payment_status.padEnd(10)}: ${r.cnt}`));

    const { rows: labSummary } = await client.query(
      `SELECT status, count(*) as cnt FROM lab_orders WHERE org_id = $1 GROUP BY status ORDER BY status`,
      [ORG_ID]
    );
    console.log('\nLab order breakdown:');
    labSummary.forEach(r => console.log(`  ${r.status.padEnd(15)}: ${r.cnt}`));

  } catch (e) { console.error('FATAL ERROR:', e.message); console.error(e.stack); }
  finally { client.release(); await pool.end(); }
})();
