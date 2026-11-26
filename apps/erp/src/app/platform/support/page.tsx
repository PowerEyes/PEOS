import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";
import { AnnouncementPanel } from "./announcement-panel";

export const dynamic = "force-dynamic";

export default async function PlatformSupport() {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: announcements }, { data: tickets }, { data: orgs }] = await Promise.all([
    admin.from("announcements").select("*").order("published_at", { ascending: false }).limit(50),
    admin.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("organizations").select("id, name"),
  ]);
  const orgName = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Support & announcements</h2>
        <p className="text-sm text-slate-400">Company support tickets and platform-wide announcements.</p>
      </div>
      <div className="rounded-xl border border-slate-800 p-4">
        <p className="mb-3 text-sm font-semibold">Support tickets</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Company</th><th>Subject</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {(tickets ?? []).map((t: any) => (
              <tr key={t.id}><td className="py-2">{orgName.get(t.org_id) ?? "—"}</td><td>{t.subject}</td><td className="capitalize text-slate-400">{t.priority}</td><td className="capitalize text-slate-400">{t.status}</td></tr>
            ))}
            {!(tickets ?? []).length && <tr><td colSpan={4} className="py-3 text-slate-500">No tickets.</td></tr>}
          </tbody>
        </table>
      </div>
      <AnnouncementPanel announcements={announcements ?? []} />
    </div>
  );
}
