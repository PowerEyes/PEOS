"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrganisationActions({ id, plan, status }: { id: string; plan: string; status: string }) {
  const router = useRouter();
  const [planValue, setPlanValue] = useState(plan);
  const [statusValue, setStatusValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/platform/organisations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planValue, status: statusValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage("Saved");
      router.refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-600 mb-1">Plan</label>
        <select value={planValue} onChange={(e) => setPlanValue(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          {["starter", "growth", "enterprise"].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1">Status</label>
        <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          {["trial", "active", "past_due", "suspended", "cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm disabled:opacity-50">
        {saving ? "Saving..." : "Save changes"}
      </button>
      {message && <span className="text-xs text-slate-600">{message}</span>}
    </div>
  );
}
