"use client";
import { useState } from "react";
import { createTicket } from "./actions";

export function TicketForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  async function send() {
    setBusy(true);
    const r = await createTicket(subject, body, priority);
    setBusy(false);
    setMsg(r);
    if (r.ok) { setSubject(""); setBody(""); setPriority("normal"); }
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">Open a ticket</h2>
        <p className="text-xs text-slate-500">
          Billing questions, technical issues or feature requests. Support stays available even when your subscription has expired.
        </p>
      </div>
      {msg.error && <p className="text-sm text-rose-600">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-emerald-600">{msg.ok}</p>}
      <input
        className="field" placeholder="Subject" value={subject} maxLength={200}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        className="field" rows={4} maxLength={4000}
        placeholder="What happened? Include what you were doing and what you expected."
        value={body} onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <select className="field w-auto" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <button
          className="btn btn-primary" disabled={busy || subject.trim().length < 5}
          onClick={send}
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}
