"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewOrganisationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/platform/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          legal_name: f.get("legal_name"),
          business_email: f.get("business_email"),
          business_phone: f.get("business_phone"),
          plan: f.get("plan"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create organisation");
      router.push(`/organisations/${data.organisation.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/organisations" className="text-sm text-navy-600 underline">← Back to Organisations</Link>
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Create Organisation</h1>
        <p className="text-slate-600">Add a new tenant to the platform.</p>
      </div>
      <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {[
          ["name", "Organisation name", true],
          ["legal_name", "Legal name", false],
          ["business_email", "Business email", false],
          ["business_phone", "Business phone", false],
        ].map(([name, label, required]) => (
          <div key={name as string}>
            <label className="block text-sm font-medium text-navy-700 mb-1">{label}</label>
            <input name={name as string} required={Boolean(required)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none" />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Plan</label>
          <select name="plan" className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="bg-navy-900 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50">
          {loading ? "Creating..." : "Create Organisation"}
        </button>
      </form>
    </div>
  );
}
