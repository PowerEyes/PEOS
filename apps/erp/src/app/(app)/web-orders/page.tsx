import { supabaseServer } from "@/lib/supabase/server";
import { getScopeCtx } from "@/lib/branch-scope";
import { inr } from "@poweros/business-rules";
import { ActBtn } from "@/components/ActBtn";
import { advanceWebOrder } from "./actions";
import { ModuleKpiGrid, KPIIcons } from "@/components/ModuleKpiGrid";
import { DataLoadError } from "@/components/DataLoadError";

export const dynamic = "force-dynamic";
const COLS = [["lab_pending", "New / lab pending", "in_workshop", "Start workshop"], ["in_workshop", "In workshop", "qc", "Send to QC"], ["qc", "Quality check", "ready", "Mark ready"], ["ready", "Ready for dispatch / pickup", "delivered", "Mark delivered"]] as const;
export default async function WebOrders() {
  const sb = supabaseServer(), { only } = await getScopeCtx();
  const { data: pays, error: payError } = await sb.from("online_payments").select("sale_id").not("sale_id", "is", null).order("created_at", { ascending: false }).limit(200);
  const ids = [...new Set((pays ?? []).map((x: any) => x.sale_id))];
  const { data } = ids.length ? await only(sb.from("sales").select("id,code,status,grand_total,payment_status,created_at,notes,needs_lab,branch_id,customers(full_name,phone)").in("id", ids).in("status", ["lab_pending", "in_workshop", "qc", "ready"]).order("created_at")) : { data: [] as any[] };
  const { data: brs, error: branchError } = await sb.from("branches").select("id,name"); const bn = (id: string) => brs?.find((b: any) => b.id === id)?.name ?? "";
  if (payError || (ids.length && data === null) || branchError) return <DataLoadError title="Website fulfilment queue could not be loaded" message="Payment, order or branch data is unavailable. Retry before progressing fulfilment." />;
  const allOrders=data??[]; const mismatch=allOrders.filter((o:any)=>/PAYMENT MISMATCH/.test(o.notes??"")).length;
  const totalValue=allOrders.reduce((n:number,o:any)=>n+Number(o.grand_total||0),0);
  return (<div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
    <div><h1 className="font-display text-2xl font-semibold">Website orders</h1><p className="text-sm text-slate-500">Paid online orders still to be fulfilled. Delivered orders leave this queue.</p></div>
    <ModuleKpiGrid items={[{label:"Orders in fulfilment",value:allOrders.length,detail:"Paid website orders in active stages",icon:KPIIcons.package},{label:"Order value",value:inr(totalValue),detail:"Value of active fulfilment queue",icon:KPIIcons.money},{label:"Payment mismatch alerts",value:mismatch,detail:"Must be verified before dispatch",tone:mismatch?"danger":"success",icon:KPIIcons.warning},{label:"Ready to dispatch",value:allOrders.filter((o:any)=>o.status==="ready").length,detail:"Awaiting dispatch or pickup",tone:"success",icon:KPIIcons.check}]} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{COLS.map(([st, title, next, btn]) => { const list = (data ?? []).filter((o: any) => o.status === st);
      return (<section key={st} className="card space-y-2 p-3"><h2 className="text-sm font-semibold">{title} <span className="text-xs text-slate-400">{list.length}</span></h2>
        {!list.length && <p className="text-xs text-slate-400">Nothing here.</p>}
        {list.map((o: any) => (<div key={o.id} className={`space-y-1 rounded-lg border p-2 text-sm ${/PAYMENT MISMATCH/.test(o.notes ?? "") ? "border-rose-300 bg-rose-50" : ""}`}>
          <div className="flex justify-between"><b>{o.code}</b><span>{inr(Math.round(Number(o.grand_total)))}</span></div>
          <p className="text-xs text-slate-500">{o.customers?.full_name ?? "Customer"}{o.customers?.phone ? ` · ${o.customers.phone}` : ""} · {bn(o.branch_id)}</p>
          {/PAYMENT MISMATCH/.test(o.notes ?? "") && <p className="text-xs font-medium text-rose-700">Payment mismatch — verify before dispatch</p>}
          <div className="flex justify-end"><ActBtn action={advanceWebOrder.bind(null, o.id, next)} label={btn} /></div></div>))}</section>); })}</div>
  </div>);
}
