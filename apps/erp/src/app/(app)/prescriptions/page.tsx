import { supabaseServer } from "@/lib/supabase/server";
import { RxView } from "./view";
export default async function Page() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const [{ data: rx }, { data: customers }] = await Promise.all([
    sb.from("prescriptions").select("*, customers(full_name, vision_id, customer_code, phone, whatsapp)").order("rx_date", { ascending: false }).limit(300),
    sb.from("customers").select("id, full_name, phone, vision_id").order("full_name").limit(1000),
  ]);
  const { data: profile } = user
    ? await sb.from("profiles").select("role_key").eq("id", user.id).maybeSingle()
    : { data: null };
  const canReview = ["owner", "admin", "optometrist"].includes(profile?.role_key ?? "");
  return <RxView rows={(rx ?? []) as any} customers={(customers ?? []) as any} canReview={canReview} />;
}
