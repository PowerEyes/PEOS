"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dbError } from "@poweros/business-rules";
import { Eye, EyeOff } from "lucide-react";
export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const f = new FormData(e.currentTarget); const email = String(f.get("email")); const password = String(f.get("password"));
    const sb = supabaseBrowser();
    const { error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { data: { full_name: String(f.get("name")), is_staff: true } } });
    setBusy(false);
    if (error) return setErr(dbError(error.message));
    router.replace("/"); router.refresh();
  }
  return (
    <main className="grid min-h-screen place-items-center bg-navy-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2"><Eye className="text-gold-500" /><span className="font-display text-2xl font-semibold">PowerOS</span></div>
        <p className="text-sm text-slate-500">{mode === "in" ? "Sign in to Power Eyes Opticals" : "Request staff access. An owner must approve you."}</p>
        {mode === "up" && <input name="name" required placeholder="Full name" className="field" />}
        <input name="email" type="email" required placeholder="Email" className="field" />
        <div className="relative">
          <input name="password" type={showPassword ? "text" : "password"} required minLength={8} placeholder="Password" className="field pr-10" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button disabled={busy} className="btn btn-primary w-full">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Request access"}</button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-center text-sm text-navy-700 underline">
          {mode === "in" ? "New staff? Request access" : "Back to sign in"}</button>
      </form>
    </main>
  );
}
