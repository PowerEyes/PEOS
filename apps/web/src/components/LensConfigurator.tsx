"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Camera, FileText, Pencil, Sparkles, UploadCloud, Check, ScanLine, AlertCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { inr } from "@/lib/types";
import { useCart } from "@/lib/cart";
import {
  FALLBACK_LENS_USAGE,
  mapLensUsage,
  shouldShowAdd,
  usageByCode,
  type LensUsage,
} from "@/lib/lens-usage";
import { needsPrescription, prescriptionIsComplete, toRxSnapshot } from "@/lib/prescription";

const STEPS = ["Usage", "Prescription", "Lens", "Add-Ons"] as const;
type Step = (typeof STEPS)[number];
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/50">
      <div className="sm:hidden flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-800 text-[11px] font-bold text-white">{step + 1}</span>
          <span className="text-xs font-bold text-navy-900">{STEPS[step]}</span>
          <span className="text-[11px] text-slate-400">({step + 1} of {STEPS.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-gold-500" : i < step ? "w-2.5 bg-navy-800" : "w-2.5 bg-slate-200"}`} />
          ))}
        </div>
      </div>
      <div className="hidden sm:flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-initial">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${i < step ? "bg-navy-800 text-white" : i === step ? "bg-gold-500 text-white" : "bg-slate-100 text-slate-400"}`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`ml-2 text-xs sm:text-sm font-medium whitespace-nowrap ${i === step ? "text-navy-900 font-bold" : "text-slate-400"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`mx-2 sm:mx-3 h-px flex-1 ${i < step ? "bg-navy-800" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function RxForm({
  values, onChange, showAdd, addRequired,
}: {
  values: any;
  onChange: (v: any) => void;
  showAdd: boolean;
  addRequired: boolean;
}) {
  const fields: [string, string][] = [["sph", "SPH"], ["cyl", "CYL"], ["axis", "AXIS"]];
  if (showAdd) fields.push(["add", "ADD"]);
  return (
    <div className="space-y-3">
      {([["od", "Right Eye (OD)", "blue"], ["os", "Left Eye (OS)", "orange"]] as const).map(([side, label, col]) => (
        <div key={side} className={`rounded-2xl border p-3 sm:p-4 ${col === "blue" ? "border-blue-200 bg-blue-50/40" : "border-orange-200 bg-orange-50/40"}`}>
          <p className={`font-semibold mb-2.5 text-xs sm:text-sm ${col === "blue" ? "text-blue-700" : "text-orange-600"}`}>{label}</p>
          <div className={`grid gap-1.5 sm:gap-2 ${showAdd ? "grid-cols-4" : "grid-cols-3"}`}>
            {fields.map(([k, l]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-[11px] sm:text-xs text-slate-500">
                  {l}{addRequired && k === "add" && <span className="ml-0.5 text-rose-500">*</span>}
                </span>
                <input
                  type="number"
                  step={k === "axis" ? "1" : "0.25"}
                  min={k === "axis" ? 0 : undefined}
                  max={k === "axis" ? 180 : undefined}
                  value={values?.[side]?.[k] ?? ""}
                  onChange={(e) => onChange({
                    ...values,
                    [side]: { ...values?.[side], [k]: e.target.value ? Number(e.target.value) : null },
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-1.5 py-2 text-center text-xs sm:px-2 sm:text-sm outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/10"
                  placeholder={k === "cyl" || k === "add" ? "0.00" : undefined}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">PD far (mm)</span>
          <input type="number" step="0.5" value={values?.pd_far ?? ""} onChange={(e) => onChange({ ...values, pd_far: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm outline-none focus:border-navy-700" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">PD near (mm)</span>
          <input type="number" step="0.5" value={values?.pd_near ?? ""} onChange={(e) => onChange({ ...values, pd_near: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm outline-none focus:border-navy-700" />
        </label>
      </div>
      {addRequired && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          ADD power is required for progressive, readers and bifocal lenses. Enter it for both eyes.
        </p>
      )}
    </div>
  );
}

export function LensConfigurator({ open, onClose, product }: { open: boolean; onClose: () => void; product?: any }) {
  const { add } = useCart();
  const [step, setStep] = useState(0);
  const [usage, setUsage] = useState("");
  const [usageOptions, setUsageOptions] = useState<LensUsage[]>(FALLBACK_LENS_USAGE);
  const [rxMethod, setRxMethod] = useState("");
  const [rxValues, setRxValues] = useState<any>({});
  const [rxFile, setRxFile] = useState<File | null>(null);
  const [rxPreview, setRxPreview] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [ocrFlags, setOcrFlags] = useState<string[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [selPkg, setSelPkg] = useState("");
  const [selIdx, setSelIdx] = useState("");
  const [selAddons, setSelAddons] = useState<string[]>([]);
  const [lensTab, setLensTab] = useState("Recommended");

  const selectedUsage = usageByCode(usageOptions, usage);
  const needsRx = needsPrescription(selectedUsage);
  const showAdd = shouldShowAdd(selectedUsage);
  const addRequired = Boolean(selectedUsage?.requires_add);

  // Reset on close; fetch the whole catalogue as soon as the modal opens so
  // nobody waits until the third step to discover the lenses are still loading.
  useEffect(() => {
    if (open) return;
    setStep(0);
    setUsage("");
    setRxMethod("");
    setRxValues({});
    setRxFile(null);
    setRxPreview("");
    setOcrError("");
    setSelPkg("");
    setSelIdx("");
    setSelAddons([]);
    setLensTab("Recommended");
    setCatalogueReady(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const sb = supabaseBrowser();
    setCatalogueReady(false);
    Promise.all([
      sb.from("website_lens_usage").select("*").eq("is_active", true).order("display_order"),
      sb.from("lens_packages").select("*").eq("status", "active").order("display_order"),
      sb.from("lens_options").select("*").eq("status", "active").order("display_order"),
    ]).then(([usageRes, pkgRes, optRes]) => {
      if (!alive) return;
      const mapped = (usageRes.data ?? []).map(mapLensUsage).filter(Boolean) as LensUsage[];
      if (mapped.length) setUsageOptions(mapped);
      const pkgList = (pkgRes.data ?? []) as any[];
      const optList = (optRes.data ?? []) as any[];
      setPackages(pkgList);
      setOptions(optList);
      setSelPkg((current) => current || pkgList[0]?.id || "");
      setSelIdx((current) => current || (optList.find((o: any) => o.grp === "index")?.id ?? ""));
      setCatalogueReady(true);
    }).catch(() => {
      if (!alive) return;
      setUsageOptions(FALLBACK_LENS_USAGE);
      setCatalogueReady(true);
    });
    return () => { alive = false; };
  }, [open]);

  const preferredPackages = useMemo(() => {
    const design = selectedUsage?.default_design;
    if (!design) return packages;
    return [...packages].sort((a, b) => Number(b.design === design) - Number(a.design === design));
  }, [packages, selectedUsage?.default_design]);
  const visiblePackages = lensTab === "Recommended" ? preferredPackages : packages;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setOcrError("");
    if (!file.type.startsWith("image/")) {
      setOcrError("Upload a JPG or PNG image. PDFs aren't supported by prescription scanning.");
      return;
    }
    if (file.size > 8_000_000) {
      setOcrError("That image is over 8 MB. Please upload a smaller photo.");
      return;
    }
    setRxFile(file);
    setRxPreview(URL.createObjectURL(file));
    setRxMethod("upload");
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not read that prescription.");
      setRxValues(json.values ?? {});
      setOcrFlags(json.flags ?? []);
      setStep(1); // stay on the reviewable prescription step
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Could not read that prescription. Enter it manually instead.");
    } finally {
      setScanning(false);
    }
  }

  const pkg = packages.find((p) => p.id === selPkg);
  const idxOpts = options.filter((o) => o.grp === "index");
  const addonOpts = options.filter((o) => o.grp === "addon");
  const selIdxObj = options.find((o) => o.id === selIdx);
  const selAddonObjs = selAddons.map((id) => options.find((o) => o.id === id)).filter(Boolean) as any[];
  const lensTotal = pkg ? Number(pkg.base_price) + Number(selIdxObj?.price ?? 0) + selAddonObjs.reduce((sum: number, o: any) => sum + Number(o.price), 0) : 0;
  const framePrice = Number(product?.selling_price ?? 0);
  const total = framePrice + lensTotal;

  const rxComplete = !needsRx || Boolean(rxMethod && prescriptionIsComplete(selectedUsage, rxValues));
  const canContinue = step === 0 ? Boolean(usage)
    : step === 1 ? rxComplete
    : step === 2 ? Boolean(pkg)
    : Boolean(pkg);
  const nextHint = step === 1 && !rxComplete && selectedUsage?.requires_add
    ? "Enter ADD power for both eyes to continue."
    : step === 1 && !rxComplete
      ? "Choose how to add your prescription and complete both eyes."
      : step === 2 && !pkg
        ? "Loading lens packages…"
        : "";

  function addToCart() {
    if (!pkg || !canContinue || !catalogueReady) return;
    const savedRx = needsRx ? {
      ...rxValues,
      od: { ...(rxValues?.od ?? {}), add: showAdd ? rxValues?.od?.add ?? null : null },
      os: { ...(rxValues?.os ?? {}), add: showAdd ? rxValues?.os?.add ?? null : null },
    } : null;
    const optionIds = [...(selIdxObj ? [selIdxObj.id] : []), ...selAddonObjs.map((o) => o.id)];
    const frameItem = {
      id: uid(),
      productId: product?.id,
      productName: `${product?.brand ?? ""} ${product?.model ?? ""}`.trim(),
      brand: product?.brand,
      image: product?.images?.[0],
      framePrice,
      lensTotal: 0,
      total: framePrice,
      qty: 1,
      power_eligible: true,
    };
    const lensItem = {
      id: uid(),
      productName: `${product?.brand ?? ""} ${product?.model ?? ""}`.trim() + " lenses",
      brand: product?.brand,
      image: product?.images?.[0],
      framePrice: 0,
      lensTotal,
      lensPackageId: pkg.id,
      lensPackageName: pkg.name,
      addons: selAddonObjs.map((o: any) => o.name),
      optionIds,
      total: lensTotal,
      qty: 1,
      power_eligible: true,
      usage,
      requires_rx: needsRx,
      requires_add: addRequired,
      rx: savedRx,
      rx_snapshot: savedRx ? toRxSnapshot(savedRx, selectedUsage) : null,
    };
    add(frameItem);
    add(lensItem);
    onClose();
    window.location.href = "/cart";
  }

  const stepContent: Record<number, React.ReactNode> = {
    0: (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">How will you use your glasses?</p>
        <p className="text-xs text-slate-500">Help us choose the right lenses for your prescription and lifestyle.</p>
        {!catalogueReady && <p className="text-xs text-blue-600">Loading your lens choices…</p>}
        <div className="space-y-2">
          {usageOptions.map((u) => (
            <button key={u.code} onClick={() => setUsage(u.code)} aria-pressed={usage === u.code}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${usage === u.code ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-300"}`}>
              <span className="mt-0.5 shrink-0 text-lg">{u.ai ? <Sparkles size={16} className="text-gold-500" /> : u.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{u.label}</span>
                <span className="block text-xs text-slate-500">{u.description}</span>
                {u.requires_add && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">ADD power required</span>}
              </span>
              {usage === u.code && <Check size={16} className="ml-auto mt-0.5 shrink-0 text-gold-500" />}
            </button>
          ))}
        </div>
      </div>
    ),

    1: (
      <div className="space-y-4">
        {!needsRx ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            No prescription is needed for non-prescription lenses. Continue to choose your lenses.
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700">Choose how to add your prescription</p>
            <div className="space-y-2">
              {([
                { key: "upload", icon: Camera, label: "Upload a photo", desc: "Upload a clear photo of your prescription." },
                { key: "manual", icon: Pencil, label: "Fill it out myself", desc: "Enter your prescription details manually." },
              ] as const).map((m) => (
                <button key={m.key} onClick={() => setRxMethod(m.key)} aria-pressed={rxMethod === m.key}
                  className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${rxMethod === m.key ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-300"}`}>
                  <m.icon size={18} className={rxMethod === m.key ? "text-gold-500" : "text-slate-500"} />
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-sm">{m.label}</span><span className="block text-xs text-slate-500">{m.desc}</span></span>
                  {rxMethod === m.key && <Check size={16} className="ml-auto shrink-0 text-gold-500" />}
                </button>
              ))}
            </div>
            {rxMethod === "upload" && (
              <div className="space-y-3">
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
                  onClick={() => document.getElementById("rx-file")?.click()}
                  className="relative grid min-h-40 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
                  {rxPreview
                    ? <img src={rxPreview} alt="Prescription preview" className="max-h-40 rounded-xl object-contain" />
                    : <div><UploadCloud size={30} className="mx-auto mb-2 text-slate-400" /><p className="text-sm font-medium">Drag or click to upload</p><p className="mt-1 text-xs text-slate-400">JPG or PNG · Max 8 MB</p></div>}
                  {scanning && <div className="absolute inset-0 flex items-end justify-center rounded-2xl bg-black/10 pb-3"><div className="rounded-full bg-navy-900/90 px-3 py-1 text-xs text-white"><ScanLine size={12} className="mr-1 inline" />Reading values…</div></div>}
                </div>
                <input id="rx-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <button onClick={() => document.getElementById("rx-file-cam")?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 py-3 text-sm font-medium hover:border-navy-700 transition"><Camera size={16} />Take a photo</button>
                <input id="rx-file-cam" type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
            )}
            {ocrError && <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={14} className="mt-0.5 shrink-0" />{ocrError}</p>}
            {(rxMethod === "manual" || (rxMethod === "upload" && Object.keys(rxValues ?? {}).length > 0)) && (
              <>
                {rxMethod === "upload" && <p className="text-xs font-semibold text-emerald-700">We've read these values. Check them and add anything the scan missed.</p>}
                <RxForm values={rxValues} onChange={setRxValues} showAdd={showAdd} addRequired={addRequired} />
                {ocrFlags.length > 0 && <p className="text-xs text-slate-500">Scan notes: {ocrFlags.join(", ")}</p>}
              </>
            )}
            {rxMethod === "manual" && addRequired && !rxValues?.od?.add && (
              <p className="text-xs text-amber-700">ADD power is required for {selectedUsage?.label}.</p>
            )}
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Have prism values? Enter them manually from your prescription if noted. Single Vision does not need ADD power.
            </p>
          </>
        )}
      </div>
    ),

    2: (
      <div className="space-y-4">
        <p className="text-sm font-semibold">What type of lens do you need?</p>
        <p className="text-xs text-slate-500">
          {catalogueReady ? "Choose from the packages available for your prescription." : "Loading packages…"}
        </p>
        <div className="flex gap-2">
          {["Recommended", "All Lenses"].map((t) => (
            <button key={t} onClick={() => setLensTab(t)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium ${lensTab === t ? "bg-navy-900 text-white border-navy-900" : "border-slate-200 text-slate-600 hover:border-navy-700"}`}>
              {t}
            </button>
          ))}
        </div>
        {!catalogueReady && <p className="py-8 text-center text-sm text-slate-400">Loading packages…</p>}
        {catalogueReady && visiblePackages.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No lens packages are available right now.</p>}
        <div className="space-y-2">
          {visiblePackages.map((p) => (
            <button key={p.id} onClick={() => setSelPkg(p.id)} aria-pressed={selPkg === p.id}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${selPkg === p.id ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-200"}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-200 to-blue-400 text-lg">🔭</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs capitalize text-slate-500">{p.design?.replaceAll("_", " ")}{p.short_desc ? ` | ${p.short_desc}` : ""}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(p.features ?? []).slice(0, 3).map((f: string) => <span key={f} className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] text-navy-700">✓ {f}</span>)}
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold text-gold-600">+{inr(p.base_price)}</span>
            </button>
          ))}
        </div>
        {idxOpts.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold">Select a lens index</p>
            <div className="space-y-2">
              {idxOpts.map((o) => (
                <button key={o.id} onClick={() => setSelIdx(o.id)} aria-pressed={selIdx === o.id}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${selIdx === o.id ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-200"}`}>
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-blue-100" />
                  <div className="flex-1"><p className="text-sm font-semibold">{o.name}</p><p className="text-xs text-slate-500">{o.description}</p></div>
                  <span className="text-sm font-semibold text-navy-800">{Number(o.price) > 0 ? `+${inr(o.price)}` : "Included"}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    ),

    3: (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Add-Ons <span className="font-normal text-slate-500">(optional)</span></p>
        <p className="text-xs text-slate-500">Customise your lenses for extra comfort and protection.</p>
        <div className="space-y-2">
          {addonOpts.map((o) => {
            const on = selAddons.includes(o.id);
            return (
              <button key={o.id} onClick={() => setSelAddons(on ? selAddons.filter((x) => x !== o.id) : [...selAddons, o.id])} aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-200"}`}>
                <div className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition ${on ? "border-gold-500 bg-gold-500" : ""}`}>{on && <Check size={12} className="text-white" />}</div>
                <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-blue-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{o.name} {o.badge && <span className="ml-1 rounded bg-amber-200 px-1.5 text-[10px] font-bold text-amber-900">{o.badge}</span>}</p>
                  <p className="truncate text-xs text-slate-500">{o.description}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-navy-800">{Number(o.price) > 0 ? `+${inr(o.price)}` : "Included"}</span>
              </button>
            );
          })}
          {!catalogueReady && <p className="py-6 text-center text-sm text-slate-400">Loading add-ons…</p>}
        </div>
      </div>
    ),
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div className="relative flex h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-3xl"
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex min-w-0 items-center gap-2 pr-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg sm:h-10 sm:w-10 sm:text-xl">👓</div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-navy-900 sm:text-sm">{product?.brand} {product?.model}</p>
                    <p className="truncate text-[11px] text-slate-500">{product?.attrs?.color} · {product?.attrs?.size} · {product?.sku}</p>
                  </div>
                </div>
                <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-full bg-slate-100 p-1.5 sm:p-2 hover:bg-slate-200"><X size={16} /></button>
              </div>
              <ProgressBar step={step} />
              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
                    {stepContent[step]}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                {step > 0 && step < 3 && (
                  <div className="mb-3 rounded-xl border border-slate-100 bg-white p-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Frame</span><span className="font-semibold">{inr(framePrice)}</span></div>
                    {lensTotal > 0 && <div className="flex justify-between"><span className="text-slate-500">Lenses</span><span className="font-semibold">+{inr(lensTotal)}</span></div>}
                    <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-bold"><span>Total</span><span>{inr(total)}</span></div>
                  </div>
                )}
                {nextHint && <p className="mb-2 text-center text-xs text-amber-700">{nextHint}</p>}
                <div className="flex gap-3">
                  {step > 0 && <button onClick={() => setStep((s) => s - 1)} className="btn-ghost flex-1 rounded-full border border-slate-200 py-3 text-sm font-medium">← Back</button>}
                  {step < 3 ? (
                    <button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canContinue}
                      className="flex-1 rounded-full bg-navy-900 py-3 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50">
                      Continue →
                    </button>
                  ) : (
                    <button onClick={addToCart} disabled={!canContinue || !catalogueReady}
                      className="flex-1 rounded-full bg-gold-500 py-3 text-sm font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50">
                      Add to Cart → {inr(total)}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
