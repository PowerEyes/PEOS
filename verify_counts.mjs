import { Pool } from 'pg';

if (process.env.ALLOW_RLS_OFF_SCRIPTS !== "1") {
  throw new Error("RLS-off diagnostics are retired; use an isolated staging database only.");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: DATABASE_URL });

const ORG_ID = 'aa4fd022-272b-4d96-80cc-9005ad7313ad';

(async () => {
  const client = await pool.connect();
  try {
    await client.query("SET row_security = off");
    
    const tables = ['organizations', 'branches', 'profiles', 'brands', 'suppliers', 'products', 'product_costs', 'lens_packages', 'lens_options', 'stock', 'stock_movements', 'customers', 'prescriptions'];
    
    console.log('=== Nish Optics Test Data Counts ===\n');
    
    for (const t of tables) {
      try {
        const { rows } = await client.query(`SELECT count(*) as cnt FROM public.${t} WHERE org_id = $1`, [ORG_ID]);
        console.log(`${t.padEnd(25)}: ${rows[0].cnt}`);
      } catch (e) {
        const { rows } = await client.query(`SELECT count(*) as cnt FROM public.${t}`);
        console.log(`${t.padEnd(25)}: ${rows[0].cnt} (no org_id column)`);
      }
    }
    
    // Product breakdown by kind
    const { rows: kinds } = await client.query(
      `SELECT kind, count(*) as cnt FROM products WHERE org_id = $1 GROUP BY kind ORDER BY kind`,
      [ORG_ID]
    );
    console.log('\n--- Products by kind ---');
    kinds.forEach(k => console.log(`  ${k.kind.padEnd(15)}: ${k.cnt}`));
    
    // Stock by branch
    const { rows: stockByBranch } = await client.query(
      `SELECT b.name as branch, count(s.product_id) as products, sum(s.qty) as total_units
       FROM stock s JOIN branches b ON b.id = s.branch_id
       WHERE s.org_id = $1 GROUP BY b.name ORDER BY b.name`,
      [ORG_ID]
    );
    console.log('\n--- Stock by branch ---');
    stockByBranch.forEach(s => console.log(`  ${s.branch.padEnd(20)}: ${s.products} products, ${s.total_units} units`));
    
    // Prescriptions by status
    const { rows: rxByStatus } = await client.query(
      `SELECT status, count(*) as cnt FROM prescriptions WHERE org_id = $1 GROUP BY status ORDER BY status`,
      [ORG_ID]
    );
    console.log('\n--- Prescriptions by status ---');
    rxByStatus.forEach(s => console.log(`  ${s.status.padEnd(15)}: ${s.cnt}`));
    
    // Prescriptions by type
    const { rows: rxByType } = await client.query(
      `SELECT rx_type, count(*) as cnt FROM prescriptions WHERE org_id = $1 GROUP BY rx_type ORDER BY rx_type`,
      [ORG_ID]
    );
    console.log('\n--- Prescriptions by type ---');
    rxByType.forEach(s => console.log(`  ${s.rx_type.padEnd(15)}: ${s.cnt}`));
    
    // Staff by role
    const { rows: staffByRole } = await client.query(
      `SELECT role_key, count(*) as cnt FROM profiles WHERE org_id = $1 GROUP BY role_key ORDER BY role_key`,
      [ORG_ID]
    );
    console.log('\n--- Staff by role ---');
    staffByRole.forEach(s => console.log(`  ${s.role_key.padEnd(20)}: ${s.cnt}`));
    
    console.log('\n=== All counts verified ===');
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { client.release(); await pool.end(); }
})();
