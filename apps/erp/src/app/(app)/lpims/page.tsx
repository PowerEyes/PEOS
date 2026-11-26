import { supabaseServer } from "@/lib/supabase/server";
import { LensPowerSearch } from "./search";

export const dynamic = "force-dynamic";
export default async function Lpims() {
  const sb = supabaseServer();
  const { data } = await sb.from("lens_packages").select("id,code,name,design,tier,status,base_price,min_sph,max_sph,min_cyl,max_cyl,min_add,max_add,available_indexes,included_coatings,min_age,max_age").order("display_order").limit(500);
  const rows = data ?? [];
  return (<div className="mx-auto max-w-5xl space-y-4">
    <div><h1 className="font-display text-2xl font-semibold">LPIMS — lens power search</h1><p className="text-sm text-slate-500">Enter a prescription to see which active lens packages can be made for it. Packages are managed in Inventory → Lens packages.</p></div>
    <LensPowerSearch packages={rows} />
  </div>);
}
