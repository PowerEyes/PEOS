import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { WorkshopView } from "./view";
export default async function Page() {
  const { only } = await getScopeCtx();
  const { data } = await only(supabaseServer().from("lab_orders").select("*, customers!lab_orders_customer_id_fkey(full_name, phone, whatsapp, vision_id), sales(code, grand_total, paid_total)"))
    .not("status", "in", "(delivered,cancelled)").order("due_date", { ascending: true }).limit(500);
  return <WorkshopView labs={(data ?? []) as any} />;
}
