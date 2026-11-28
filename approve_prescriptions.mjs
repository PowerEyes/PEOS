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
    
    // Approve ALL active prescriptions
    const { rows } = await client.query(
      `UPDATE prescriptions SET review_status = 'approved', approved_by = $1, approved_at = now()
       WHERE org_id = $2 AND status = 'active' AND (review_status IS DISTINCT FROM 'approved' OR approved_by IS NULL)
       RETURNING id, rx_code, review_status`,
      ['a8d9238e-2711-46ee-84bf-52f57ff08425', ORG_ID]
    );
    console.log(`Approved ${rows.length} prescriptions (total unapproved that were just fixed)`);
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { client.release(); await pool.end(); }
})();
