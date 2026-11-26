"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSupplier, setSupplierStatus, deleteSupplier } from "./actions";
type S = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; gstin: string | null; address: string | null; state: string | null; status: string };
const EMPTY = { name: "", contact_person: "", phone: "", email: "", gstin: "", address: "", state: "" };
export function SuppliersView({ rows }: { rows: S[] }) {
  const [edit, setEdit] = useState<{ id: string | null; v: typeof EMPTY } | null>(null), [err, setErr] = useState(""), [p, start] = useTransition(), r = useRouter();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const x = await fn(); if (x.error) setErr(x.error); else { setErr(""); setEdit(null); r.refresh(); } });
  const F = (k: keyof typeof EMPTY, label: string) => <label className="text-xs font-medium text-slate-600">{label}<input className="field mt-1 w-full" value={edit!.v[k]} onChange={(e) => setEdit({ ...edit!, v: { ...edit!.v, [k]: e.target.value } })} /></label>;
  return (<>
    <div className="flex items-end justify-between"><div><h1 className="font-display text-2xl font-semibold">Suppliers</h1><p className="text-sm text-slate-500">Vendors used on purchase orders and purchase invoices.</p></div>
      <button onClick={() => { setErr(""); setEdit({ id: null, v: EMPTY }); }} className="btn btn-primary text-sm">Add supplier</button></div>
    {err && !edit && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Name</th><th>Contact</th><th>GSTIN</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((s) => (<tr key={s.id} className="border-t"><td className="p-3 font-medium">{s.name}<span className="block text-xs font-normal text-slate-400">{s.state}</span></td><td>{[s.contact_person, s.phone].filter(Boolean).join(" · ")}<span className="block text-xs text-slate-400">{s.email}</span></td><td className="font-mono text-xs">{s.gstin}</td>
        <td><span className={`rounded-full px-2 py-0.5 text-xs ${s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.status}</span></td>
        <td className="space-x-2 whitespace-nowrap pr-3 text-right text-xs"><button className="underline" onClick={() => { setErr(""); setEdit({ id: s.id, v: { name: s.name, contact_person: s.contact_person ?? "", phone: s.phone ?? "", email: s.email ?? "", gstin: s.gstin ?? "", address: s.address ?? "", state: s.state ?? "" } }); }}>Edit</button>
          <button className="underline" onClick={() => run(() => setSupplierStatus(s.id, s.status === "active" ? "inactive" : "active"))}>{s.status === "active" ? "Deactivate" : "Activate"}</button>
          <button className="text-rose-600 underline" onClick={() => { if (window.confirm(`Delete ${s.name}?`)) run(() => deleteSupplier(s.id)); }}>Delete</button></td></tr>))}
        {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No suppliers yet.</td></tr>}</tbody></table></div>
    {edit && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true"><div className="card w-full max-w-lg space-y-3 p-5">
      <h2 className="font-semibold">{edit.id ? "Edit supplier" : "Add supplier"}</h2><div className="grid grid-cols-2 gap-3">{F("name", "Name *")}{F("contact_person", "Contact person")}{F("phone", "Phone")}{F("email", "Email")}{F("gstin", "GSTIN")}{F("state", "State")}</div>{F("address", "Address")}
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="flex justify-end gap-2"><button className="btn btn-ghost text-sm" onClick={() => setEdit(null)}>Cancel</button><button disabled={p} className="btn btn-primary text-sm" onClick={() => run(() => saveSupplier(edit.id, edit.v))}>{p ? "Saving…" : "Save"}</button></div></div></div>}
  </>);
}
