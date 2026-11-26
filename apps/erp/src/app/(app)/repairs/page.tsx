import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { RepairsView } from "./view";
export default async function Page({ searchParams }: { searchParams: { new?: string; customer?: string } }) {
  const sb = supabaseServer();
  const { only, scope } = await getScopeCtx();
  const [{ data: repairs }, { data: customers }, { data: branches }] = await Promise.all([
    only(sb.from("repairs").select("*, customers(full_name,phone,whatsapp,vision_id)")).order("created_at",{ascending:false}).limit(500),
    sb.from("customers").select("id,full_name,phone,vision_id").order("full_name").limit(1000),
    sb.from("branches").select("id,name").eq("is_active",true).order("name")]);
  // ?new=1&customer=<id> deep link (Customer 360 → "New repair") opens the
  // intake form with that customer already selected.
  const openNew = !!searchParams.new;
  const initialCustomer = openNew ? (searchParams.customer ?? "") : "";
  return <RepairsView repairs={(repairs??[]) as any} customers={customers??[]} branches={branches??[]} openNew={openNew} initialCustomer={initialCustomer} />;
}
