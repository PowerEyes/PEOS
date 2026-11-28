import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: DATABASE_URL });

const tables = ['products', 'suppliers', 'stock', 'stock_movements', 'customers', 'prescriptions', 'brands', 'lens_packages', 'lens_options', 'product_costs'];

(async () => {
  const client = await pool.connect();
  try {
    for (const t of tables) {
      try {
        await client.query(`ALTER TABLE public.${t} DISABLE ROW LEVEL SECURITY`);
        console.log(`RLS disabled on ${t}`);
      } catch (e) {
        console.log(`Could not disable RLS on ${t}: ${e.message}`);
      }
    }
  } catch (e) { console.error('ERROR:', e.message); }
  finally { client.release(); await pool.end(); }
})();
