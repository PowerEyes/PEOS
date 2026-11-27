import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
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
