"use client";

import { useEffect, useState } from "react";

export default function AcceptInvitationPage() {
  const [status, setStatus] = useState("Accepting invitation...");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("No invitation token provided.");
      return;
    }
    fetch("/api/platform/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const data = await r.json();
        setStatus(r.ok ? "Invitation accepted. You now have platform access." : data.error || "Could not accept invitation.");
      })
      .catch(() => setStatus("Could not accept invitation."));
  }, []);

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-navy-900">Platform invitation</h1>
      <p className="mt-4 text-slate-600">{status}</p>
    </div>
  );
}
