import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'product_costs' AND table_schema = 'public' ORDER BY ordinal_position`
    );
    console.log('product_costs columns:');
    rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | ${r.column_default ?? ''}`));
    
    // Check triggers on product_costs
    const { rows: trgs } = await pool.query(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'product_costs'::regclass`
    );
    console.log('Triggers on product_costs:');
    trgs.forEach(t => console.log(`  ${t.tgname}`));
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
