import { supabaseServer } from "@/lib/supabase/server";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";
import Link from "next/link";

export default async function SecuritySettingsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role_key, is_approved, deactivated").eq("id", user.id).maybeSingle();
  const role = profile?.role_key ?? "unknown";
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-navy-900">Security Settings</h1><p className="text-sm text-slate-500">Security status and configuration links</p></div>
      <ModuleKpiGrid items={[{label:"Your role",value:role.replace(/_/g," "),detail:"Current role assignment"},{label:"Account status",value:profile?.deactivated?"Inactive":profile?.is_approved?"Approved":"Pending",tone:profile?.deactivated?"danger":profile?.is_approved?"success":"warning",detail:"Profile approval status"},{label:"2FA",value:"Not verified here",tone:"warning",detail:"Authenticator enforcement needs validation"},{label:"Session controls",value:"Auth provider",detail:"Session management is handled by authentication"}]} />
      <div className="card p-5 space-y-4">
        <div><h2 className="font-semibold">Two-factor authentication</h2><p className="text-sm text-slate-500">This page does not currently enable or verify MFA. Use the identity provider's supported MFA enrollment flow; do not rely on the former inert Enable 2FA button.</p></div>
        <div className="border-t pt-4"><h2 className="font-semibold">Password and session security</h2><p className="text-sm text-slate-500">Password rules and session revocation should be verified in the Supabase Auth configuration and user session controls. No fake policy enforcement status is shown here.</p></div>
        <div className="border-t pt-4"><h2 className="font-semibold">Auditability</h2><p className="text-sm text-slate-500">Use the application audit log and platform security page for recorded administrative activity.</p><Link href="/platform/security" className="btn btn-outline mt-2 inline-flex">Platform security overview</Link></div>
      </div>
    </div>
  );
}
