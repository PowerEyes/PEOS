import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AccountantExportView } from "./view";
export const dynamic = "force-dynamic";
export default async function AccountantExportPage() {
  const sb = supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) redirect("/login");
  const { data: allowed } = await sb.rpc("has_perm", { p: "finance_view" }); if (!allowed) redirect("/");
  const { data } = await sb.from("branches").select("id,name").eq("is_active", true).order("name");
  const branches = await Promise.all((data ?? []).map(async (b:any) => { const { data: can } = await sb.rpc("can_access_branch", { b: b.id }); return can ? b : null; }));
  const { data: p } = await sb.from("profiles").select("role_key").eq("id", user.id).maybeSingle();
  return <AccountantExportView branches={branches.filter(Boolean)} allowAll={["owner","admin"].includes(p?.role_key ?? "")} />;
}
