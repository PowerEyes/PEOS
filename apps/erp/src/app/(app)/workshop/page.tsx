import { supabaseServer } from "@/lib/supabase/server";
import { WorkshopView } from "./view";
export default async function Page() {
  const { data } = await supabaseServer().from("lab_orders").select("*, customers(full_name, phone, whatsapp, vision_id), sales(code, grand_total, paid_total)")
    .not("status", "in", "(delivered,cancelled)").order("due_date", { ascending: true }).limit(500);
  return <WorkshopView labs={(data ?? []) as any} />;
}
