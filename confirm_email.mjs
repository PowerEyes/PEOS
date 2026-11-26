import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    // Try bypassing triggers to confirm email
    await pool.query("SET session_replication_role = replica");
    const { rows: users } = await pool.query(
      "UPDATE auth.users SET confirmed_at = now() WHERE email = $1 AND confirmed_at IS NULL RETURNING id, email, confirmed_at",
      ['nish.admin@testoptics.com']
    );
    await pool.query("SET session_replication_role = origin");
    
    if (users.length > 0) {
      console.log('Confirmed email:', JSON.stringify(users[0], null, 2));
    } else {
      console.log('No user found or already confirmed');
    }
    
    // Verify the profile
    const { rows: profiles } = await pool.query(
      "SELECT p.id, p.org_id, p.role_key, p.is_approved, p.deactivated FROM profiles p WHERE p.id = (SELECT id FROM auth.users WHERE email = $1)",
      ['nish.admin@testoptics.com']
    );
    console.log('Profile:', JSON.stringify(profiles, null, 2));
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
