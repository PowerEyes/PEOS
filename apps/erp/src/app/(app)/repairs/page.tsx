import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { RepairsView } from "./view";
import { DataLoadError } from "@/components/DataLoadError";
export default async function Page({ searchParams }: { searchParams: { new?: string; customer?: string } }) {
  const sb = supabaseServer();
  const { only, scope } = await getScopeCtx();
  const [{ data: repairs, error: repairsError }, { data: customers, error: customersError }, { data: branches, error: branchesError }] = await Promise.all([
    only(sb.from("repairs").select("*, customers(full_name,phone,whatsapp,vision_id)")).order("created_at",{ascending:false}).limit(500),
    sb.from("customers").select("id,full_name,phone,vision_id").order("full_name").limit(1000),
    sb.from("branches").select("id,name").eq("is_active",true).order("name")]);
  if ([repairsError, customersError, branchesError].some(Boolean)) return <DataLoadError title="Repairs workspace could not be loaded" message="Repair, customer or branch information is unavailable. Retry before creating or advancing a repair." />;
  // ?new=1&customer=<id> deep link (Customer 360 → "New repair") opens the
  // intake form with that customer already selected.
  const openNew = !!searchParams.new;
  const initialCustomer = openNew ? (searchParams.customer ?? "") : "";
  return <RepairsView repairs={(repairs??[]) as any} customers={customers??[]} branches={branches??[]} openNew={openNew} initialCustomer={initialCustomer} />;
}
