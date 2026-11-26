import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
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
