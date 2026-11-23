"use client";
import { useState, useTransition } from "react";
import { publishAnnouncement } from "../actions";

export function AnnouncementPanel({ announcements }: { announcements: any[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [f, setF] = useState({ title: "", body: "", target: "all" as "all" | "trialing" | "past_due" | "expired" });

  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <p className="mb-3 text-sm font-semibold">Announcements</p>
      <form className="space-y-2"
        onSubmit={(e) => { e.preventDefault(); setMsg({}); start(async () => { const r = await publishAnnouncement(f); setMsg(r); if (r.ok) setF({ title: "", body: "", target: "all" }); }); }}>
        <input className="input w-full" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <textarea className="input w-full" placeholder="Message" rows={2} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required />
        <div className="flex gap-2">
          <select className="input w-44" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value as any })}>
            <option value="all">All companies</option><option value="trialing">Trialing</option><option value="past_due">Past due</option><option value="expired">Expired</option>
          </select>
          <button disabled={pending} className="btn bg-gold-500 text-slate-950 disabled:opacity-50">Publish</button>
        </div>
        {msg.error && <p className="text-xs text-rose-400">{msg.error}</p>}
        {msg.ok && <p className="text-xs text-emerald-400">{msg.ok}</p>}
      </form>
      <ul className="mt-4 space-y-2 text-sm">
        {announcements.map((a) => (
          <li key={a.id} className="rounded-lg bg-slate-900/60 p-3">
            <div className="flex justify-between"><p className="font-medium">{a.title}</p><span className="text-xs capitalize text-slate-500">{a.target}</span></div>
            <p className="mt-1 text-xs text-slate-400">{a.body}</p>
            <p className="mt-1 text-[10px] text-slate-600">{new Date(a.published_at).toLocaleString()}</p>
          </li>
        ))}
        {!announcements.length && <li className="text-sm text-slate-500">No announcements.</li>}
      </ul>
    </div>
  );
}
