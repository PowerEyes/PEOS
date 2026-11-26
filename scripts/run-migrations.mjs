import { Client } from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("Connected to database");

  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, "utf8");
    try {
      await client.query(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      console.error(`❌ ${file}: ${err.message}`);
    }
  }

  // Run seed files
  const seedDir = join(process.cwd(), "supabase", "seed");
  const seedFiles = readdirSync(seedDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  console.log(`\nFound ${seedFiles.length} seed files`);

  for (const file of seedFiles) {
    const filePath = join(seedDir, file);
    const sql = readFileSync(filePath, "utf8");
    try {
      await client.query(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      console.error(`❌ ${file}: ${err.message}`);
    }
  }

  await client.end();
  console.log("\nDone!");
}

main().catch(console.error);