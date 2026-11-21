"use server";
import { supabaseServer } from "@/lib/supabase/server";
// Every data export (CSV/GST) is recorded in the append-only audit log.
export async function logExport(kind: string, rows: number) {
  try { await supabaseServer().rpc("log_export", { p_kind: kind.slice(0, 60), p_rows: rows, p_detail: {} }); } catch {}
}
