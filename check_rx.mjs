import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

const ORG_ID = 'aa4fd022-272b-4d96-80cc-9005ad7313ad';

(async () => {
  const client = await pool.connect();
  try {
    await client.query("SET row_security = off");
    
    // Check first 10 active prescriptions
    const { rows } = await client.query(
      "SELECT id, rx_code, customer_id, review_status, approved_by, approved_at FROM prescriptions WHERE org_id = $1 AND status = 'active' LIMIT 10",
      [ORG_ID]
    );
    console.log('First 10 active prescriptions:');
    rows.forEach(r => console.log(`  ${r.rx_code}: review_status=${r.review_status}, approved_by=${r.approved_by ? 'yes' : 'no'}, approved_at=${r.approved_at}`));
    
    // Check if all active prescriptions are approved
    const { rows: unapproved } = await client.query(
      "SELECT count(*) as cnt FROM prescriptions WHERE org_id = $1 AND status = 'active' AND (review_status IS DISTINCT FROM 'approved' OR approved_by IS NULL)",
      [ORG_ID]
    );
    console.log(`\nUnapproved active prescriptions: ${unapproved[0].cnt}`);
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { client.release(); await pool.end(); }
})();
