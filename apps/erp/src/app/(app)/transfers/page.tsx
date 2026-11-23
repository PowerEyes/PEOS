import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { TransfersView } from "./view";
export default async function Page() {
  const sb = supabaseServer();
  const { only, scope } = await getScopeCtx();
  const [{ data: transfers }, { data: branches }, { data: products }] = await Promise.all([
    (scope ? sb.from("branch_transfers").select("*, products(model, brands(name))").or(`from_branch.eq.${scope},to_branch.eq.${scope}`) : sb.from("branch_transfers").select("*, products(model, brands(name))")).order("created_at", { ascending: false }).limit(100),
    sb.from("branches").select("id,name").eq("is_active", true).order("name"),
    sb.from("products").select("id,model").order("model").limit(1000),
  ]);
  const { data: { user } } = await sb.auth.getUser();
  return <TransfersView transfers={transfers ?? []} branches={branches ?? []} products={products ?? []} me={user?.id ?? ""} />;
}
