"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TicketReply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("open");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function send() {
    if (!body.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/platform/support/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reply failed");
      setBody("");
      setMessage("Reply sent");
      router.refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a reply..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      <div className="flex gap-2 items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs">
          {["open", "pending", "resolved", "closed"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={send} disabled={saving} className="px-3 py-1 bg-navy-900 text-white text-xs rounded disabled:opacity-50">
          {saving ? "Sending..." : "Send reply"}
        </button>
        {message && <span className="text-xs text-slate-600">{message}</span>}
      </div>
    </div>
  );
}
