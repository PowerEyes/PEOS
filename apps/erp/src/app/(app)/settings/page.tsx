import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { SettingsPage } from "./view";

export default async function Page({searchParams}:{searchParams?:{section?:string}}) {
  const sb = supabaseServer();
  const [settings, { data: branches }, { data: org }, { data: loyalty }, { data: templates }, { data: { user } }, {data:audit}] = await Promise.all([
    getSettings(),
    sb.from("branches").select("id,org_id,code,name,address,phone,email,udyam_no,is_active,image_path,image_alt,map_embed,legal_name,gstin,timezone,opening_hours,invoice_terms,is_default_pickup").order("name"),
    sb.from("organizations").select("id,name,legal_name,business_email,business_phone,billing_address,timezone,currency,financial_year_start_month").limit(1).maybeSingle(),
    sb.from("loyalty_rules").select("*").maybeSingle(),
    sb.from("message_templates").select("*").order("sort_order"),
    sb.auth.getUser(),
    sb.from("audit_log").select("id,table_name,action,old_data,new_data,at,user_id").in("table_name",["org_settings","organizations","branches","message_templates","loyalty_rules","org_domains"]).order("at",{ascending:false}).limit(100),
  ]);
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("role_key").eq("id", user.id).single();
  return (
    <SettingsPage
      settings={settings}
      orgName={org?.name ?? ""}
      organization={org ?? null}
      branches={branches ?? []}
      loyalty={loyalty ?? null}
      templates={templates ?? []}
      audit={audit ?? []}
      role={profile?.role_key ?? "staff"}
      initialSection={searchParams?.section ?? "business"}
    />
  );
}
