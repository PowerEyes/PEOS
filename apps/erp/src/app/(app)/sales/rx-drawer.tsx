"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Drawer, useToast } from "@poweros/ui";
import { Building2, Camera, Pencil, UploadCloud } from "lucide-react";
import { ADD_OPTIONS, CYL_OPTIONS, SPH_OPTIONS, emptyRx, fmt, validateRx, type RxValues } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { shrink } from "@/lib/image";
import { createPrescription } from "@/app/(app)/prescriptions/actions";

// Compact prescription capture used INSIDE the POS (no navigation, cart kept).
// Two methods: fill in manually, or an external practice's prescription with a
// photo of the hard copy (required for external).

// Module-scope (NOT declared inside the component — a new identity per render
// would remount these inputs and steal focus on every keystroke).
const Sel = ({ label, value, opts, onChange, signed }: any) => (
  <label className="block"><span className="mb-1 block text-xs text-slate-500">{label}</span>
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : +e.target.value)} className="field py-2.5">
      <option value="">-</option>{opts.map((o: any) => <option key={o} value={o}>{signed ? fmt(o) : o}</option>)}
    </select></label>);

const EyeForm = ({ side, v, setEye }: { side: "od" | "os"; v: RxValues; setEye: (s: "od" | "os") => (k: keyof RxValues["od"], val: any) => void }) => {
  const e = v[side]; const set = setEye(side); const od = side === "od";
  return (
    <div className={`rounded-2xl border p-4 ${od ? "border-blue-200 bg-blue-50/40" : "border-orange-200 bg-orange-50/40"}`}>
      <p className={`mb-3 font-semibold ${od ? "text-blue-700" : "text-orange-600"}`}>{od ? "Right eye (OD)" : "Left eye (OS)"}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Sel label="SPH" signed value={e.sph} opts={SPH_OPTIONS} onChange={(x: any) => set("sph", x)} />
        <Sel label="CYL" signed value={e.cyl} opts={CYL_OPTIONS} onChange={(x: any) => set("cyl", x)} />
        <label className="block"><span className="mb-1 block text-xs text-slate-500">AXIS</span>
          <input type="number" min={0} max={180} value={e.axis ?? ""} onChange={(ev) => set("axis", ev.target.value === "" ? null : Math.min(180, Math.max(0, +ev.target.value)))} className="field py-2.5" /></label>
        <Sel label="ADD" signed value={e.add} opts={ADD_OPTIONS} onChange={(x: any) => set("add", x)} />
      </div>
    </div>);
};

export function PosRxDrawer({ open, onClose, customerId, onCreated }:
  { open: boolean; onClose: () => void; customerId: string; onCreated: (rx: any) => void }) {
  const toast = useToast();
  const [method, setMethod] = useState<"start" | "manual" | "external">("start");
  const [v, setV] = useState<RxValues>(emptyRx());
  const [practice, setPractice] = useState("");
  const [examinedBy, setExaminedBy] = useState("");
  const [validTill, setValidTill] = useState(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string[]>([]);

  useEffect(() => {
    if (open) { setMethod("start"); setV(emptyRx()); setPractice(""); setExaminedBy(""); setBlob(null); setPreview(""); setWarn([]); }
  }, [open]);

  const setEye = (s: "od" | "os") => (k: keyof RxValues["od"], val: any) =>
    setV((p) => ({ ...p, [s]: { ...p[s], [k]: val } }));

  async function onFile(f: File | undefined) {
    if (!f) return;
    try { const b = await shrink(f); setBlob(b); setPreview(URL.createObjectURL(b)); }
    catch { toast("Could not read that image", "err"); }
  }
  async function save() {
    if (!customerId) return toast("Choose a customer first", "err");
    if (method === "external" && !practice.trim()) return toast("Enter the practice name", "err");
    if (method === "external" && !blob) return toast("Attach a photo of the prescription hard copy", "err");
    const w = validateRx(v);
    const blocking = w.filter((m) => m.startsWith("Enter at least") || m.includes("add an axis"));
    if (blocking.length) return setWarn(blocking);
    setBusy(true);    let image_path: string | null = null;
    if (blob) {
      const sb = supabaseBrowser();
      const { data: p } = await sb.from("profiles").select("org_id").single();
      const path = `${p?.org_id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("prescriptions").upload(path, blob, { contentType: "image/jpeg" });
      if (error) { setBusy(false); return toast(error.message, "err"); }
      image_path = path;
    }
    const r = await createPrescription({
      customer_id: customerId, source: method === "external" ? "external" : "manual",
      external_practice: method === "external" ? practice.trim() : undefined,
      image_path, values: v, examined_by: examinedBy, valid_till: validTill, remarks: method === "external" ? `External practice: ${practice.trim()}` : "",
    });
    setBusy(false);
    if (r.error) return toast(r.error, "err");
    onCreated({
      id: r.id, rx_code: r.ok, image_path, source: method === "external" ? "external" : "manual",
      rx_date: new Date().toISOString().slice(0, 10),
      od_sph: v.od.sph, od_cyl: v.od.cyl, od_axis: v.od.axis, od_add: v.od.add,
      os_sph: v.os.sph, os_cyl: v.os.cyl, os_axis: v.os.axis, os_add: v.os.add,
    });
    toast(`Prescription ${r.ok} saved`);
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add prescription" subtitle="Stay in the sale — nothing is lost"
      footer={method === "start" ? undefined :
        <><button onClick={() => setMethod("start")} className="btn btn-ghost">Back</button>
          <button disabled={busy} onClick={save} className="btn btn-gold">{busy ? "Saving…" : "Save prescription"}</button></>}>
      <motion.div animate={{ opacity: 1 }} className="space-y-4">
        {method === "start" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => setMethod("manual")} className="rounded-2xl border-2 border-slate-100 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
              <Pencil className="mb-2 text-navy-700" /><p className="font-semibold">Enter values myself</p>
              <p className="text-sm text-slate-500">Type the power from the eye test.</p></button>
            <button onClick={() => setMethod("external")} className="rounded-2xl border-2 border-gold-400/60 bg-amber-50/50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
              <Building2 className="mb-2 text-gold-600" /><p className="font-semibold">External practice</p>
              <p className="text-sm text-slate-500">Another doctor's prescription — photo of the hard copy required.</p></button>
          </div>)}

        {method !== "start" && <>
          {method === "external" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs text-slate-500">Practice / doctor name *</span>
                <input className="field" placeholder="e.g. Dr. Meena, Specs & Lenses" value={practice} onChange={(e) => setPractice(e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">Examined by</span>
                <input className="field" placeholder="Doctor (optional)" value={examinedBy} onChange={(e) => setExaminedBy(e.target.value)} /></label>
            </div>)}

          {/* Hard-copy photo */}
          <div>
            <span className="mb-1 block text-xs text-slate-500">
              Prescription hard copy {method === "external" ? "* (photo required)" : "(photo if available)"}
            </span>
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
              className="relative grid min-h-40 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              {preview ? <img src={preview} alt="Prescription" className="max-h-56 rounded-lg" /> :
                <div><UploadCloud className="mx-auto mb-2 text-slate-400" size={30} /><p className="text-sm font-medium">Drag a photo here</p>
                  <p className="text-xs text-slate-500">Full prescription visible, good light, both eyes</p></div>}
            </div>
            <div className="mt-2 flex gap-3">
              <label className="btn btn-primary !py-2 cursor-pointer"><Camera size={15} />Take or choose photo
                <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} /></label>
              {preview && <button onClick={() => { setBlob(null); setPreview(""); }} className="btn btn-ghost !py-2 text-sm">Remove</button>}
            </div>
          </div>

          <EyeForm side="od" v={v} setEye={setEye} />
          <EyeForm side="os" v={v} setEye={setEye} />
          <div className={`grid gap-3 ${method === "external" ? "grid-cols-1" : "grid-cols-2"}`}>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">Valid till</span>
              <input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} className="field" /></label>
            {method !== "external" && <label className="block"><span className="mb-1 block text-xs text-slate-500">Examined by</span>
              <input className="field" placeholder="Optional" value={examinedBy} onChange={(e) => setExaminedBy(e.target.value)} /></label>}
          </div>
          {warn.length > 0 && <ul className="space-y-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{warn.map((w) => <li key={w}>{w}</li>)}</ul>}
        </>}
      </motion.div>
    </Drawer>
  );
}
