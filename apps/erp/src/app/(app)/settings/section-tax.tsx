"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Receipt } from "lucide-react";
import { saveSettings } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard, Switch } from "./ui";

export function TaxSection({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [gst, setGst] = useState(settings.gst);
  const [gstin, setGstin] = useState(settings.gstin);
  const [footer, setFooter] = useState(settings.invoiceFooter);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await saveSettings({ gst, gstin, invoiceFooter: footer });
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <SectionCard title="Tax & Invoicing" icon={Receipt}
      footer={canEdit ? (
        <button disabled={busy} onClick={save} className="btn btn-gold">
          {busy ? "Saving…" : "Save tax settings"}
        </button>) : <p className="text-xs text-slate-400">Only owners and admins can change these settings.</p>}>
      <Switch on={gst} set={canEdit ? setGst : () => {}} label="GST enabled"
        hint={gst ? "New invoices show CGST/SGST or IGST and print as Tax Invoice." : "No tax on new invoices. They print as Bill of Supply."} />
      {gst && (
        <L t="GSTIN (printed on every Tax Invoice)">
          <input className="field" maxLength={15} value={gstin} disabled={!canEdit}
            onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="33ABCDE1234F1Z5" />
        </L>)}
      <L t="Invoice footer note" hint="Optional message printed at the bottom of every invoice.">
        <textarea className="field" rows={2} value={footer} disabled={!canEdit}
          onChange={(e) => setFooter(e.target.value)} placeholder="Thank you for shopping with Power Eyes Opticals!" />
      </L>
    </SectionCard>);
}
