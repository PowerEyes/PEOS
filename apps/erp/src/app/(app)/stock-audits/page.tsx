import { redirect } from "next/navigation";
import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { StockAuditsView } from "./view";

export const dynamic = "force-dynamic";
export default async function StockAuditsPage() {
  const sb = supabaseServer(), { scope, only } = await getScopeCtx();
  const { data: { user } } = await sb.auth.getUser();
  const { data: allowed } = await sb.rpc("has_perm", { p: "stock_audit" });
  if (!allowed) redirect("/");
  const [{ data: sessions }, { data: branches }, { data: products }, { data: stock }] = await Promise.all([
    only(sb.from("stock_audit_sessions").select("id,title,status,branch_id,started_by,submitted_at,approved_at,created_at,stock_audit_lines(id,product_id,expected_qty,counted_qty,products(model,sku,barcode,brands(name)))")).order("created_at", { ascending: false }).limit(100),
    sb.from("branches").select("id,name").eq("is_active", true).order("name"),
    sb.from("products").select("id,model,sku,barcode,brands(name)").eq("status", "active").order("model").limit(3000),
    only(sb.from("stock").select("product_id,branch_id,qty")),
  ]);
  return <StockAuditsView sessions={(sessions ?? []) as any[]} branches={branches ?? []} products={(products ?? []) as any[]} stock={(stock ?? []) as any[]} scope={scope} currentUser={user?.id ?? ""} />;
}
