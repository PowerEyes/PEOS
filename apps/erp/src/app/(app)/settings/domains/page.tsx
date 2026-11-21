import { supabaseServer } from "@/lib/supabase/server";
import { DomainsView } from "./view";
export default async function Page() {
  const { data } = await supabaseServer().from("org_domains").select("domain, created_at").order("created_at");
  return <DomainsView domains={data ?? []} />;
}
