"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewInvitationPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("support");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send invitation");
      setSent(true);
      setTimeout(() => router.push("/admin/invitations"), 1000);
    } catch (err: any) {
      setError(err.message || "Could not send invitation");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <Link
          href="/admin/invitations"
          className="text-sm text-navy-600 hover:text-navy-900 underline"
        >
          ← Back to Invitations
        </Link>
        <h1 className="text-3xl font-bold text-navy-900 mt-2">Invite Staff</h1>
        <p className="text-slate-600">
          Invite platform administrators and support staff by email
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="admin@opticalchain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
            >
              <option value="super_admin">Super Admin</option>
              <option value="billing">Billing</option>
              <option value="support">Support</option>
              <option value="read_only">Read Only</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {sent && (
            <div className="text-emerald-700 text-sm bg-emerald-50 px-3 py-2 rounded-lg">
              Invitation sent to {email}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || sent}
              className="bg-navy-900 hover:bg-navy-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Invitation"}
            </button>
            <Link
              href="/admin/invitations"
              className="px-6 py-2 rounded-lg font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
