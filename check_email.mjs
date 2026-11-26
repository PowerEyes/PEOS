import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    // Check email confirmation for nish.admin@testoptics.com
    const { rows: users } = await pool.query(
      "SELECT id, email, email_confirmed_at, confirmed_at FROM auth.users WHERE email = 'nish.admin@testoptics.com'"
    );
    console.log('Auth users for nish.admin@testoptics.com:');
    users.forEach(u => console.log(`  id=${u.id} email=${u.email} confirmed_at=${u.email_confirmed_at}`));
    
    // Check email confirmation for nish.owner@testoptics.com
    const { rows: users2 } = await pool.query(
      "SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'nish.owner@testoptics.com'"
    );
    console.log('Auth users for nish.owner@testoptics.com:');
    users2.forEach(u => console.log(`  id=${u.id} email=${u.email} confirmed_at=${u.email_confirmed_at}`));
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
