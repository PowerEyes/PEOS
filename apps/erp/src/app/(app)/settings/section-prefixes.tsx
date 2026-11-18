"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Hash } from "lucide-react";
import { savePrefixes } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard } from "./ui";

// Key = next_code p_key passed by the DB triggers; def = the built-in default.
const PREFIX_DEFAULTS: Array<{ key: string; label: string; def: string }> = [
  { key: "customer", label: "Customer code", def: "CUS-" },
  { key: "vision", label: "Vision ID", def: "VIS-" },
  { key: "rx", label: "Prescription", def: "RX-" },
  { key: "sale_order", label: "Order", def: "ORD-" },
  { key: "sale_quotation", label: "Quotation", def: "Q-" },
  { key: "lab", label: "Lab job", def: "LAB-" },
  { key: "credit_note", label: "Credit note", def: "CN-" },
  { key: "repair", label: "Repair ticket", def: "REP-" },
  { key: "sku_frame", label: "SKU — frames", def: "FRM-" },
  { key: "sku_sunglass", label: "SKU — sunglasses", def: "SUN-" },
  { key: "sku_contact_lens", label: "SKU — contact lenses", def: "CL-" },
  { key: "sku_accessory", label: "SKU — accessories", def: "ACC-" },
];

export function PrefixesSection({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(PREFIX_DEFAULTS.map((p) => [p.key, settings.codePrefixes[p.key] ?? ""])));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await savePrefixes(f);
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <SectionCard title="Code Prefixes" icon={Hash}
      footer={canEdit ? (
        <button disabled={busy} onClick={save} className="btn btn-gold">
          {busy ? "Saving…" : "Save prefixes"}
        </button>) : <p className="text-xs text-slate-400">Only owners and admins can change these settings.</p>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PREFIX_DEFAULTS.map((p) => (
          <L key={p.key} t={p.label} hint={`Default: ${p.def}`}>
            <input className="field" value={f[p.key]} disabled={!canEdit} placeholder={p.def}
              onChange={(e) => setF({ ...f, [p.key]: e.target.value })} />
          </L>))}
      </div>
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        Blank = keep the default. New codes pick these up immediately (e.g. <b>REP-0001</b>, <b>FRM-0007</b>); codes already issued never change.
      </p>
    </SectionCard>);
}
