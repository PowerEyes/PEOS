import { supabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { SettingsPage } from "./view";

export default async function Page() {
  const sb = supabaseServer();
  const [settings, { data: branches }, { data: org }, { data: loyalty }, { data: templates }, { data: { user } }] = await Promise.all([
    getSettings(),
    sb.from("branches").select("id, name, address, phone, email, udyam_no, code, image_path, image_alt, map_embed").order("name"),
    sb.from("organizations").select("name").limit(1).maybeSingle(),
    sb.from("loyalty_rules").select("*").maybeSingle(),
    sb.from("message_templates").select("*").order("sort_order"),
    sb.auth.getUser(),
  ]);
  const { data: profile } = await sb.from("profiles").select("role_key").eq("id", user!.id).single();
  return (
    <SettingsPage
      settings={settings}
      orgName={org?.name ?? ""}
      branches={branches ?? []}
      loyalty={loyalty ?? null}
      templates={templates ?? []}
      role={profile?.role_key ?? "staff"}
    />
  );
}
