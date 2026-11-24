import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { PoliciesForm } from "../policies-form";

export const dynamic = "force-dynamic";

export default async function CompanyPoliciesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await sb
    .from("org_settings")
    .select("key, value")
    .in("key", ["policy_returns", "policy_warranty", "policy_privacy"]);
  const map: Record<string, any> = {};
  for (const r of rows ?? []) map[r.key] = r.value;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs text-slate-400">
          <Link href="/company" className="hover:text-navy-700">Company</Link> / Policies
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl sm:text-3xl font-semibold">
          <ShieldCheck size={24} className="text-gold-500" /> Policies
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Returns, warranty and patient-data policy texts for this company
        </p>
      </div>
      <PoliciesForm
        initial={{
          returns: str(map.policy_returns),
          warranty: str(map.policy_warranty),
          privacy: str(map.policy_privacy),
        }}
      />
    </div>
  );
}
