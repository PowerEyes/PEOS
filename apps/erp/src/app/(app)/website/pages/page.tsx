import { supabaseServer } from "@/lib/supabase/server";
import { PagesStudio } from "./view";
export default async function Page() {
  const { data } = await supabaseServer().from("site_pages").select("*").order("display_order");
  return <PagesStudio rows={data ?? []} />;
}
