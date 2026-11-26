
"use client";
import { useState } from "react";
import { Tag, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Check, AlertTriangle } from "lucide-react";
import { upsertCoupon, toggleCoupon, deleteCoupon } from "./actions";

const inr = (n: any) => `₹${Number(n||0).toLocaleString("en-IN")}`;
const dStr = (d: string|null) => d ? new Date(d).toLocaleDateString("en-IN",{dateStyle:"medium"}) : "—";

type Coupon = {
  id:string; code:string; description:string|null; type:string; value:number;
  min_order:number; max_uses:number|null; per_customer:number; uses:number;
  valid_from:string|null; valid_until:string|null; is_active:boolean; created_at:string;
};

function CouponForm({ coupon, onClose }: { coupon?: Coupon; onClose: () => void }) {
  const [state, setState] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  // React 18 has no useActionState (React 19 API) — call the server action directly.
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true); setState(null);
    const r = await upsertCoupon(null, new FormData(e.currentTarget)) as { ok?: boolean; error?: string } | null;
    setPending(false);
    if (r?.ok) { onClose(); return; }
    setState(r ?? { error: "Something went wrong. Please try again." });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800">{coupon ? "Edit Coupon" : "New Coupon"}</h3>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        {state?.error && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex gap-2"><AlertTriangle size={15}/>{state.error}</div>}
        <form onSubmit={submit} className="space-y-3">
          {coupon && <input type="hidden" name="id" value={coupon.id}/>}
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Coupon Code *</span>
              <input name="code" defaultValue={coupon?.code} required placeholder="e.g. SAVE200" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono uppercase outline-none focus:border-blue-500"/>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Type *</span>
              <select name="type" defaultValue={coupon?.type ?? "percent"} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed (₹)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Value *</span>
              <input name="value" type="number" step="0.01" min="0.01" defaultValue={coupon?.value} required placeholder="10 or 100" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Min Order (₹)</span>
              <input name="min_order" type="number" min="0" defaultValue={coupon?.min_order ?? 0} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Max Total Uses</span>
              <input name="max_uses" type="number" min="1" defaultValue={coupon?.max_uses ?? ""} placeholder="Unlimited" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Valid From</span>
              <input name="valid_from" type="date" defaultValue={coupon?.valid_from?.slice(0,10) ?? ""} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Valid Until</span>
              <input name="valid_until" type="date" defaultValue={coupon?.valid_until?.slice(0,10) ?? ""} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Description (shown to customer)</span>
              <input name="description" defaultValue={coupon?.description ?? ""} placeholder="e.g. 10% off on all orders" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
            </label>
            <label className="col-span-2 flex items-center gap-2">
              <input type="hidden" name="is_active" value="false"/>
              <input name="is_active" type="checkbox" value="true" defaultChecked={coupon?.is_active ?? true} className="rounded"/>
              <span className="text-sm text-slate-600">Active (visible on website)</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button disabled={pending} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {pending ? "Saving…" : coupon ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>);
}

export function CouponsView({ coupons }: { coupons: Coupon[] }) {
  const [editing, setEditing] = useState<Coupon|undefined>();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [delErr, setDelErr] = useState("");

  async function handleDelete(id: string) {
    const r = await deleteCoupon(id);
    if ((r as any)?.error) setDelErr((r as any).error);
    else setDeleting(null);
  }

  const now = new Date();
  const getStatus = (c: Coupon) => {
    if (!c.is_active) return { label:"Inactive", cls:"bg-slate-100 text-slate-500" };
    if (c.valid_until && new Date(c.valid_until) < now) return { label:"Expired", cls:"bg-rose-100 text-rose-600" };
    if (c.valid_from && new Date(c.valid_from) > now) return { label:"Upcoming", cls:"bg-amber-100 text-amber-700" };
    if (c.max_uses !== null && c.uses >= c.max_uses) return { label:"Exhausted", cls:"bg-orange-100 text-orange-600" };
    return { label:"Active", cls:"bg-emerald-100 text-emerald-700" };
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Tag size={20}/>Coupon Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage discount codes for the website.</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
          <Plus size={16}/>New Coupon
        </button>
      </div>

      {delErr && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex items-start gap-2"><AlertTriangle size={15}/>{delErr}<button onClick={()=>setDelErr("")} className="ml-auto"><X size={14}/></button></div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Total Coupons", coupons.length, "bg-blue-50 text-blue-700"],
          ["Active", coupons.filter(c=>getStatus(c).label==="Active").length, "bg-emerald-50 text-emerald-700"],
          ["Total Redemptions", coupons.reduce((a,c)=>a+c.uses,0), "bg-gold-50 text-gold-700"],
          ["Expired / Inactive", coupons.filter(c=>["Expired","Inactive","Exhausted"].includes(getStatus(c).label)).length, "bg-slate-50 text-slate-600"],
        ].map(([l,v,cls])=>(
          <div key={l as string} className={`rounded-xl p-3 text-center ${cls}`}>
            <p className="font-extrabold text-2xl">{v}</p>
            <p className="text-xs font-medium mt-0.5">{l}</p>
          </div>))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {coupons.length === 0
          ? <div className="p-16 text-center text-slate-400"><Tag size={40} className="mx-auto mb-3 opacity-30"/><p className="font-medium">No coupons yet</p><p className="text-sm mt-1">Create your first coupon to offer discounts on the website.</p></div>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {["Code","Type","Value","Min Order","Usage","Valid Period","Status","Actions"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map(c=>{
                    const st = getStatus(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-mono font-bold text-navy-900">{c.code}</p>
                            {c.description && <p className="text-xs text-slate-400 truncate max-w-36">{c.description}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize">{c.type}</td>
                        <td className="px-4 py-3 font-semibold">{c.type==="percent" ? `${c.value}%` : inr(c.value)}</td>
                        <td className="px-4 py-3">{c.min_order > 0 ? inr(c.min_order) : "None"}</td>
                        <td className="px-4 py-3">
                          <p>{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""} uses</p>
                          {c.max_uses && <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(100,c.uses/c.max_uses*100)}%`}}/></div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <p>{dStr(c.valid_from)} →</p>
                          <p>{dStr(c.valid_until)}</p>
                        </td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition" title="Edit"><Edit2 size={14}/></button>
                            <button onClick={() => toggleCoupon(c.id, !c.is_active)} className={`rounded-lg p-1.5 transition ${c.is_active?"hover:bg-amber-50 text-amber-500":"hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"}`} title={c.is_active?"Deactivate":"Activate"}>
                              {c.is_active ? <ToggleLeft size={14}/> : <ToggleRight size={14}/>}
                            </button>
                            {deleting===c.id
                              ? <div className="flex items-center gap-1">
                                  <button onClick={()=>handleDelete(c.id)} className="rounded-lg p-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200"><Check size={14}/></button>
                                  <button onClick={()=>setDeleting(null)} className="rounded-lg p-1.5 hover:bg-slate-100"><X size={14}/></button>
                                </div>
                              : <button onClick={()=>{setDelErr("");setDeleting(c.id);}} className="rounded-lg p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition" title="Delete"><Trash2 size={14}/></button>}
                          </div>
                        </td>
                      </tr>);})}
                </tbody>
              </table>
            </div>}
      </div>
      {(adding || editing) && <CouponForm coupon={editing} onClose={()=>{setAdding(false);setEditing(undefined);}}/>}
    </div>);
}
