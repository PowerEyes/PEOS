"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password !== confirm) return setErr("Passwords do not match.");
    if (password.length < 8 || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
      return setErr("Use at least 8 characters with both letters and numbers.");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Unable to update password.");
      router.replace("/login?reset=1");
      router.refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Unable to update password.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">Use at least 8 characters with letters and numbers.</p>
      {["password", "confirm"].map((name, index) => (
        <div key={name}>
          <label className="block text-sm font-medium text-navy-700 mb-1">{index === 0 ? "New password" : "Confirm password"}</label>
          <div className="relative">
            <input
              name={name}
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm outline-none focus:border-navy-700"
              placeholder="8+ characters"
            />
            {index === 0 && (
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>
        </div>
      ))}
      {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
      <button disabled={busy} className="btn-gold w-full py-3">{busy ? "Updating…" : "Update password →"}</button>
    </form>
  );
}
