import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { SetupWizard } from "./wizard";

export const dynamic = "force-dynamic";
export default async function Setup() {
  const sb = supabaseServer(),
    {
      data: { user },
    } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [
    { data: me },
    { data: org },
    { data: branches },
    { count: products },
    { count: staff },
    { data: stepRow },
    settings,
  ] = await Promise.all([
    sb.from("profiles").select("role_key,org_id").eq("id", user.id).single(),
    sb
      .from("organizations")
      .select(
        "id,name,legal_name,business_email,business_phone,billing_address,timezone,currency,financial_year_start_month",
      )
      .maybeSingle(),
    sb
      .from("branches")
      .select(
        "id,name,address,phone,email,udyam_no,code,image_path,image_alt,map_embed",
      )
      .eq("is_active", true)
      .order("name"),
    sb.from("products").select("id", { count: "exact", head: true }),
    sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", true),
    sb
      .from("org_settings")
      .select("value")
      .eq("key", "setup_wizard_step")
      .maybeSingle(),
    getSettings(),
  ]);
  if (!["owner", "admin"].includes(me?.role_key ?? "")) redirect("/");
  const complete =
    !!org?.name &&
    (branches ?? []).length > 0 &&
    (products ?? 0) > 0 &&
    (staff ?? 0) > 1 &&
    !!settings.whatsappNumber &&
    (!settings.gst || !!settings.gstin);
  return (
    <SetupWizard
      step={Number(stepRow?.value ?? 0)}
      settings={settings}
      orgName={org?.name ?? ""}
      organization={org ?? null}
      branches={branches ?? []}
      role={me?.role_key ?? "staff"}
      stats={{
        products: products ?? 0,
        staff: staff ?? 0,
        whatsapp: !!settings.whatsappNumber,
      }}
      ready={complete}
    />
  );
}
