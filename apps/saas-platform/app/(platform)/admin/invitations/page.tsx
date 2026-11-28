import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import InvitationActions from "./invitation-actions";

export const dynamic = "force-dynamic";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) : "—";

export default async function InvitationsPage() {
  const admin = createAdminClient();
  const { data: invitations } = await admin
    .from("platform_invitations")
    .select("id,email,role,invited_by_name,status,expires_at,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">
            Platform Staff Invitations
          </h1>
          <p className="text-slate-600">
            Invite platform administrators and support staff
          </p>
        </div>
        <Link
          href="/admin/invitations/new"
          className="bg-navy-900 hover:bg-navy-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          + Invite Staff
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {["Email", "Role", "Invited By", "Status", "Expires", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 pb-3 text-navy-700 font-medium"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {(invitations || []).map((inv) => (
              <tr key={inv.id} className="border-b border-slate-200">
                <td className="px-4 py-3 font-medium text-navy-900">
                  {inv.email}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                    {inv.role}
                  </span>
                </td>
                <td className="px-4 py-3">{inv.invited_by_name || "System"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3">{fmt(inv.expires_at)}</td>
                <td className="px-4 py-3">
                  <InvitationActions id={inv.id} status={inv.status} />
                </td>
              </tr>
            ))}
            {(invitations || []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  No invitations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
