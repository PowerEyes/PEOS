
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { dbError } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [f, setF] = useState({ name:"", phone:"", email:"", dob:"", gender:"", address:"", city:"", state:"", pincode:"" });
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(true);
  const sb = supabaseBrowser();

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await sb.auth.getUser();
      if(!user){window.location.href="/my/login";return;}
      const {data:c} = await sb.from("customers").select("*").eq("auth_user_id",user.id).maybeSingle();
      if(c) setF({name:c.full_name||"",phone:c.phone||"",email:c.email||"",dob:c.dob||"",gender:c.gender||"",address:c.address_line1||"",city:c.city||"Chennai",state:c.state||"Tamil Nadu",pincode:c.pincode||""});
      setLoading(false);
    })();
  },[]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setOk(""); setErr("");
    const {data:{user}} = await sb.auth.getUser();
    if(!user){setBusy(false);return;}
    const {error} = await sb.from("customers").update({full_name:f.name,phone:f.phone,email:f.email,dob:f.dob||null,gender:f.gender||null,address_line1:f.address||null,city:f.city,state:f.state,pincode:f.pincode}).eq("auth_user_id",user.id);
    setBusy(false);
    if(error) setErr(dbError(error.message)); else setOk("Profile updated successfully!");
  }

  if(loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-slate-400">Loading…</div></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        Home › <Link href="/my" className="hover:underline">My Account</Link> › <span className="font-medium text-slate-700">My Profile</span>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-800 to-navy-600 text-white px-8 py-10">
          <h1 className="font-extrabold text-3xl">MY PROFILE</h1>
          <p className="text-slate-300 mt-1">Manage your personal information and preferences.</p>
        </div>
        <form onSubmit={save} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
          <p className="font-bold text-navy-900 text-lg border-b border-slate-100 pb-3">Personal Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-600 mb-1 block">Full Name *</span>
              <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Phone Number *</span>
              <input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Email Address</span>
              <input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Date of Birth</span>
              <input type="date" value={f.dob} onChange={e=>setF({...f,dob:e.target.value})} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Gender</span>
              <select value={f.gender} onChange={e=>setF({...f,gender:e.target.value})} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700">
                <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select></label>
          </div>
          <p className="font-bold text-navy-900 text-lg border-b border-slate-100 pb-3 pt-2">Address</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 block"><span className="text-xs font-medium text-slate-600 mb-1 block">Street Address</span>
              <textarea value={f.address} onChange={e=>setF({...f,address:e.target.value})} rows={2} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700 resize-none"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">City</span>
              <input value={f.city} onChange={e=>setF({...f,city:e.target.value})} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">State</span>
              <input value={f.state} onChange={e=>setF({...f,state:e.target.value})} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Pincode</span>
              <input value={f.pincode} onChange={e=>setF({...f,pincode:e.target.value.replace(/\D/g,"").slice(0,6)})} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
          </div>
          {err && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{err}</div>}
          {ok && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">✓ {ok}</div>}
          <div className="flex gap-3 pt-2">
            <Link href="/my" className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</Link>
            <button disabled={busy} className="flex-1 rounded-lg bg-gold-500 py-3 text-sm font-bold text-white hover:bg-gold-600 transition disabled:opacity-60">{busy?"Saving…":"Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

