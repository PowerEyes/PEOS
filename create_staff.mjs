import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

const ORG_ID = 'aa4fd022-272b-4d96-80cc-9005ad7313ad';
const BRANCH_MAIN = '4055cd6f-c715-4a4a-88c7-be628d0166b1';
const BRANCH_WEST = 'ed1aa618-9046-4021-9f03-2f62630a1558';

const STAFF_ROLES = [
  { email: 'nish.branch_manager@testoptics.com', role: 'branch_manager', branch: BRANCH_MAIN, name: 'Nish Branch Manager' },
  { email: 'nish.staff@testoptics.com', role: 'staff', branch: BRANCH_WEST, name: 'Nish Staff' },
  { email: 'nish.optometrist@testoptics.com', role: 'optometrist', branch: BRANCH_MAIN, name: 'Nish Optometrist' },
  { email: 'nish.sales_executive@testoptics.com', role: 'sales_executive', branch: BRANCH_WEST, name: 'Nish Sales Executive' },
  { email: 'nish.cashier@testoptics.com', role: 'cashier', branch: BRANCH_MAIN, name: 'Nish Cashier' },
  { email: 'nish.inventory_manager@testoptics.com', role: 'inventory_manager', branch: BRANCH_WEST, name: 'Nish Inventory Manager' },
  { email: 'nish.lab_technician@testoptics.com', role: 'lab_technician', branch: BRANCH_MAIN, name: 'Nish Lab Technician' },
  { email: 'nish.accountant@testoptics.com', role: 'accountant', branch: BRANCH_WEST, name: 'Nish Accountant' },
  { email: 'nish.receptionist@testoptics.com', role: 'receptionist', branch: BRANCH_MAIN, name: 'Nish Receptionist' },
];

(async () => {
  try {
    for (const s of STAFF_ROLES) {
      const { rows: existing } = await pool.query(
        "SELECT id, email_confirmed_at FROM auth.users WHERE email = $1",
        [s.email]
      );
      
      let userId;
      if (existing.length > 0) {
        userId = existing[0].id;
        console.log(`Auth user exists for ${s.email}: ${userId} (confirmed=${!!existing[0].email_confirmed_at})`);
      } else {
        // INSERT with confirmed_at set (constraint may only block UPDATEs)
        const userMeta = JSON.stringify({ full_name: s.name, is_staff: true });
        const appMeta = JSON.stringify({ provider: "email", providers: ["email"] });
        const { rows: newUser } = await pool.query(
          `INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, confirmation_token
          ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            $1, crypt('TestPassword123!', gen_salt('bf')), now(),
            $2::jsonb, $3::jsonb,
            false, now(), now(), ''
          ) RETURNING id`,
          [s.email, userMeta, appMeta]
        );
        userId = newUser[0].id;
        console.log(`Created auth user for ${s.email}: ${userId} (confirmed=yes)`);
      }

      // Create or update profile
      const { rows: existingProfile } = await pool.query(
        "SELECT id FROM profiles WHERE id = $1",
        [userId]
      );
      
      if (existingProfile.length > 0) {
        await pool.query(
          `UPDATE profiles SET org_id = $1, role_key = $2, branch_id = $3, is_approved = true, deactivated = false, full_name = $4 WHERE id = $5`,
          [ORG_ID, s.role, s.branch, s.name, userId]
        );
        console.log(`Updated profile for ${s.email}: role=${s.role}, branch=${s.branch}`);
      } else {
        await pool.query(
          `INSERT INTO profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated, created_at)
           VALUES ($1, $2, $3, $4, $5, true, false, now())`,
          [userId, ORG_ID, s.name, s.role, s.branch]
        );
        console.log(`Created profile for ${s.email}: role=${s.role}, branch=${s.branch}`);
      }
    }
    
    console.log('\nAll staff processed!');
    
    // Verify
    const { rows: allStaff } = await pool.query(
      "SELECT p.full_name, p.role_key, p.is_approved, b.name as branch_name FROM profiles p LEFT JOIN branches b ON b.id = p.branch_id WHERE p.org_id = $1 ORDER BY p.role_key",
      [ORG_ID]
    );
    console.log('\nAll staff in Nish Optics:');
    allStaff.forEach(s => console.log(`  ${s.full_name} — ${s.role_key} — ${s.branch_name} — approved=${s.is_approved}`));
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
