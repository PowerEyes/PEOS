// Elevated (service-role) clients. Service role bypasses RLS, so every call
// through these must be preceded by an explicit guard and must never be reachable
// from an unauthenticated or purely tenant-decided code path.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Platform Super Admin workspace + platform server actions.
 * Every call must be preceded by a platform-admin check (lib/platform-guard.ts).
 */
export function supabaseAdmin() {
  return serviceClient();
}

/**
 * Billing settlement only: subscription invoices and payments.
 *
 * Those tables are deliberately SELECT-only under RLS (20261201000000), so a
 * tenant session cannot forge an invoice or mark one paid. Callers must have
 * already (a) passed the owner/admin check and (b) verified a Razorpay
 * signature — this client exists to write what only a verified payment may write.
 */
export function supabaseBilling() {
  return serviceClient();
}
