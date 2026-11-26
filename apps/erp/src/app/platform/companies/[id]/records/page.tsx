import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";
import { BreakGlassRequest, BreakGlassRevoke } from "./break-glass";

export const dynamic = "force-dynamic";

/**
 * The ONLY platform route that renders company-private records — and it refuses
 * to without an active break-glass grant (plan §10, criterion 5). The grant is
 * per-user, expires after 30 minutes, and the first view is written to
 * platform_audit_logs next to the grant reason.
 */
export default async function CompanyRecords({ params }: { params: { id: string } }) {
  const pu = await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: org }, { data: grant }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", params.id).maybeSingle(),
    admin.from("break_glass_grants").select("*")
      .eq("org_id", params.id).eq("platform_user_id", pu.user_id)
      .is("revoked_at", null).gt("expires_at", new Date().toISOString())
      .order("granted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!org) notFound();

  if (!grant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{org.name} — Private records</h1>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Customer records are company-private. Platform admins have no standing access — grant yourself a
          30-minute, reason-logged session to view them. Grants and views are written to the platform audit log
          and can be ended at any time.
        </div>
        <BreakGlassRequest orgId={params.id} />
      </div>
    );
  }

  // First view of this grant: stamp it and audit who looked, when and why.
  if (!grant.viewed_at) {
    await admin.from("break_glass_grants").update({ viewed_at: new Date().toISOString() }).eq("id", grant.id);
    await admin.from("platform_audit_logs").insert({
      actor_id: pu.user_id, action: "break_glass.viewed",
      target_type: "organization", target_id: params.id,
      metadata: { grant_id: grant.id, reason: grant.reason },
    });
  }

  const [{ data: customers }, { data: grants }] = await Promise.all([
    admin.from("customers")
      .select("id, customer_code, vision_id, full_name, phone, email, status, created_at")
      .eq("org_id", params.id).order("created_at", { ascending: false }).limit(50),
    admin.from("break_glass_grants")
      .select("id, platform_user_id, reason, granted_at, expires_at, viewed_at, revoked_at")
      .eq("org_id", params.id).order("granted_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{org.name} — Private records</h1>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
          break-glass · ends {new Date(grant.expires_at).toLocaleTimeString()}
        </span>
        <span className="ml-auto"><BreakGlassRevoke grantId={grant.id} orgId={params.id} /></span>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Viewing under: “{grant.reason}” — recorded in the platform audit log at {new Date(grant.granted_at).toLocaleString()}.
        This session ends automatically in 30 minutes.
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 text-xs text-slate-500">{c.customer_code || c.vision_id || "—"}</td>
                <td className="p-3">{c.full_name}</td>
                <td className="p-3 text-slate-500">{c.phone}</td>
                <td className="p-3 text-slate-500">{c.email || "—"}</td>
                <td className="p-3 capitalize text-slate-500">{c.status}</td>
                <td className="p-3 text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!customers || customers.length === 0) && (
          <p className="p-6 text-center text-sm text-slate-500">No customers for this company.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="mb-2 text-sm font-semibold">Recent break-glass grants for this company</p>
        <ul className="space-y-1 text-xs text-slate-400">
          {(grants ?? []).map((g: any) => (
            <li key={g.id} className="flex gap-3">
              <span className="text-slate-300">{new Date(g.granted_at).toLocaleString()}</span>
              <span className="truncate">{g.reason}</span>
              <span className="ml-auto shrink-0">
                {g.revoked_at ? "revoked" : new Date(g.expires_at) > new Date() ? "active" : "expired"}
                {g.viewed_at ? " · viewed" : " · never opened"}
              </span>
            </li>
          ))}
          {!(grants ?? []).length && <li className="text-slate-500">No grants recorded.</li>}
        </ul>
      </div>
    </div>
  );
}
