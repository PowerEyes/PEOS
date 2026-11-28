import { supabaseServer } from "@/lib/supabase/server";
import { candidatesFor } from "./actions";
import { BankView } from "./view";
export const dynamic = "force-dynamic";
export default async function BankReconciliation({ searchParams }: { searchParams: { s?: string } }) {
  const s = ["unmatched", "matched", "ignored"].includes(searchParams.s ?? "") ? searchParams.s! : "unmatched";
  const sb = supabaseServer();
  const [{ data: lines }, ...counts] = await Promise.all([
    sb.from("bank_statement_lines").select("id,bank_label,txn_date,description,reference,debit,credit,status,matched_kind,note").eq("status", s).order("txn_date", { ascending: false }).limit(200),
    ...["unmatched", "matched", "ignored"].map(x => sb.from("bank_statement_lines").select("id", { count: "exact", head: true }).eq("status", x)),
  ]);
  const rows = lines ?? [], cands = s === "unmatched" ? await candidatesFor(rows as any) : rows.map(() => []);
  return <div className="mx-auto max-w-6xl space-y-4"><BankView status={s} counts={counts.map(c => c.count ?? 0)} rows={rows.map((r: any, i: number) => ({ ...r, cands: (cands[i] ?? []).slice(0, 3) }))} /></div>;
}
