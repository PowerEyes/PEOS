"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer, Modal, Pill } from "@poweros/ui";
import { Search, UserPlus, Phone, Mail, MapPin } from "lucide-react";
import { createCustomer, updateCustomer, type FormState } from "./actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { fmt, inr } from "@poweros/business-rules";
import { ageFrom, type Customer } from "@/lib/types";

function Save() { const { pending } = useFormStatus(); return <button form="cust-form" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save customer"}</button>; }

function AddCustomer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState<FormState, FormData>(createCustomer, {});
  const [dob, setDob] = useState("");
  useEffect(() => { if (state.ok) { router.refresh(); onClose(); } }, [state]);
  return (
    <Drawer open={open} onClose={onClose} title="Add customer" subtitle="A permanent Customer ID and Vision ID are assigned on save"
      footer={<><button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button><Save /></>}>
      <form id="cust-form" action={action} className="space-y-3">
        <input name="full_name" required placeholder="Full name *" className="field" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="whatsapp" placeholder="WhatsApp number" className="field" />
          <input name="phone" required placeholder="Contact number *" className="field" /></div>
        <input name="email" type="email" placeholder="Email (optional)" className="field" />
        <input name="referred_by_doctor" placeholder="Referred by doctor (optional)" className="field" />
        <div className="grid grid-cols-3 gap-3">
          <div className="field flex items-center gap-3 text-sm"><label className="flex gap-1"><input type="radio" name="gender" value="male" defaultChecked />Male</label>
            <label className="flex gap-1"><input type="radio" name="gender" value="female" />Female</label></div>
          <input name="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="field" aria-label="Date of birth" />
          <div className="field text-sm text-slate-500">Age: {ageFrom(dob || null) ?? "--"}</div></div>
        <p className="pt-2 text-sm font-semibold text-navy-700">Address</p>
        <textarea name="address_line1" placeholder="Address line 1" rows={2} className="field" />
        <div className="grid gap-3 sm:grid-cols-2"><input name="address_line2" placeholder="Address line 2 (optional)" className="field" /><input name="landmark" placeholder="Landmark (optional)" className="field" /></div>
        <div className="grid gap-3 sm:grid-cols-3"><input name="city" required placeholder="City *" className="field" defaultValue="Chennai" />
          <input name="state" required placeholder="State *" className="field" defaultValue="Tamil Nadu" /><input name="pincode" required inputMode="numeric" placeholder="Pincode *" className="field" /></div>
        <p className="pt-2 text-sm font-semibold text-navy-700">Notes</p>
        <textarea name="notes" maxLength={500} rows={3} placeholder="Preferences, special requirements…" className="field" />
        {state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{state.error}</p>}
      </form>
    </Drawer>);
}

const TABS = ["Overview", "Profile", "Prescriptions", "Orders", "Repairs", "Notes"];
function EditCustomer({ c, onClose }: { c: Customer | null; onClose: () => void }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (!c) return null;
  const customerId = c.id;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await updateCustomer(customerId, new FormData(e.currentTarget));
    setBusy(false); if (r.error) return setErr(r.error);
    router.refresh(); onClose();
  }
  return (<Drawer open={!!c} onClose={onClose} title="Edit customer" subtitle={`${c.customer_code} | ${c.vision_id}`}
    footer={<><button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button><button form="edit-cust" disabled={busy} className="btn btn-primary">{busy?"Saving…":"Save changes"}</button></>}>
    <form id="edit-cust" onSubmit={submit} className="space-y-3">
      <input name="full_name" required placeholder="Full name *" className="field" defaultValue={c.full_name}/>
      <div className="grid gap-3 sm:grid-cols-2"><input name="phone" required placeholder="Contact number *" className="field" defaultValue={c.phone??""}/><input name="whatsapp" placeholder="WhatsApp" className="field" defaultValue={c.whatsapp??""}/></div>
      <input name="email" type="email" placeholder="Email (optional)" className="field" defaultValue={c.email??""}/>
      <input name="referred_by_doctor" placeholder="Referred by doctor" className="field" defaultValue={c.referred_by_doctor??""}/>
      <div className="grid grid-cols-2 gap-3"><div className="field flex items-center gap-4 text-sm"><label className="flex gap-1"><input type="radio" name="gender" value="male" defaultChecked={c.gender==="male"}/> Male</label><label className="flex gap-1"><input type="radio" name="gender" value="female" defaultChecked={c.gender==="female"}/> Female</label></div><input name="dob" type="date" className="field" defaultValue={c.dob??""}/></div>
      <p className="text-sm font-semibold text-navy-700">Address</p>
      <textarea name="address_line1" placeholder="Address line 1" rows={2} className="field" defaultValue={c.address_line1??""}/>
      <div className="grid gap-3 sm:grid-cols-3"><input name="city" required placeholder="City *" className="field" defaultValue={c.city??""}/><input name="state" required placeholder="State *" className="field" defaultValue={c.state??""}/><input name="pincode" required placeholder="Pincode *" className="field" defaultValue={c.pincode??""}/></div>
      <textarea name="notes" maxLength={500} rows={3} placeholder="Notes" className="field" defaultValue={c.notes??""}/>
      {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
    </form></Drawer>);
}

function Customer360({ c, onClose }: { c: Customer | null; onClose: () => void }) {
  const [tab, setTab] = useState("Overview"); const [editing, setEditing] = useState(false);
  useEffect(() => setTab("Overview"), [c?.id]);
  const wa = c && (c.whatsapp || c.phone).replace(/\D/g, "");
  const [rx, setRx] = useState<any[]>([]); const [ord, setOrd] = useState<any[]>([]); const [rep, setRep] = useState<any[]>([]);
  useEffect(() => { if (!c) return; supabaseBrowser().from("sales").select("id,code,kind,status,grand_total,created_at").eq("customer_id", c.id).order("created_at", { ascending: false }).then(({ data }) => setOrd(data ?? [])); }, [c?.id]);
  useEffect(() => { if (!c) return; supabaseBrowser().from("prescriptions").select("id,rx_code,rx_date,od_sph,os_sph").eq("customer_id", c.id).order("rx_date", { ascending: false }).then(({ data }) => setRx(data ?? [])); }, [c?.id]);
  useEffect(() => { if (!c) return; supabaseBrowser().from("repairs").select("id,code,status,problem,item_brand,item_model,item_type,total_amount,created_at").eq("customer_id", c.id).order("created_at", { ascending: false }).then(({ data }) => setRep(data ?? [])); }, [c?.id]);
  // Referrer name for the referral template's [Existing Customer Name] token
  const [referrer, setReferrer] = useState("");
  useEffect(() => { setReferrer(""); const rid = c?.referred_by_customer; if (!rid) return;
    supabaseBrowser().from("customers").select("full_name").eq("id", rid).maybeSingle()
      .then(({ data }) => setReferrer(data?.full_name ?? "")); }, [c?.id]);
  return (<>
    <Modal open={!!c} onClose={onClose} wide title="Customer 360" subtitle="Complete view of the customer in one place">
      {c && <div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-navy-800 font-display text-2xl text-white">{c.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
          <div className="flex-1"><h3 className="text-2xl font-semibold">{c.full_name}</h3>
            <p className="text-sm text-slate-500">{c.customer_code} | {c.vision_id} | {c.gender} {ageFrom(c.dob) ? `| ${ageFrom(c.dob)} yrs` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Pill tone="green">{c.status}</Pill>{c.tags?.map((t) => <Pill key={t} tone="blue">{t}</Pill>)}</div></div>
          <WhatsAppSend phone={wa ?? ""} keys={["welcome", "welcome_back", "referral", "internal_followup"]}
            vars={{ Name: c.full_name, "Existing Customer Name": referrer || "[Existing Customer Name]" }}
            defaultKey="welcome" label="WhatsApp" className="btn btn-ghost text-emerald-700" />
          <button onClick={() => setEditing(true)} className="btn btn-ghost">Edit</button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-y border-slate-100 bg-slate-50 px-4">
          {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-3 py-3 text-sm font-medium ${tab === t ? "border-b-2 border-gold-500 text-navy-900" : "text-slate-500"}`}>{t}</button>)}</div>
        <div className="space-y-3 p-6 text-sm">
          {(tab === "Overview" || tab === "Profile") && <>
            <p className="flex gap-2"><Phone size={15} />{c.phone}</p>
            {c.email && <p className="flex gap-2"><Mail size={15} />{c.email}</p>}
            <p className="flex gap-2"><MapPin size={15} />{[c.address_line1, c.address_line2, c.landmark, c.city, c.state, c.pincode].filter(Boolean).join(", ")}</p>
            {c.referred_by_doctor && <p>Referred by Dr. {c.referred_by_doctor}</p>}
            <p className="text-slate-500">Customer since {new Date(c.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p></>}
          {tab === "Notes" && <p>{c.notes || "No notes yet."}</p>}
          {tab === "Prescriptions" && <div className="space-y-2">{rx.length === 0 && <p className="text-slate-500">No prescriptions yet.</p>}
            {rx.map((r) => <a key={r.id} href={`/print/rx/${r.id}`} target="_blank" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-navy-50"><span><b>{r.rx_code}</b> <span className="text-slate-500">{new Date(r.rx_date).toLocaleDateString("en-IN")}</span></span><span className="text-xs text-slate-500">OD {fmt(r.od_sph)} | OS {fmt(r.os_sph)}</span></a>)}
            <a href={`/prescriptions?new=1&customer=${c.id}`} className="btn btn-gold w-fit">New prescription</a></div>}
          {tab === "Orders" && <div className="space-y-2">{ord.length === 0 && <p className="text-slate-500">No orders or quotations yet.</p>}
            {ord.map((o) => <a key={o.id} href="/sales" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-navy-50"><span><b>{o.code}</b> <span className="text-slate-500">{new Date(o.created_at).toLocaleDateString("en-IN")}</span></span><span className="text-xs text-slate-500">{o.status.replace("_", " ")} | {inr(o.grand_total)}</span></a>)}
            <a href={`/sales?new=1&customer=${c.id}`} className="btn btn-gold w-fit">New sale</a></div>}
          {tab === "Repairs" && <div className="space-y-2">{rep.length === 0 && <p className="text-slate-500">No repairs yet.</p>}
            {rep.map((r) => <a key={r.id} href="/repairs" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-navy-50"><span className="min-w-0"><b>{r.code}</b> <span className="text-slate-500">{new Date(r.created_at).toLocaleDateString("en-IN")}</span><span className="block truncate text-xs text-slate-500">{[r.item_brand, r.item_model, r.item_type].filter(Boolean).join(" ")}{r.problem ? ` — ${r.problem}` : ""}</span></span><span className="shrink-0 text-xs text-slate-500">{r.status.replace("_", " ")}{r.total_amount > 0 ? ` | ${inr(r.total_amount)}` : ""}</span></a>)}
            <a href={`/repairs?new=1&customer=${c.id}`} className="btn btn-gold w-fit">New repair</a></div>}
        </div></div>}
    </Modal>
    <EditCustomer c={editing ? c : null} onClose={() => setEditing(false)} />
  </>);
}

export function CustomersView({ initial }: { initial: Customer[] }) {
  const [q, setQ] = useState(""); const [adding, setAdding] = useState(false); const [sel, setSel] = useState<Customer | null>(null);
  const sp = useSearchParams();
  useEffect(() => { if (sp.get("new")) setAdding(true); }, [sp]);
  useEffect(() => { const id = sp.get("open"); const f = id && initial.find((x) => x.id === id); if (f) setSel(f); }, [sp]);
  const rows = initial.filter((c) => `${c.full_name} ${c.phone} ${c.email ?? ""} ${c.vision_id} ${c.customer_code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold">Customers</h1>
        <p className="text-slate-500">{initial.length} customers and their vision care journey</p></div>
        <button onClick={() => setAdding(true)} className="btn btn-primary"><UserPlus size={16} />Add customer</button></div>
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} className="field pl-9" placeholder="Search by name, phone, email or Vision ID…" /></div>
      {rows.length === 0 ? <div className="card p-10 text-center text-slate-500">No customers found. Add the first one to get started.</div> :
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {rows.map((c) => (
            <button key={c.id} onClick={() => setSel(c)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-navy-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-800 text-sm text-white">{c.full_name[0]}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.full_name}</span><span className="block truncate text-xs text-slate-500">{c.phone}{c.email ? ` | ${c.email}` : ""}</span></span>
              <span className="hidden text-xs text-slate-500 sm:block">{c.vision_id}</span><Pill tone="green">{c.status}</Pill></button>))}</div>}
      <AddCustomer open={adding} onClose={() => setAdding(false)} />
      <Customer360 c={sel} onClose={() => setSel(null)} />
    </div>);
}
