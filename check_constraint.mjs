import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    const { rows: cons } = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'auth.users'::regclass
    `);
    console.log('Constraints on auth.users:');
    cons.forEach(c => console.log(`  ${c.conname} (${c.contype}): ${c.def}`));
    
    const { rows: trgs } = await pool.query(`
      SELECT tgname, tgenabled
      FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass
    `);
    console.log('Triggers on auth.users:');
    trgs.forEach(t => console.log(`  ${t.tgname} (enabled=${t.tgenabled})`));
    
  } catch (e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
