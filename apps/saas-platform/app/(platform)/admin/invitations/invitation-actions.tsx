"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitationActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function revoke() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/platform/invitations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke invitation");
      setMessage("Revoked");
      router.refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (status !== "pending") return <span className="text-slate-400">—</span>;

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={revoke}
        disabled={saving}
        className="text-navy-600 hover:text-navy-900 font-medium disabled:opacity-50"
      >
        {saving ? "Revoking..." : "Revoke"}
      </button>
      {message && <span className="text-[10px] text-slate-500">{message}</span>}
    </span>
  );
}
