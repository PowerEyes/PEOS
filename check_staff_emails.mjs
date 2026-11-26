import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

const emails = [
  'nish.branch_manager@testoptics.com',
  'nish.staff@testoptics.com',
  'nish.optometrist@testoptics.com',
  'nish.sales_executive@testoptics.com',
  'nish.cashier@testoptics.com',
  'nish.inventory_manager@testoptics.com',
  'nish.lab_technician@testoptics.com',
  'nish.accountant@testoptics.com',
  'nish.receptionist@testoptics.com',
];

(async () => {
  try {
    for (const email of emails) {
      const { rows: users } = await pool.query(
        "SELECT id, email, email_confirmed_at, confirmed_at FROM auth.users WHERE email = $1",
        [email]
      );
      if (users.length > 0) {
        console.log(`${email}: id=${users[0].id}, confirmed_at=${users[0].confirmed_at || 'NULL'}`);
      } else {
        console.log(`${email}: NOT FOUND`);
      }
    }
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
