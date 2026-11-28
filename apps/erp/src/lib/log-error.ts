import { supabaseAdmin } from "@/lib/supabase/admin";
/** Server-side error reporting into error_logs. Never throws. */
export async function logServerError(where: string, e: unknown, orgId?: string | null) {
  try {
    const err = e as any;
    console.error(`[${where}]`, err?.message ?? e);
    await supabaseAdmin().from("error_logs").insert({ org_id: orgId ?? null, app: "erp", message: String(err?.message ?? e).slice(0, 500), stack: String(err?.stack ?? "").slice(0, 3000) || null, path: where.slice(0, 200) });
  } catch { /* logging must never break a request */ }
}
