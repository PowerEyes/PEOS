// Shared Supabase service-role client for repo scripts (node scripts/*.mjs)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url + "/../../apps/erp/");
const { createClient } = require("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service-role environment is required");
export const sb = createClient(url, key, { auth: { persistSession: false } });
export const log = (...a) => console.log(...a);
