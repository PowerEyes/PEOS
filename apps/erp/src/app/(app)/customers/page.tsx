import { supabaseServer } from "@/lib/supabase/server";
import { CustomersView } from "./view";
import { DataLoadError } from "@/components/DataLoadError";
export default async function Page() {
  const { data, error } = await supabaseServer().from("customers").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) return <DataLoadError title="Customers could not be loaded" message="The customer list failed to load. Check your connection and permissions, then retry." />;
  return <CustomersView initial={(data ?? []) as any} />;
}
