import { supabaseServer } from "@/lib/supabase/server";
import { SuppliersView } from "./view";
export const dynamic = "force-dynamic";
export default async function Suppliers() {
  const { data } = await supabaseServer().from("suppliers").select("id,name,contact_person,phone,email,gstin,address,state,status").order("name");
  return <div className="mx-auto max-w-6xl space-y-4"><SuppliersView rows={data ?? []} /></div>;
}
