"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Sliders } from "lucide-react";
import { saveSettings } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard } from "./ui";

export function SalesSection({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [maxDiscount, setMaxDiscount] = useState(String(settings.maxDiscount));
  const [quoteDays, setQuoteDays] = useState(String(settings.quoteDays));
  const [labDays, setLabDays] = useState(String(settings.labDays));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await saveSettings({
      maxDiscount: Number(maxDiscount),
      quoteDays: Number(quoteDays),
      labDays: Number(labDays),
    });
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <SectionCard title="Sales & Lab" icon={Sliders}
      footer={canEdit ? (
        <button disabled={busy} onClick={save} className="btn btn-gold">
          {busy ? "Saving…" : "Save sales settings"}
        </button>) : <p className="text-xs text-slate-400">Only owners and admins can change these settings.</p>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <L t="Max staff discount (%)" hint="Caps the discount staff can apply in POS.">
          <input type="number" min={0} max={100} className="field" value={maxDiscount} disabled={!canEdit}
            onChange={(e) => setMaxDiscount(e.target.value)} />
        </L>
        <L t="Quotation valid (days)" hint="New quotations expire after this many days.">
          <input type="number" min={1} className="field" value={quoteDays} disabled={!canEdit}
            onChange={(e) => setQuoteDays(e.target.value)} />
        </L>
        <L t="Lab lead time (days)" hint="Promised turnaround for glazed orders.">
          <input type="number" min={1} className="field" value={labDays} disabled={!canEdit}
            onChange={(e) => setLabDays(e.target.value)} />
        </L>
      </div>
    </SectionCard>);
}
