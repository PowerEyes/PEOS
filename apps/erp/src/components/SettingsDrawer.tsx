"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer, useToast } from "@poweros/ui";
import { saveSettings } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
export function SettingsDrawer({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: AppSettings }) {
  const router = useRouter(); const toast = useToast(); const [f, setF] = useState<any>(settings); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF(settings); }, [open]);
  async function save() { setBusy(true); const r = await saveSettings({ gst: f.gst, gstin: f.gstin, maxDiscount: Number(f.maxDiscount), quoteDays: Number(f.quoteDays), labDays: Number(f.labDays) }); setBusy(false);
    if (r.error) return toast(r.error, "err"); toast(r.ok!); router.refresh(); onClose(); }
  const N = ({ k, t }: { k: string; t: string }) => <label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span><input type="number" className="field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (<Drawer open={open} onClose={onClose} title="Business settings" subtitle="Only owners and admins can change these" footer={<><button onClick={onClose} className="btn btn-ghost">Cancel</button><button disabled={busy} onClick={save} className="btn btn-gold">{busy ? "Saving…" : "Save settings"}</button></>}>
    <div className="space-y-4">
      <button type="button" role="switch" aria-checked={f.gst} onClick={() => setF({ ...f, gst: !f.gst })} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-left">
        <span><span className="block font-semibold">GST</span><span className="block text-sm text-slate-500">{f.gst ? "On: new bills show GST included and print as TAX INVOICE." : "Off: no tax is added or shown. New bills print as INVOICE."}</span></span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${f.gst ? "bg-gold-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${f.gst ? "left-[22px]" : "left-0.5"}`} /></span></button>
      {f.gst && <label className="block"><span className="mb-1 block text-xs text-slate-500">GSTIN (printed on invoices)</span><input className="field uppercase" maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} placeholder="33ABCDE1234F1Z5" /></label>}
      <p className="rounded-xl bg-navy-50 p-3 text-xs text-slate-600">Bills already created keep the GST setting they were made with. Selling prices stay the same either way.</p>
      <div className="grid grid-cols-2 gap-3"><N k="maxDiscount" t="Max staff discount (%)" /><N k="quoteDays" t="Quotation valid (days)" /><N k="labDays" t="Lab lead time (days)" /></div></div></Drawer>);
}
