import { supabaseServer } from "@/lib/supabase/server";

export default async function AnnouncementsPage() {
  const sb = supabaseServer();
  const { data: announcements } = await sb.from("announcements").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Announcement Management</h1>
        <button className="btn btn-primary">+ New Announcement</button>
      </div>
      <div className="space-y-3">
        {announcements?.map((a: any) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-navy-900">{a.title}</h3>
              <span className={`px-2 py-1 rounded text-xs ${a.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{a.is_active ? "Active" : "Inactive"}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{a.body}</p>
          </div>
        ))}
        {(!announcements || announcements.length === 0) && <div className="card p-12 text-center text-slate-500">No announcements yet</div>}
      </div>
    </div>
  );
}