import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { RegisterRepairForm } from "./register-form";

export const metadata = { title: "Register a Repair" };

export default async function RegisterRepairPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");
  const { data: c } = await sb.from("customers")
    .select("id, org_id, full_name, phone")
    .eq("auth_user_id", user.id).maybeSingle();
  if (!c) redirect("/my/login");

  const { data: branches } = await sb.from("branches")
    .select("id, name, address")
    .eq("is_active", true).order("name");

  return (
    <PortalLayout activePath="/my/repairs">
      <div className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-navy-800 text-white px-8 py-8 mb-6">
          <h1 className="font-extrabold text-3xl">REGISTER A REPAIR</h1>
          <p className="text-slate-300 mt-1">Tell us about your eyewear and we&apos;ll log a service ticket for you.</p>
          <div className="absolute right-8 top-5 text-5xl opacity-20">🛠️</div>
        </div>
        <RegisterRepairForm
          customerId={c.id}
          orgId={(c as any).org_id}
          branches={(branches ?? []) as any}
        />
      </div>
    </PortalLayout>
  );
}
