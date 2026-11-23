"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Receipt } from "lucide-react";
import { saveSettings } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard, Switch } from "./ui";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export function TaxSection({
  settings,
  canEdit,
}: {
  settings: AppSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [gst, setGst] = useState(settings.gst);
  const [gstin, setGstin] = useState(settings.gstin);
  const [footer, setFooter] = useState(settings.invoiceFooter);
  const [supply, setSupply] = useState(settings.defaultSupplyType);
  const [state, setState] = useState(settings.defaultStateOfSupply);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await saveSettings({
      gst,
      gstin,
      invoiceFooter: footer,
      defaultSupplyType: supply,
      defaultStateOfSupply: state,
    });
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <SectionCard
      title="Tax & Invoicing"
      icon={Receipt}
      footer={
        canEdit ? (
          <button disabled={busy} onClick={save} className="btn btn-gold">
            {busy ? "Saving…" : "Save tax settings"}
          </button>
        ) : (
          <p className="text-xs text-slate-400">
            Only owners and admins can change these settings.
          </p>
        )
      }
    >
      <Switch
        on={gst}
        set={canEdit ? setGst : () => {}}
        label="GST enabled"
        hint={
          gst
            ? "New invoices show CGST/SGST or IGST and print as Tax Invoice."
            : "No tax on new invoices. They print as Bill of Supply."
        }
      />
      {gst && (
        <L t="GSTIN (printed on every Tax Invoice)">
          <input
            className="field"
            maxLength={15}
            value={gstin}
            disabled={!canEdit}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="33ABCDE1234F1Z5"
          />
        </L>
      )}
      <L
        t="Invoice footer note"
        hint="Optional message printed at the bottom of every invoice."
      >
        <textarea
          className="field"
          rows={2}
          value={footer}
          disabled={!canEdit}
          onChange={(e) => setFooter(e.target.value)}
          placeholder="Thank you for shopping with Power Eyes Opticals!"
        />
      </L>
      <div className="grid gap-3 sm:grid-cols-2">
        <L
          t="Default place of supply"
          hint="Applied to new ERP sales; staff can change the intra/inter-state supply type in POS where appropriate."
        >
          <select
            className="field"
            value={state}
            disabled={!canEdit}
            onChange={(e) => setState(e.target.value)}
          >
            {INDIAN_STATES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </L>
        <L t="Default GST supply type">
          <select
            className="field"
            value={supply}
            disabled={!canEdit}
            onChange={(e) =>
              setSupply(e.target.value as "intrastate" | "interstate")
            }
          >
            <option value="intrastate">Intra-state (CGST + SGST)</option>
            <option value="interstate">Inter-state (IGST)</option>
          </select>
        </L>
      </div>
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        GST rates and inclusive/exclusive pricing are set on catalogue products.
        Verify supply type and place of supply for each transaction; this
        default is not tax advice.
      </p>
    </SectionCard>
  );
}
