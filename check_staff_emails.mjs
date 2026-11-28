import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
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
