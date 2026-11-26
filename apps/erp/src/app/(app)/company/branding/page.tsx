import Link from "next/link";
import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { BrandingForm } from "../branding-form";

export const dynamic = "force-dynamic";

const DEFAULT_BRAND = { logo_url: "", primary: "#0A2240", accent: "#C48A3F" };

export default async function CompanyBrandingPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) return null;

  const [{ data: org }, { data: rows }] = await Promise.all([
    sb.from("organizations").select("name").eq("id", profile.org_id).maybeSingle(),
    sb.from("org_settings")
      .select("key, value")
      .in("key", ["brand_logo_url", "brand_primary", "brand_accent"]),
  ]);
  const map: Record<string, any> = {};
  for (const r of rows ?? []) map[r.key] = r.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs text-slate-400">
          <Link href="/company" className="hover:text-navy-700">Company</Link> / Branding
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl sm:text-3xl font-semibold">
          <Palette size={24} className="text-gold-500" /> Branding
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Logo and colours used across your company&apos;s documents
        </p>
      </div>
      <BrandingForm
        orgName={org?.name ?? ""}
        initial={{
          logo_url: typeof map.brand_logo_url === "string" ? map.brand_logo_url : DEFAULT_BRAND.logo_url,
          primary: typeof map.brand_primary === "string" && map.brand_primary ? map.brand_primary : DEFAULT_BRAND.primary,
          accent: typeof map.brand_accent === "string" && map.brand_accent ? map.brand_accent : DEFAULT_BRAND.accent,
        }}
      />
    </div>
  );
}
