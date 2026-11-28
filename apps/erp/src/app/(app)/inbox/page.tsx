import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getScopeCtx } from "@/lib/branch-scope";
import { inr } from "@poweros/business-rules";

export const dynamic = "force-dynamic";
const Box = ({ title, n, href, children }: { title: string; n: number; href?: string; children: React.ReactNode }) => (
  <section className="card p-4"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">{title} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${n ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{n}</span></h2>{href && <Link href={href} className="text-xs underline">Open</Link>}</div>
    {n ? <ul className="divide-y text-sm">{children}</ul> : <p className="text-xs text-slate-400">All clear.</p>}</section>);
export default async function Inbox() {
  const sb = supabaseServer(), { scope, only } = await getScopeCtx(), today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const [tr, rep, ord, mism, unpaid, stk] = await Promise.all([
    sb.from("branch_transfers").select("id,qty,created_at,from_branch,to_branch,status").in("status", ["requested", "in_transit"]).order("created_at").limit(20),
    only(sb.from("repairs").select("id,code,item_model,due_date,status").in("status", ["pending", "in_progress"]).lt("due_date", today).order("due_date").limit(20)),
    only(sb.from("sales").select("id,code,grand_total,payment_status,status,created_at,customers(full_name)").eq("channel", "storefront").order("created_at", { ascending: false }).limit(15)),
    only(sb.from("sales").select("id,code,notes").ilike("notes", "%PAYMENT MISMATCH%").order("created_at", { ascending: false }).limit(10)),
    only(sb.from("sales").select("id,code,grand_total,paid_total,created_at").eq("kind", "order").neq("payment_status", "paid").lt("created_at", dayAgo).order("created_at").limit(10)),
    sb.from("stock").select("product_id,branch_id,qty,reorder_level,products(model,sku,brands(name))").gt("reorder_level", 0).limit(2000),
  ]);
  const { data: brs } = await sb.from("branches").select("id,name"); const bn = (id: string) => brs?.find((b: any) => b.id === id)?.name ?? "—";
  const T = (tr.data ?? []).filter((t: any) => !scope || t.from_branch === scope || t.to_branch === scope);
  const all = (stk.data ?? []) as any[];
  const low = all.filter((k) => k.qty <= k.reorder_level && (!scope || k.branch_id === scope)).sort((a, b) => a.qty - b.qty).slice(0, 15);
  const elsewhere = (k: any) => all.filter((o) => o.product_id === k.product_id && o.branch_id !== k.branch_id && o.qty > o.reorder_level).sort((a, b) => b.qty - a.qty)[0];
  return (<div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
    <div><h1 className="font-display text-2xl font-semibold">Inbox & alerts</h1><p className="text-sm text-slate-500">Things that need attention{scope ? " in this branch" : " across all branches"}.</p></div>
    <Box title="Low stock" n={low.length} href="/inventory">{low.map((k: any) => { const e = elsewhere(k); return <li key={k.product_id + k.branch_id} className="py-1.5">{k.products?.brands?.name ?? ""} {k.products?.model} · <b className={k.qty === 0 ? "text-rose-700" : "text-amber-700"}>{k.qty}</b>/{k.reorder_level} at {bn(k.branch_id)}{e && <span className="text-slate-500"> · {e.qty} spare at {bn(e.branch_id)} — <Link href="/transfers" className="underline">transfer</Link></span>}</li>; })}</Box>
    <Box title="Payment mismatches (online orders)" n={mism.data?.length ?? 0} href="/sales">{(mism.data ?? []).map((s: any) => <li key={s.id} className="py-1.5 text-rose-700">{s.code} — verify before dispatch</li>)}</Box>
    <Box title="Stock transfers awaiting action" n={T.length} href="/transfers">{T.map((t: any) => <li key={t.id} className="py-1.5">{bn(t.from_branch)} → {bn(t.to_branch)} · {t.qty} pcs · <span className="text-slate-500">{t.status === "requested" ? "needs approval" : "in transit"}</span></li>)}</Box>
    <Box title="Overdue repairs" n={rep.data?.length ?? 0} href="/repairs">{(rep.data ?? []).map((r: any) => <li key={r.id} className="py-1.5">{r.code} · {r.item_model ?? "item"} · due {r.due_date}</li>)}</Box>
    <Box title="Unpaid orders older than a day" n={unpaid.data?.length ?? 0} href="/sales">{(unpaid.data ?? []).map((s: any) => <li key={s.id} className="py-1.5">{s.code} · {inr(Math.round(Number(s.grand_total) - Number(s.paid_total || 0)))} due</li>)}</Box>
    <Box title="Latest website orders" n={ord.data?.length ?? 0} href="/sales">{(ord.data ?? []).map((s: any) => <li key={s.id} className="flex justify-between py-1.5"><span>{s.code} · {s.customers?.full_name ?? "Customer"}</span><span className="text-slate-500">{inr(Math.round(Number(s.grand_total)))} · {s.payment_status}</span></li>)}</Box>
  </div>);
}
