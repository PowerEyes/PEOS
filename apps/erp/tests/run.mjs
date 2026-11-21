// Runs unit tests with Node's built-in TS stripping (no deps). Relative imports get ".ts" in a temp copy.
import { cpSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import { spawnSync } from "node:child_process";
const root = mkdtempSync(join(tmpdir(), "erp-test-")); cpSync("src/lib", join(root, "src/lib"), { recursive: true }); cpSync("tests", join(root, "tests"), { recursive: true });
for (const d of ["src/lib", "tests"]) for (const f of readdirSync(join(root, d), { recursive: true })) if (/\.(ts|mjs)$/.test(String(f))) {
  const p = join(root, d, String(f)); writeFileSync(p, readFileSync(p, "utf8").replace(/from "(\.[^"]*?)(?<!\.ts)"/g, (m, a) => `from "${a}.ts"`).replace(/from "(\.[^"]*)\.ts\.ts"/g, 'from "$1.ts"')); }
const files = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".test.mjs")).map((f) => join(root, "tests", f));
process.exit(spawnSync("node", ["--experimental-strip-types", "--test", ...files], { stdio: "inherit" }).status ?? 1);
