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
    
    // Delete in dependency order
    await client.query("DELETE FROM payments WHERE org_id = $1", [ORG_ID]);
    console.log('Deleted payments');
    
    await client.query("DELETE FROM cashbook WHERE org_id = $1", [ORG_ID]);
    console.log('Deleted cashbook');
    
    await client.query("DELETE FROM sale_lines WHERE org_id = $1", [ORG_ID]);
    console.log('Deleted sale_lines');
    
    await client.query("DELETE FROM lab_orders WHERE org_id = $1", [ORG_ID]);
    console.log('Deleted lab_orders');
    
    await client.query("DELETE FROM sales WHERE org_id = $1", [ORG_ID]);
    console.log('Deleted sales');
    
    // Reset stock to 1000 for all products in both branches
    await client.query("DELETE FROM stock WHERE org_id = $1", [ORG_ID]);
    console.log('Deleted stock');
    
    await client.query("DELETE FROM stock_movements WHERE org_id = $1 AND reason = 'sale'", [ORG_ID]);
    console.log('Deleted sale stock movements');
    
    // Reset counters
    await client.query("DELETE FROM counters WHERE org_id = $1 AND key = 'sale'", [ORG_ID]);
    console.log('Reset sale counter');
    
    // Verify
    const { rows: sales } = await client.query("SELECT count(*) as cnt FROM sales WHERE org_id = $1", [ORG_ID]);
    console.log(`\nRemaining sales: ${sales[0].cnt}`);
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { client.release(); await pool.end(); }
})();
