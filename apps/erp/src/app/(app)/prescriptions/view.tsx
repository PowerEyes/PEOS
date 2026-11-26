"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, Modal, Pill, RxInput, useToast } from "@poweros/ui";
import {
  Building2,
  Camera,
  FileText,
  Pencil,
  ScanLine,
  Search,
  Plus,
  Printer,
  Copy,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  VA_DIST,
  VA_NEAR,
  emptyRx,
  fmt,
  rxStatus,
  validateRx,
  type Eye,
  type RxValues,
} from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { createPrescription } from "./actions";

type Cust = { id: string; full_name: string; phone: string; vision_id: string };
const TONE = { active: "green", expiring: "gold", expired: "red" } as const;

async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = img.width * s;
  c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
}

function Sel({
  label,
  value,
  opts,
  onChange,
  hl,
  signed,
}: {
  label: string;
  value: any;
  opts: (string | number)[];
  onChange: (v: string) => void;
  hl: boolean;
  signed?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`field py-2.5 ${hl ? "!border-gold-400 bg-amber-50 ring-2 ring-gold-400/40" : ""}`}
      >
        <option value="">-</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {signed && typeof o === "number" ? fmt(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}
function EyeCard({
  side,
  v,
  set,
  check,
}: {
  side: "od" | "os";
  v: Eye;
  set: (k: keyof Eye, val: any) => void;
  check: Set<string>;
}) {
  const od = side === "od";
  const hl = (k: string) => check.has(`${side}.${k}`);
  const axisWarn = v.cyl != null && v.axis == null;
  const cylWarn = v.axis != null && v.cyl == null;
  const any = v.sph != null || v.cyl != null || v.axis != null || v.add != null;
  const line = any
    ? `${od ? "OD" : "OS"}: ${fmt(v.sph) || "—"} / ${fmt(v.cyl) || "—"}${v.axis != null ? ` × ${v.axis}` : ""}${v.add != null ? `  ADD ${fmt(v.add)}` : ""}`
    : "";
  return (
    <div
      className={`rounded-2xl border p-3 sm:p-4 ${od ? "border-blue-200 bg-blue-50/40" : "border-orange-200 bg-orange-50/40"}`}
    >
      <p
        className={`mb-3 font-semibold ${od ? "text-blue-700" : "text-orange-600"}`}
      >
        {od ? "Right eye (OD)" : "Left eye (OS)"}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <RxInput
          label="SPH"
          kind="sph"
          value={v.sph}
          highlight={hl("sph")}
          onChange={(x) => set("sph", x)}
        />
        <RxInput
          label="CYL"
          kind="cyl"
          value={v.cyl}
          highlight={hl("cyl")}
          onChange={(x) => set("cyl", x)}
        />
        <RxInput
          label="AXIS"
          kind="axis"
          value={v.axis}
          highlight={hl("axis")}
          warn={axisWarn}
          onChange={(x) => set("axis", x)}
        />
        <RxInput
          label="ADD"
          kind="add"
          value={v.add}
          highlight={hl("add")}
          onChange={(x) => set("add", x)}
        />
        <Sel
          label="VA distance"
          value={v.va_dist}
          opts={VA_DIST}
          hl={hl("va_dist")}
          onChange={(x) => set("va_dist", x)}
        />
        <Sel
          label="VA near"
          value={v.va_near}
          opts={VA_NEAR}
          hl={hl("va_near")}
          onChange={(x) => set("va_near", x)}
        />
      </div>
      {line && (
        <p className="mt-2 font-mono text-[11px] text-slate-500">{line}</p>
      )}
      {(axisWarn || cylWarn) && (
        <p className="mt-1 text-[11px] text-amber-700">
          ⚠{" "}
          {axisWarn
            ? "Cylinder set — add the axis."
            : "Axis set but the cylinder is empty."}
        </p>
      )}
    </div>
  );
}

function RxDrawer({
  open,
  onClose,
  customers,
  presetId,
}: {
  open: boolean;
  onClose: () => void;
  customers: Cust[];
  presetId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<"start" | "scan" | "values">("start");
  const [cid, setCid] = useState<string | null>(presetId);
  const [q, setQ] = useState("");
  const [v, setV] = useState<RxValues>(emptyRx());
  const [check, setCheck] = useState<Set<string>>(new Set());
  const [blob, setBlob] = useState<Blob | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [scanning, setScanning] = useState(false);
  const [source, setSource] = useState<"manual" | "ocr" | "external">("manual");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<
    Record<string, number | null>
  >({});
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrQuality, setOcrQuality] = useState<any>(null);
  const [practice, setPractice] = useState("");
  const [meta, setMeta] = useState({
    examined_by: "",
    remarks: "",
    valid_till: new Date(Date.now() + 365 * 86400000)
      .toISOString()
      .slice(0, 10),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setStep("start");
      setCid(presetId);
      setV(emptyRx());
      setCheck(new Set());
      setBlob(null);
      setOriginalFile(null);
      setPreview("");
      setSource("manual");
      setWarn([]);
      setOcrConfidence({});
      setOcrWarnings([]);
      setOcrQuality(null);
      setPractice("");
    }
  }, [open, presetId]);
  const cust = customers.find((c) => c.id === cid);
  const list = customers
    .filter((c) =>
      `${c.full_name} ${c.phone} ${c.vision_id}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .slice(0, 6);
  const setEye = (s: "od" | "os") => (k: keyof Eye, val: any) => {
    setV((p) => ({ ...p, [s]: { ...p[s], [k]: val } }));
    setCheck((c) => {
      const n = new Set(c);
      n.delete(`${s}.${k}`);
      return n;
    });
  };

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 20_000_000) {
      toast("Choose an image under 20 MB.", "err");
      return;
    }
    const b = await shrink(f);
    setBlob(b);
    setOriginalFile(f);
    setPreview(URL.createObjectURL(b));
    setScanning(true);
    const fd = new FormData();
    fd.append("file", b, "rx.jpg");
    try {
      const r = await fetch("/api/ocr", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        toast(j.error, "err");
        setStep("values");
        return;
      }
      const f2 = new Set<string>(j.flags);
      (["od", "os"] as const).forEach((s) =>
        (Object.keys(j.values[s]) as (keyof Eye)[]).forEach(
          (k) =>
            j.values[s][k] !== null &&
            j.values[s][k] !== "" &&
            f2.add(`${s}.${k}`),
        ),
      );
      setV(j.values);
      setCheck(f2);
      setOcrConfidence(j.confidence ?? {});
      setOcrWarnings(j.warnings ?? []);
      setOcrQuality(j.quality ?? null);
      if (source !== "external") setSource("ocr");
      toast("Values read. Please confirm the gold fields.");
    } catch {
      toast("Could not reach the OCR service.", "err");
    }
    setScanning(false);
    setStep("values");
  }
  async function save() {
    const w = validateRx(v);
    setWarn(w);
    if (!cid) return toast("Choose a customer first", "err");
    if (source === "external" && !practice.trim())
      return toast("Enter the practice / doctor name", "err");
    if (source === "external" && !blob)
      return toast(
        "An external prescription needs a photo of the hard copy",
        "err",
      );
    setBusy(true);
    let image_path: string | null = null;
    if (originalFile) {
      const sb = supabaseBrowser();
      const {
        data: { user: u },
      } = await sb.auth.getUser();
      const { data: p } = await sb
        .from("profiles")
        .select("org_id")
        .eq("id", u?.id ?? "")
        .single();
      const safeExt =
        (originalFile.name.split(".").pop() || "img")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 8) || "img";
      const path = `${p?.org_id}/${crypto.randomUUID()}.${safeExt}`;
      const { error } = await sb.storage
        .from("prescriptions")
        .upload(path, originalFile, {
          contentType: originalFile.type,
          upsert: false,
        });
      if (error) {
        setBusy(false);
        return toast(
          "Could not securely save the original prescription image.",
          "err",
        );
      }
      image_path = path;
    }
    const r = await createPrescription({
      customer_id: cid,
      values: v,
      source,
      image_path,
      external_practice: source === "external" ? practice.trim() : undefined,
      ...meta,
    });
    setBusy(false);
    if (r.error) return toast(r.error, "err");
    toast(`Prescription ${r.ok} saved`);
    router.refresh();
    onClose();
  }
  const Foot =
    step === "values" ? (
      <>
        <button onClick={() => setStep("start")} className="btn btn-ghost">
          Back
        </button>
        <button disabled={busy} onClick={save} className="btn btn-gold">
          {busy ? "Saving…" : "Save prescription"}
        </button>
      </>
    ) : undefined;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New prescription"
      subtitle={
        cust
          ? `${cust.full_name} | ${cust.vision_id}`
          : "Choose a customer, then a method"
      }
      footer={Foot}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
        >
          {step === "start" && (
            <div className="space-y-5">
              {!presetId && (
                <div>
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-3.5 text-slate-400"
                    />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Find customer by name, phone or Vision ID"
                      className="field pl-9"
                    />
                  </div>
                  <div className="mt-2 space-y-1">
                    {list.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCid(c.id)}
                        className={`flex w-full justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition ${cid === c.id ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:bg-navy-50"}`}
                      >
                        <b>{c.full_name}</b>
                        <span className="text-slate-500">{c.vision_id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  disabled={!cid}
                  onClick={() => setStep("scan")}
                  className="group rounded-2xl border-2 border-gold-400/60 bg-amber-50/50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40"
                >
                  <Sparkles className="mb-2 text-gold-500" />
                  <p className="font-semibold">Upload a photo</p>
                  <p className="text-sm text-slate-500">
                    We read the values for you. You confirm them.
                  </p>
                </button>
                <button
                  disabled={!cid}
                  onClick={() => {
                    setSource("manual");
                    setStep("values");
                  }}
                  className="rounded-2xl border-2 border-slate-100 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40"
                >
                  <Pencil className="mb-2 text-navy-700" />
                  <p className="font-semibold">Fill it in myself</p>
                  <p className="text-sm text-slate-500">
                    Type the values from the eye test.
                  </p>
                </button>
                <button
                  disabled={!cid}
                  onClick={() => {
                    setSource("external");
                    setStep("values");
                  }}
                  className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40"
                >
                  <Building2 className="mb-2 text-emerald-600" />
                  <p className="font-semibold">External practice</p>
                  <p className="text-sm text-slate-500">
                    Another doctor's Rx — hard-copy photo required.
                  </p>
                </button>
              </div>
            </div>
          )}
          {step === "scan" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files[0]);
                }}
                className="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Prescription"
                    className="max-h-80 rounded-lg"
                  />
                ) : (
                  <div>
                    <UploadCloud
                      className="mx-auto mb-2 text-slate-400"
                      size={36}
                    />
                    <p className="font-medium">Drag a photo here</p>
                    <p className="text-sm text-slate-500">
                      Full prescription visible, good light, both eyes
                    </p>
                  </div>
                )}
                {scanning && (
                  <>
                    <motion.div
                      className="absolute inset-x-0 h-1 bg-gold-400 shadow-[0_0_24px_6px_rgba(217,162,94,.7)]"
                      animate={{ top: ["0%", "100%"] }}
                      transition={{
                        repeat: Infinity,
                        repeatType: "reverse",
                        duration: 1.4,
                        ease: "easeInOut",
                      }}
                    />
                    <p className="absolute bottom-3 rounded-full bg-navy-900/80 px-3 py-1 text-xs text-white">
                      Reading values…
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn btn-primary flex-1"
                >
                  <Camera size={16} />
                  Take or choose photo
                </button>
                <button
                  onClick={() => setStep("values")}
                  className="btn btn-ghost"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
          {step === "values" && (
            <div className="space-y-4">
              {source === "external" && (
                <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">
                        Practice / doctor name *
                      </span>
                      <input
                        value={practice}
                        onChange={(e) => setPractice(e.target.value)}
                        placeholder="e.g. Dr. Meena, Specs & Lenses"
                        className="field"
                      />
                    </label>
                    <div>
                      <span className="mb-1 block text-xs text-slate-500">
                        Hard-copy photo *
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="btn btn-primary !py-2 cursor-pointer">
                          <Camera size={15} />
                          {preview ? "Retake photo" : "Attach photo"}
                          <input
                            hidden
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => onFile(e.target.files?.[0])}
                          />
                        </label>
                        {preview && (
                          <img
                            src={preview}
                            alt="Hard copy"
                            className="h-14 w-14 rounded-lg border border-emerald-200 object-cover"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-700">
                    External prescriptions are stored with the practice name and
                    the photo of the paper Rx.
                  </p>
                </div>
              )}
              {check.size > 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  <ScanLine size={16} />
                  Gold fields were read from the photo. Change any that are
                  wrong. Optometrist review is required.
                </p>
              )}
              {ocrQuality && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p>
                    Image quality:{" "}
                    {ocrQuality.blurred
                      ? "blur detected — verify values carefully"
                      : "blur check passed"}
                    {ocrQuality.orientation_corrected
                      ? ` · rotated ${ocrQuality.rotation_correction_degrees}°`
                      : ""}
                  </p>
                  {Object.entries(ocrConfidence).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      {Object.entries(ocrConfidence).map(([key, value]) => (
                        <span
                          key={key}
                          className={
                            value == null || value < 0.75
                              ? "text-amber-800"
                              : "text-emerald-700"
                          }
                        >
                          {key.toUpperCase()}:{" "}
                          {value == null
                            ? "not read"
                            : `${Math.round(value * 100)}%`}
                        </span>
                      ))}
                    </div>
                  )}
                  {ocrWarnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-800">
                      {ocrWarnings.map((w, i) => (
                        <li key={`${i}-${w}`}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {v.od.sph != null &&
                v.os.sph != null &&
                Math.abs(v.od.sph - v.os.sph) > 3 && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    ⚠ The two eyes differ by more than 3.00 D. Please re-check.
                  </p>
                )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Type values or use ▲▼ / ↑↓ (±0.25, Shift = ±1.00).
                </span>
                <button
                  onClick={() => setV((p) => ({ ...p, os: { ...p.od } }))}
                  className="btn btn-ghost !py-1.5 text-xs"
                >
                  <Copy size={13} />
                  Copy right eye to left
                </button>
              </div>
              <EyeCard side="od" v={v.od} set={setEye("od")} check={check} />
              <EyeCard side="os" v={v.os} set={setEye("os")} check={check} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">
                    PD far (mm)
                  </span>
                  <input
                    type="number"
                    step=".5"
                    value={v.pd_far ?? ""}
                    onChange={(e) =>
                      setV({
                        ...v,
                        pd_far: e.target.value ? +e.target.value : null,
                      })
                    }
                    className="field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">
                    PD near (mm)
                  </span>
                  <input
                    type="number"
                    step=".5"
                    value={v.pd_near ?? ""}
                    onChange={(e) =>
                      setV({
                        ...v,
                        pd_near: e.target.value ? +e.target.value : null,
                      })
                    }
                    className="field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">
                    Examined by
                  </span>
                  <input
                    value={meta.examined_by}
                    onChange={(e) =>
                      setMeta({ ...meta, examined_by: e.target.value })
                    }
                    className="field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">
                    Valid till
                  </span>
                  <input
                    type="date"
                    value={meta.valid_till}
                    onChange={(e) =>
                      setMeta({ ...meta, valid_till: e.target.value })
                    }
                    className="field"
                  />
                </label>
              </div>
              <textarea
                value={meta.remarks}
                maxLength={300}
                onChange={(e) => setMeta({ ...meta, remarks: e.target.value })}
                placeholder="Remarks"
                rows={2}
                className="field"
              />
              {warn.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  {warn.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Drawer>
  );
}

function Detail({ r, onClose }: { r: any | null; onClose: () => void }) {
  const [img, setImg] = useState("");
  useEffect(() => {
    setImg("");
    if (r?.image_path)
      supabaseBrowser()
        .storage.from("prescriptions")
        .createSignedUrl(r.image_path, 300)
        .then(({ data }) => setImg(data?.signedUrl ?? ""));
  }, [r?.id]);
  if (!r)
    return <Modal open={false} onClose={onClose} title="" children={null} />;
  const eyeRow = (s: "od" | "os") => (
    <div
      className={`rounded-2xl border p-4 ${s === "od" ? "border-blue-200 bg-blue-50/40" : "border-orange-200 bg-orange-50/40"}`}
    >
      <p
        className={`mb-2 font-semibold ${s === "od" ? "text-blue-700" : "text-orange-600"}`}
      >
        {s === "od" ? "Right eye (OD)" : "Left eye (OS)"}
      </p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {[
          ["SPH", fmt(r[`${s}_sph`])],
          ["CYL", fmt(r[`${s}_cyl`])],
          ["AXIS", r[`${s}_axis`] ?? ""],
          ["ADD", fmt(r[`${s}_add`])],
          ["VA dist", r[`${s}_va_dist`]],
          ["VA near", r[`${s}_va_near`]],
        ].map(([k, x]) => (
          <div key={k as string}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="font-semibold">{x || "-"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  const site = process.env.NEXT_PUBLIC_WEB_URL ?? "https://powereyes.in";
  const num = (r.customers?.whatsapp || r.customers?.phone || "")
    .replace(/\D/g, "")
    .slice(-10);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Prescription ${r.rx_code}`}
      subtitle={`${r.customers?.full_name} | ${r.customers?.vision_id}`}
    >
      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {eyeRow("od")}
          {eyeRow("os")}
        </div>
        <p className="text-sm text-slate-600">
          PD far {r.pd_far ?? "-"} mm | PD near {r.pd_near ?? "-"} mm | Examined
          by {r.examined_by || "-"} | Valid till{" "}
          {new Date(r.valid_till).toLocaleDateString("en-IN")}
        </p>
        {r.remarks && <p className="text-sm">{r.remarks}</p>}
        {img && (
          <img
            src={img}
            alt="Original"
            className="max-h-56 rounded-xl border"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/print/rx/${r.id}`}
            target="_blank"
            className="btn btn-primary"
          >
            <Printer size={16} />
            Print A5
          </a>
          <WhatsAppSend
            phone={num}
            doc={{ type: "rx", id: r.id }}
            keys={["rx_share"]}
            defaultKey="rx_share"
            className="btn btn-ghost text-emerald-700"
            vars={{
              Name: r.customers?.full_name ?? "",
              "Rx Code": r.rx_code,
              "Valid Till": new Date(r.valid_till).toLocaleDateString("en-IN"),
              Link: `${site}/my/prescriptions`,
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

export function RxView({
  rows,
  customers,
}: {
  rows: any[];
  customers: Cust[];
}) {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<any | null>(null);
  useEffect(() => {
    if (sp.get("new")) setOpen(true);
  }, [sp]);
  const f = rows.filter((r) =>
    `${r.rx_code} ${r.customers?.full_name} ${r.customers?.phone}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            Prescriptions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {rows.length} on record
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="btn btn-primary self-start sm:self-auto"
        >
          <Plus size={16} />
          New prescription
        </button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field pl-9"
          placeholder="Search by Rx number, name or phone"
        />
      </div>
      {f.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          <FileText className="mx-auto mb-2" />
          No prescriptions yet. Add one by photo or by hand.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {f.map((r) => {
            const s = rxStatus(r.valid_till);
            return (
              <button
                key={r.id}
                onClick={() => setSel(r)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-navy-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {r.customers?.full_name}{" "}
                    <span className="font-normal text-slate-500">
                      {r.rx_code}
                    </span>
                  </span>
                  <span className="block text-xs text-slate-500">
                    OD {fmt(r.od_sph)} {fmt(r.od_cyl)} | OS {fmt(r.os_sph)}{" "}
                    {fmt(r.os_cyl)} |{" "}
                    {new Date(r.rx_date).toLocaleDateString("en-IN")}
                  </span>
                </span>
                {r.source === "ocr" && <Pill tone="purple">Photo</Pill>}
                <Pill tone={TONE[s]}>{s}</Pill>
              </button>
            );
          })}
        </div>
      )}
      <RxDrawer
        open={open}
        onClose={() => setOpen(false)}
        customers={customers}
        presetId={sp.get("customer")}
      />
      <Detail r={sel} onClose={() => setSel(null)} />
    </div>
  );
}
