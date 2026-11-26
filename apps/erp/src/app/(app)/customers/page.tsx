import { supabaseServer } from "@/lib/supabase/server";
import { CustomersView } from "./view";
export default async function Page() {
  const { data } = await supabaseServer().from("customers").select("*").order("created_at", { ascending: false }).limit(300);
  return <CustomersView initial={(data ?? []) as any} />;
}
