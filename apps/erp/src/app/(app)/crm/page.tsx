
import { supabaseServer } from "@/lib/supabase/server";
import { CRMView } from "./view";
export const dynamic = "force-dynamic";
const ORG = "00000000-0000-0000-0000-000000000001";

export default async function CRMPage() {
  const sb = supabaseServer();
  const [settings, recentLogs, cronRuns, stats, tpls] = await Promise.all([
    sb.from("crm_settings").select("*").eq("org_id",ORG).single().then(r=>r.data),
    sb.from("whatsapp_log").select("id,phone,template,category,status,sent_at,error,customers(full_name)")
      .order("sent_at",{ascending:false}).limit(50).then(r=>r.data??[]),
    sb.from("cron_runs").select("*").order("started_at",{ascending:false}).limit(20).then(r=>r.data??[]),
    // Aggregate stats
    Promise.all([
      sb.from("whatsapp_log").select("id",{count:"exact",head:true}).eq("category","rx_expiry").eq("status","sent"),
      sb.from("whatsapp_log").select("id",{count:"exact",head:true}).eq("category","birthday").eq("status","sent"),
      sb.from("whatsapp_log").select("id",{count:"exact",head:true}).eq("category","order_update").eq("status","sent"),
      sb.from("whatsapp_log").select("id",{count:"exact",head:true}).eq("category","cart_recovery").eq("status","sent"),
      sb.from("whatsapp_log").select("id",{count:"exact",head:true}).eq("status","failed"),
      sb.from("prescriptions").select("id",{count:"exact",head:true}).lte("valid_till",new Date(Date.now()+30*86400000).toISOString().slice(0,10)).gte("valid_till",new Date().toISOString().slice(0,10)),
      sb.from("cart_items").select("id",{count:"exact",head:true}).is("notified_at",null),
    ]).then(([rx,bday,order,cart,fail,rxDue,abandoned]) => ({
      rxReminders:   rx.count ?? 0,
      birthdays:     bday.count ?? 0,
      orderUpdates:  order.count ?? 0,
      cartRecovery:  cart.count ?? 0,
      failed:        fail.count ?? 0,
      rxDueSoon:     rxDue.count ?? 0,
      abandonedCarts:abandoned.count ?? 0,
    })),
    sb.from("message_templates").select("meta_template,body_auto").then(r=>r.data??[]),
  ]);
  // Meta template name → current DB body, so log previews reflect settings edits
  const tplPreview: Record<string,string> = {};
  for (const t of tpls as any[]) if (t.meta_template && t.body_auto) tplPreview[t.meta_template] = t.body_auto;
  return <CRMView settings={settings} logs={recentLogs} cronRuns={cronRuns} stats={stats} tplPreview={tplPreview}/>;
}
