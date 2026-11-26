// Shared Supabase service-role client for repo scripts (node scripts/*.mjs)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url + "/../../apps/erp/");
const { createClient } = require("@supabase/supabase-js");
const url = "https://lnoagnobwrptbcdeshji.supabase.co";
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxub2Fnbm9id3JwdGJjZGVzaGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDYxMDI3NCwiZXhwIjoyMTA2MTg2Mjc0fQ.nSIaeVVSpkzn36MpiFrLEhvs0h0GEPT2-y5PMrGyCb4";
export const sb = createClient(url, key, { auth: { persistSession: false } });
export const log = (...a) => console.log(...a);
