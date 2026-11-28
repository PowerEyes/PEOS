"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTicket({ organisations }: { organisations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [orgId, setOrgId] = useState(organisations[0]?.id || "");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function create() {
    if (!orgId || !subject.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/platform/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create ticket");
      setSubject("");
      setMessage("Ticket created");
      router.refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
      <h3 className="text-lg font-bold text-navy-900">New ticket</h3>
      <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
        {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      <div className="flex gap-2 items-center">
        <button onClick={create} disabled={saving} className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm disabled:opacity-50">
          {saving ? "Creating..." : "Create ticket"}
        </button>
        {message && <span className="text-xs text-slate-600">{message}</span>}
      </div>
    </div>
  );
}
