"use client";
import { useState } from "react";
import Link from "next/link";
import { dbError } from "@poweros/business-rules";
import { Eye } from "lucide-react";

export default function ForgotPassword() {
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
    <main className="grid min-h-screen place-items-center bg-navy-900 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2">
          <Eye className="text-gold-500" />
          <span className="font-display text-2xl font-semibold">PowerOS</span>
        </div>
        <h1 className="text-xl font-semibold text-navy-900">Reset your password</h1>
        <p className="text-sm text-slate-500">
          Enter the email address linked to your staff account. We&apos;ll send a secure reset link.
        </p>
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.
            </div>
            <button type="button" disabled={busy} onClick={() => void send()} className="btn btn-ghost w-full">
              {busy ? "Sending…" : "Resend email"}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="space-y-4"
          >
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button disabled={busy} className="btn btn-primary w-full">
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        {sent && err && <p className="text-sm text-rose-600">{err}</p>}
        <Link href="/login" className="block text-center text-sm text-navy-700 underline">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
