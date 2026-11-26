import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

const tables = ['suppliers', 'products', 'stock', 'stock_movements', 'customers', 'prescriptions', 'sale_lines', 'payments', 'sales', 'lens_packages', 'lens_options', 'brands', 'organizations', 'branches', 'profiles'];

(async () => {
  try {
    for (const table of tables) {
      try {
        const { rows } = await pool.query(
          `SELECT column_name, data_type, is_nullable, column_default 
           FROM information_schema.columns 
           WHERE table_name = $1 AND table_schema = 'public'
           ORDER BY ordinal_position`,
          [table]
        );
        console.log(`\n=== ${table} ===`);
        rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | ${r.is_nullable} | ${r.column_default ?? ''}`));
      } catch (e) {
        console.log(`\n=== ${table} === ERROR: ${e.message}`);
      }
    }
    
    // Check Nish Optics org and branches
    const { rows: orgs } = await pool.query("SELECT id, name FROM organizations WHERE name = 'Nish Optics'");
    const { rows: branches } = await pool.query("SELECT id, code, name, org_id FROM branches WHERE org_id = $1 ORDER BY code", [orgs[0].id]);
    console.log('\n=== Nish Optics Branches ===');
    branches.forEach(b => console.log(`  ${b.code}: ${b.name} (id: ${b.id})`));
    
    // Check existing products/suppliers for Nish Optics
    const { rows: products } = await pool.query("SELECT count(*) as cnt FROM products WHERE org_id = $1", [orgs[0].id]);
    const { rows: suppliers } = await pool.query("SELECT count(*) as cnt FROM suppliers WHERE org_id = $1", [orgs[0].id]);
    const { rows: customers } = await pool.query("SELECT count(*) as cnt FROM customers WHERE org_id = $1", [orgs[0].id]);
    console.log(`\nExisting counts for Nish Optics:`);
    console.log(`  Products: ${products[0].cnt}`);
    console.log(`  Suppliers: ${suppliers[0].cnt}`);
    console.log(`  Customers: ${customers[0].cnt}`);
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
