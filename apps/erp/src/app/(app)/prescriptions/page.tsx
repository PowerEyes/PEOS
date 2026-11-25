import { supabaseServer } from "@/lib/supabase/server";
import { RxView } from "./view";
import { DataLoadError } from "@/components/DataLoadError";
export default async function Page() {
  const sb = supabaseServer();
  const [{ data: rx, error: rxError }, { data: customers, error: customersError }] = await Promise.all([
    sb.from("prescriptions").select("*, customers(full_name, vision_id, customer_code, phone, whatsapp)").order("rx_date", { ascending: false }).limit(300),
    sb.from("customers").select("id, full_name, phone, vision_id").order("full_name").limit(1000)]);
  if (rxError || customersError) return <DataLoadError title="Prescription data could not be loaded" message="Prescription or customer records failed to load. Retry before creating or dispensing against incomplete data." />;
  return <RxView rows={(rx ?? []) as any} customers={(customers ?? []) as any} />;
}
