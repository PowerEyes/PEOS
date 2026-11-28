"use client";
import { useState } from "react";
export function LeadForm({ plan }: { plan: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle"); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState("busy"); setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget)); const res = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, plan_code: plan || null }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(j.error || "Something went wrong. Please try again."); setState("idle"); } else setState("done");
  }
  if (state === "done") return <p className="mt-8 rounded-xl bg-emerald-50 p-5 text-emerald-800">Thank you. We have your request and will contact you shortly.</p>;
  return (<form onSubmit={submit} className="mt-8 space-y-3">
    <input name="full_name" required minLength={2} maxLength={120} placeholder="Your name" className="field" />
    <input name="business_name" required minLength={2} maxLength={160} placeholder="Business name" className="field" />
    <input name="email" type="email" required maxLength={254} placeholder="Email" className="field" />
    <div className="grid grid-cols-2 gap-3"><input name="phone" maxLength={20} placeholder="Phone" className="field" /><input name="branches" type="number" min={1} max={1000} placeholder="Number of branches" className="field" /></div>
    <textarea name="message" maxLength={1000} rows={4} placeholder="Anything we should know?" className="field" />
    <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
    {err && <p className="text-sm text-red-600">{err}</p>}
    <button disabled={state === "busy"} className="btn w-full">{state === "busy" ? "Sending…" : "Send request"}</button></form>);
}
