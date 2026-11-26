import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2, Clock, FileText, MapPin, MessageCircle, Palette, Receipt,
  Scale, ShieldCheck, SlidersHorizontal, Check, Circle,
} from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeDocuments } from "@/lib/company-profile";

export const dynamic = "force-dynamic";

// Plan §6 route map: every company-profile topic reachable under /company.
// Editors that already live in Settings are forwarded by /company/[section];
// documents, branding and policies are real pages here.
const TOPICS = [
  { key: "profile", label: "Profile", desc: "Company name, legal entity, timezone", icon: Building2 },
  { key: "legal", label: "Legal", desc: "Registered name & billing address", icon: Scale },
  { key: "gst", label: "GST", desc: "GSTIN, GST toggle, supply defaults", icon: Receipt },
  { key: "docs", label: "Documents", desc: "Licences, registrations & certificates", icon: FileText },
  { key: "branding", label: "Branding", desc: "Logo & brand colours", icon: Palette },
  { key: "contact", label: "Contact", desc: "Business email, phone, WhatsApp", icon: MessageCircle },
  { key: "address", label: "Address", desc: "Billing address & branch locations", icon: MapPin },
  { key: "hours", label: "Hours", desc: "Opening hours per branch", icon: Clock },
  { key: "preferences", label: "Preferences", desc: "Timezone, financial year & defaults", icon: SlidersHorizontal },
  { key: "policies", label: "Policies", desc: "Returns, warranty & privacy text", icon: ShieldCheck },
] as const;

const SETTINGS_KEYS = [
  "gstin", "whatsapp_number", "brand_logo_url",
  "company_documents", "policy_returns", "policy_warranty", "policy_privacy",
];

export default async function CompanyPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) return null;

  const [{ data: org }, { data: rows }, { data: branches }] = await Promise.all([
    sb.from("organizations")
      .select("name, legal_name, business_email, business_phone, billing_address, timezone")
      .eq("id", profile.org_id)
      .maybeSingle(),
    sb.from("org_settings").select("key, value").in("key", SETTINGS_KEYS),
    sb.from("branches").select("opening_hours"),
  ]);

  const map: Record<string, any> = {};
  for (const r of rows ?? []) map[r.key] = r.value;
  const docs = normalizeDocuments(map.company_documents);
  const policies = [map.policy_returns, map.policy_warranty, map.policy_privacy]
    .some((v: unknown) => typeof v === "string" && v.trim());

  const ready: Record<string, boolean> = {
    profile: !!org?.name,
    legal: !!(org?.legal_name && org?.billing_address),
    gst: typeof map.gstin === "string" && map.gstin.trim().length > 0,
    docs: !!docs && docs.length > 0,
    branding: typeof map.brand_logo_url === "string" && map.brand_logo_url.trim().length > 0,
    contact: !!(org?.business_email || org?.business_phone || map.whatsapp_number),
    address: !!org?.billing_address,
    hours: (branches ?? []).some((b) => b.opening_hours && Object.keys(b.opening_hours).length > 0),
    preferences: true,
    policies,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl sm:text-3xl font-semibold">
          <Building2 size={24} className="text-gold-500" /> Company
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Profile, documents and preferences for {org?.name ?? "your company"}
        </p>
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <span className="font-semibold text-navy-900">{org?.name ?? "—"}</span>
        {org?.legal_name && <span className="text-slate-500">{org.legal_name}</span>}
        {typeof map.gstin === "string" && map.gstin && (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">GSTIN {map.gstin}</span>
        )}
        {org?.timezone && <span className="text-slate-400">{org.timezone}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => {
          const done = ready[t.key];
          return (
            <Link
              key={t.key}
              href={`/company/${t.key}`}
              className="card flex flex-col gap-2 p-4 transition hover:border-navy-300 hover:shadow-sm"
            >
              <span className="flex items-center gap-2">
                <t.icon size={17} className="text-navy-700" />
                <span className="flex-1 text-sm font-semibold text-navy-900">{t.label}</span>
                {done ? <Check size={15} className="text-green-600" /> : <Circle size={14} className="text-slate-300" />}
              </span>
              <span className="text-xs text-slate-500">{t.desc}</span>
              <span className={`text-[11px] font-medium ${done ? "text-green-600" : "text-slate-400"}`}>
                {done ? "Configured" : "Set up"}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        Every change here is recorded in the audit log. Company data is never
        removed when a subscription expires — only edits are paused.
      </p>
    </div>
  );
}
