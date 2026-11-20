"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Glasses } from "lucide-react";
import { dbError } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in"|"up">("in");
  const [f, setF] = useState({ name:"", email:"", phone:"", gender:"male", dob:"", password:"" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [waOptIn, setWaOptIn] = useState(true);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const sb = supabaseBrowser();
    if (mode === "up") {
      // Detect an already-registered account before attempting sign-up.
      const { data: existing } = await sb.from("customers").select("id,auth_user_id").or(`email.eq.${f.email},phone.eq.${f.phone}`).limit(1).maybeSingle();
      if (existing?.auth_user_id) {
        setBusy(false);
        setErr("An account with this email or phone already exists. Please sign in instead.");
        setMode("in");
        return;
      }
    }
    const { data, error } = mode === "in"
      ? await sb.auth.signInWithPassword({ email: f.email, password: f.password })
      : await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name, phone: f.phone, gender: f.gender, dob: f.dob, whatsapp_opt_in: waOptIn } } });
    setBusy(false);
    if (error) {
      // Supabase returns "User already registered" for duplicate emails.
      if (mode === "up" && /already registered|already exists/i.test(error.message)) {
        setErr("An account with this email already exists. Please sign in instead.");
        setMode("in");
        return;
      }
      return setErr(dbError(error.message));
    }
    if (mode === "up") {
      if (data?.user) {
        await sb.from("customers").update({
          whatsapp_opt_in: waOptIn,
          whatsapp_opt_in_at: waOptIn ? new Date().toISOString() : null,
          gender: f.gender,
          dob: f.dob || null,
        }).eq("auth_user_id", data.user.id);
      }
      await fetch("/api/customer-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappOptIn: waOptIn, gender: f.gender, dob: f.dob }),
      });
    }
    router.push("/my"); router.refresh();
  }
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-3"><Glasses className="h-8 w-8 text-navy-900"/><span className="font-display text-2xl font-bold text-navy-900">POWER EYES</span></div>
          <h1 className="font-display text-2xl font-bold text-navy-900">{mode==="in"?"Sign in":"Create account"}</h1>
          <p className="text-slate-500 text-sm mt-1">{mode==="in"?"Access your Vision ID, orders and prescriptions":"Join Power Eyes family — free Vision ID for you and your family"}</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          {mode==="up"&&<div><label className="block text-sm font-medium text-navy-700 mb-1">Full name</label><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700" placeholder="Your full name"/></div>}
          {mode==="up"&&<div><label className="block text-sm font-medium text-navy-700 mb-1">Gender</label><div className="flex gap-4"><label className="flex items-center gap-1.5 text-sm"><input type="radio" name="gender" value="male" checked={f.gender==="male"} onChange={()=>setF({...f,gender:"male"})}/>Male</label><label className="flex items-center gap-1.5 text-sm"><input type="radio" name="gender" value="female" checked={f.gender==="female"} onChange={()=>setF({...f,gender:"female"})}/>Female</label></div></div>}
          <div><label className="block text-sm font-medium text-navy-700 mb-1">Email address</label><input type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700" placeholder="you@example.com"/></div>
          {mode==="up"&&<div><label className="block text-sm font-medium text-navy-700 mb-1">WhatsApp number</label><input type="tel" required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700" placeholder="+91 98401 85186"/></div>}
          {mode==="up"&&<div><label className="block text-sm font-medium text-navy-700 mb-1">Date of birth</label><input type="date" required value={f.dob} onChange={e=>setF({...f,dob:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></div>}
          <div><label className="block text-sm font-medium text-navy-700 mb-1">Password</label><input type="password" required minLength={8} value={f.password} onChange={e=>setF({...f,password:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700" placeholder="8+ characters"/></div>
          {mode==="up"&&(
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={waOptIn}
                onChange={e=>setWaOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy-700"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                Send me order updates, prescription reminders and exclusive offers on WhatsApp.
                <span className="text-slate-400"> (Recommended — you can opt out anytime)</span>
              </span>
            </label>
          )}
          {err&&<div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
          <button disabled={busy} className="btn-gold w-full py-3">{busy?"Please wait…":mode==="in"?"Sign in →":"Create my Vision ID →"}</button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-4">{mode==="in"?"Don't have an account?":"Already have an account?"}
          <button onClick={()=>{setMode(mode==="in"?"up":"in");setErr("");}} className="ml-1 font-semibold text-navy-700 underline">{mode==="in"?"Sign up free":"Sign in"}</button></p>
        <p className="text-center text-xs text-slate-400 mt-3">
          <Link href="/" className="hover:underline">← Back to store</Link>
        </p>
      </div>
    </div>);
}