"use client";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Drawer } from "@poweros/ui";
import { ClipboardPlus } from "lucide-react";
import { createCustomer, type FormState } from "@/app/(app)/customers/actions";
import { createPrescription } from "@/app/(app)/prescriptions/actions";

function Save() { const { pending } = useFormStatus(); return <button form="qc-form" disabled={pending} className="btn btn-gold">{pending ? "Saving…" : "Save and use customer"}</button>; }

type EyeF = { sph: string; cyl: string; axis: string; add: string };
const emptyEye = (): EyeF => ({ sph: "", cyl: "", axis: "", add: "" });
const num = (s: string) => { const t = s.trim(); if (!t) return null; const n = parseFloat(t); return Number.isFinite(n) ? n : null; };

// Module scope so React keeps the inputs mounted while typing (an in-component
// declaration would remount them on every render and steal focus).
const Eye = ({ side, v, set }: { side: string; v: EyeF; set: (e: EyeF) => void }) => (
  <div className="rounded-xl border border-slate-100 p-3">
    <p className="mb-2 text-xs font-semibold text-slate-600">{side === "od" ? "Right (OD)" : "Left (OS)"}</p>
    <div className="grid grid-cols-4 gap-2">
      {([["sph", "SPH"], ["cyl", "CYL"], ["axis", "AXIS"], ["add", "ADD"]] as const).map(([k, lab]) => (
        <label key={k} className="block"><span className="mb-0.5 block text-[10px] text-slate-400">{lab}</span>
          <input inputMode="decimal" placeholder={k === "axis" ? "—" : "0.00"} value={v[k]}
            onChange={(e) => set({ ...v, [k]: e.target.value })} className="field !px-2 !py-1.5 text-sm" /></label>))}
    </div>
  </div>);

export function QuickCustomer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: { id: string; full_name: string; phone: string; vision_id: string }, rxId?: string) => void }) {
  const [state, action] = useFormState<FormState, FormData>(createCustomer, {}); const form = useRef<HTMLFormElement>(null); const last = useRef<string>();
  const [withRx, setWithRx] = useState(false);
  const [od, setOd] = useState<EyeF>(emptyEye()); const [os, setOs] = useState<EyeF>(emptyEye());
  const [rxErr, setRxErr] = useState("");

  useEffect(() => { if (!open) { setWithRx(false); setOd(emptyEye()); setOs(emptyEye()); setRxErr(""); } }, [open]);

  useEffect(() => {
    if (!(state.ok && state.id && last.current !== state.id && form.current)) return;
    last.current = state.id;
    const f = new FormData(form.current);
    const base = { id: state.id, full_name: String(f.get("full_name")), phone: String(f.get("phone")), vision_id: state.vision_id ?? "" };
    if (!withRx) { onCreated(base); return; }
    (async () => {
      const has = [od.sph, od.cyl, od.add, os.sph, os.cyl, os.add].some((x) => x.trim() !== "");
      if (!has) { onCreated(base); return; }
      // Same-form prescription: created right after the customer, then both are selected.
      const r = await createPrescription({
        customer_id: state.id!, source: "manual", image_path: null,
        examined_by: "", valid_till: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), remarks: "",
        values: {
          od: { sph: num(od.sph), cyl: num(od.cyl), axis: num(od.axis), add: num(od.add), va_dist: "", va_near: "" },
          os: { sph: num(os.sph), cyl: num(os.cyl), axis: num(os.axis), add: num(os.add), va_dist: "", va_near: "" },
          pd_far: null, pd_near: null,
        },
      });
      if (r.error) { setRxErr(r.error); onCreated(base); return; }
      onCreated(base, r.id);
    })();
  }, [state]);

  return (<Drawer open={open} onClose={onClose} title="New customer" subtitle="Quick add. More details can be added later." footer={<><button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button><Save /></>}>
    <form id="qc-form" ref={form} action={action} className="space-y-3"><input type="hidden" name="email" value="" />
      <input name="full_name" required placeholder="Full name *" className="field" autoFocus /><div className="grid gap-3 sm:grid-cols-2"><input name="phone" required inputMode="tel" placeholder="Contact number *" className="field" /><input name="whatsapp" inputMode="tel" placeholder="WhatsApp number" className="field" /></div>
      <div className="grid grid-cols-2 gap-3"><div className="field flex items-center gap-4 text-sm"><label className="flex gap-1"><input type="radio" name="gender" value="male" defaultChecked />Male</label><label className="flex gap-1"><input type="radio" name="gender" value="female" />Female</label></div><input name="dob" type="date" className="field" aria-label="Date of birth" /></div>
      <div className="grid gap-3 sm:grid-cols-3"><input name="city" required defaultValue="Chennai" placeholder="City *" className="field" /><input name="state" required defaultValue="Tamil Nadu" placeholder="State *" className="field" /><input name="pincode" required inputMode="numeric" placeholder="Pincode *" className="field" /></div>

      {/* Prescription in the same form — optional */}
      <div className="rounded-2xl border border-slate-100 p-3">
        <button type="button" onClick={() => setWithRx((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-navy-800">
          <span className="flex items-center gap-2"><ClipboardPlus size={16} className="text-gold-500" />Prescription (optional)</span>
          <span className="text-xs font-medium text-slate-400">{withRx ? "Hide −" : "Add +"}</span>
        </button>
        {withRx && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">Leave blank if the customer has none yet — you can add it later.</p>
            <Eye side="od" v={od} set={setOd} /><Eye side="os" v={os} set={setOs} />
            <p className="text-[11px] text-slate-400">Example: SPH −1.25, CYL −0.50, AXIS 180, ADD +2.00. A cylinder needs an axis.</p>
            {rxErr && <p className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-600">Customer saved, but the prescription wasn't: {rxErr}</p>}
          </div>)}
      </div>

      {state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{state.error}</p>}</form></Drawer>);
}
