import { createAdminClient } from "@/lib/supabase/admin";
import NewTicket from "./new-ticket";
import TicketReply from "./ticket-reply";

export const dynamic = "force-dynamic";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function SupportPage() {
  const admin = createAdminClient();
  const [{ data: tickets }, { data: orgs }, { data: messages }] = await Promise.all([
    admin.from("support_tickets").select("id,org_id,subject,status,priority,created_at").order("created_at", { ascending: false }),
    admin.from("organizations").select("id,name").order("name"),
    admin.from("support_ticket_messages").select("ticket_id,author_name,body,is_internal,created_at").order("created_at", { ascending: true }),
  ]);

  const orgMap = new Map((orgs || []).map((o) => [o.id, o.name]));
  const messagesByTicket = new Map<string, any[]>();
  for (const m of messages || []) {
    const arr = messagesByTicket.get(m.ticket_id) || [];
    arr.push(m);
    messagesByTicket.set(m.ticket_id, arr);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Support</h1>
        <p className="text-slate-600">Tickets across all organisations</p>
      </div>

      <NewTicket organisations={(orgs || []).map((o) => ({ id: o.id, name: o.name }))} />

      <div className="space-y-4">
        {(tickets || []).map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-navy-900">{t.subject}</h3>
                <p className="text-xs text-slate-500">{orgMap.get(t.org_id) || t.org_id} · {fmt(t.created_at)}</p>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">{t.status} · {t.priority}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {(messagesByTicket.get(t.id) || []).map((m, i) => (
                <div key={i} className={`p-2 rounded ${m.is_internal ? "bg-amber-50" : "bg-navy-50"}`}>
                  <span className="font-medium">{m.author_name || "Unknown"}</span>: {m.body}
                </div>
              ))}
              {(messagesByTicket.get(t.id) || []).length === 0 && <p className="text-slate-500">No replies yet.</p>}
            </div>
            <TicketReply ticketId={t.id} />
          </div>
        ))}
        {(tickets || []).length === 0 && <p className="text-slate-500">No tickets yet.</p>}
      </div>
    </div>
  );
}
