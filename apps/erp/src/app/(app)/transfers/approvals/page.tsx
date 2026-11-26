import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ActBtn } from "@/components/ActBtn";
import { approveTransfer, closeTransfer } from "../actions";

export const dynamic = "force-dynamic";
export default async function Approvals() {
  const sb = supabaseServer();
  const [{ data: tr }, { data: brs }, { data: u }] = await Promise.all([
    sb.from("branch_transfers").select("id,qty,note,created_at,from_branch,to_branch,requested_by,products(model,sku,brands(name))").eq("status", "requested").order("created_at"),
    sb.from("branches").select("id,name"), sb.auth.getUser()]);
  const bn = (id: string) => brs?.find((b: any) => b.id === id)?.name ?? "—";
  return (<div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
    <div className="flex items-end justify-between"><div><h1 className="font-display text-2xl font-semibold">Transfer approvals</h1><p className="text-sm text-slate-500">Requests waiting for the sending branch. Approving deducts stock and puts it in transit.</p></div><Link href="/transfers" className="text-sm underline">All transfers</Link></div>
    {!(tr ?? []).length && <p className="card p-4 text-sm text-slate-500">No transfers waiting.</p>}
    {(tr ?? []).map((t: any) => (<div key={t.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="min-w-0 flex-1"><p className="font-medium">{t.products?.brands?.name ?? ""} {t.products?.model} <span className="text-slate-400">{t.products?.sku}</span> × {t.qty}</p>
        <p className="text-xs text-slate-500">{bn(t.from_branch)} → {bn(t.to_branch)}{t.note ? ` · ${t.note}` : ""}{t.requested_by === u.user?.id ? " · your request" : ""}</p></div>
      <ActBtn action={approveTransfer.bind(null, t.id)} label="Approve" /><ActBtn action={closeTransfer.bind(null, t.id)} label="Reject" tone="ghost" confirm="Reject this transfer request?" /></div>))}
  </div>);
}
