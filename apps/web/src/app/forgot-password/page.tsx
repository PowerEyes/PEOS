"use client";
import { useState } from "react";
import Link from "next/link";
import { Glasses } from "lucide-react";
import { dbError } from "@poweros/business-rules";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Unable to request a reset email.");
      setSent(true);
    } catch (error) {
      setErr(dbError(error instanceof Error ? error.message : "Unable to request a reset email."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-3"><Glasses className="h-8 w-8 text-navy-900"/><span className="font-display text-2xl font-bold text-navy-900">My account</span></div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Reset your password</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your registered email and we&apos;ll send a secure reset link.</p>
        </div>
        <div className="card p-6 space-y-4">
          {sent ? (
            <>
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.
              </div>
              <button type="button" disabled={busy} onClick={() => void send()} className="btn-gold w-full py-3">
                {busy ? "Sending…" : "Resend email"}
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="space-y-4"
            >
              <label className="block text-sm font-medium text-navy-700 mb-1">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"
                placeholder="you@example.com"
              />
              <button disabled={busy} className="btn-gold w-full py-3">{busy ? "Sending…" : "Send reset link →"}</button>
            </form>
          )}
          {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
        </div>
        <p className="text-center text-sm text-slate-500 mt-4">
          <Link href="/login" className="font-semibold text-navy-700 underline">Back to sign in</Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-3"><Link href="/" className="hover:underline">← Back to store</Link></p>
      </div>
    </div>
  );
}
