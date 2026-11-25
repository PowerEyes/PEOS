import { supabaseServer } from "@/lib/supabase/server";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";

export default async function BackupSettingsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("org_id, role_key").eq("id", user.id).maybeSingle();
  const { count: branchCount } = await sb.from("branches").select("id",{count:"exact",head:true}).eq("org_id",profile?.org_id ?? "00000000-0000-0000-0000-000000000000");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-navy-900">Backup & Recovery</h1><p className="text-sm text-slate-500">Backup evidence, export readiness and recovery verification</p></div>
      <ModuleKpiGrid items={[{label:"Organization",value:profile?.org_id?"Linked":"Unlinked",tone:profile?.org_id?"success":"warning",detail:"Current account tenant"},{label:"Branch records",value:branchCount ?? 0,detail:"Visible organization branches"},{label:"Backup status",value:"Not verified",tone:"warning",detail:"No backup telemetry connected"},{label:"Restore test",value:"Not recorded",tone:"warning",detail:"No restore verification evidence"}]} />
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-semibold">Backup status cannot be confirmed from the application</h2>
        <p className="mt-1 text-sm">The former page displayed a fixed "Enabled", "Today 3:00 AM" and "30 days" status. Those values were not backed by live backup telemetry and have been removed. Verify database backup schedule, retention, PITR availability and a tested restore with your hosting provider.</p>
      </div>
      <div className="card p-5"><h2 className="font-semibold">Recovery checklist</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600"><li>Confirm automated backups are enabled for the production database.</li><li>Confirm point-in-time recovery and retention period.</li><li>Confirm backup encryption and restricted access.</li><li>Record last successful restore test and recovery time.</li><li>Document the responsible owner and escalation contact.</li></ul></div>
    </div>
  );
}
