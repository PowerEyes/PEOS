
import { supabaseServer } from "@/lib/supabase/server";
import { CouponsView } from "./view";

export const dynamic = "force-dynamic";
export default async function CouponsPage() {
  const { data } = await supabaseServer().from("coupons")
    .select("*").order("created_at",{ascending:false});
  return <CouponsView coupons={data ?? []}/>;
}
