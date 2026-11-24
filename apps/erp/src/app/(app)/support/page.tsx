import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LifeBuoy, Megaphone } from "lucide-react";
import { getAnnouncements, getSubscriptionStatus } from "@/lib/announcements";
import { TicketForm } from "./ticket-form";

export const dynamic = "force-dynamic";

// Mirrors the status pills the platform team sees for this company.
const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-sky-100 text-sky-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-600",
};

export default async function SupportPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: p } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!p?.org_id) return null;

  const status = await getSubscriptionStatus(sb, p.org_id);
  const [{ data: tickets }, announcements] = await Promise.all([
    // RLS (support_tickets_tenant) narrows this to the caller's company.
    sb.from("support_tickets")
      .select("id, subject, body, status, priority, created_at, updated_at")
      .order("created_at", { ascending: false }).limit(50),
    getAnnouncements(sb, status),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl sm:text-3xl font-semibold">
          <LifeBuoy size={24} className="text-gold-500" /> Support
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Messages to the PowerOS team and platform announcements for your company
        </p>
      </div>

      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Megaphone size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{a.title}</p>
                  {a.target !== "all" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">{a.target}</span>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-line text-amber-800">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <TicketForm />

      <div className="card overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Your tickets ({tickets?.length ?? 0})</p>
        </div>
        {(!tickets || tickets.length === 0) ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No tickets yet — open one above and we will reply by email.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Opened</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Subject</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Priority</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t: any) => (
                <tr key={t.id} className="border-t align-top">
                  <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                    {t.created_at ? new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{t.subject}</p>
                    {t.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.body}</p>}
                  </td>
                  <td className="p-3 capitalize text-slate-500">{t.priority || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_STYLE[t.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {t.status || "unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
