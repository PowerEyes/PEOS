import { readdir } from "node:fs/promises";
import { join } from "node:path";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(migrationsDir))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();

const seen = new Map();
for (const file of files) {
  const version = file.slice(0, file.indexOf("_"));
  const duplicate = seen.get(version);
  if (duplicate) {
    throw new Error(`Duplicate migration version ${version}: ${duplicate} and ${file}`);
  }
  seen.set(version, file);
}

if (files.length === 0) {
  throw new Error(`No migrations found in ${join(process.cwd(), "supabase", "migrations")}`);
}

console.log(`Validated ${files.length} unique migration versions.`);
