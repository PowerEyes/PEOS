"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { BriefcaseBusiness } from "lucide-react";
import { saveBusinessProfile } from "@/app/(app)/settings-actions";
import { L, SectionCard } from "./ui";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export function BusinessProfileSection({
  value,
  canEdit,
}: {
  value: any;
  canEdit: boolean;
}) {
  const router = useRouter(),
    toast = useToast();
  const [f, setF] = useState({
      legal_name: value?.legal_name ?? "",
      business_email: value?.business_email ?? "",
      business_phone: value?.business_phone ?? "",
      billing_address: value?.billing_address ?? "",
      timezone: value?.timezone ?? "Asia/Kolkata",
      financial_year_start_month: Number(
        value?.financial_year_start_month ?? 4,
      ),
    }),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await saveBusinessProfile(f);
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }
  return (
    <SectionCard
      title="Legal and regional profile"
      icon={BriefcaseBusiness}
      footer={
        canEdit ? (
          <button disabled={busy} onClick={save} className="btn btn-gold">
            {busy ? "Saving…" : "Save business profile"}
          </button>
        ) : null
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <L t="Registered / legal name">
          <input
            className="field"
            value={f.legal_name}
            disabled={!canEdit}
            onChange={(e) => setF({ ...f, legal_name: e.target.value })}
          />
        </L>
        <L t="Business email">
          <input
            type="email"
            className="field"
            value={f.business_email}
            disabled={!canEdit}
            onChange={(e) => setF({ ...f, business_email: e.target.value })}
          />
        </L>
        <L t="Business phone">
          <input
            type="tel"
            className="field"
            value={f.business_phone}
            disabled={!canEdit}
            onChange={(e) => setF({ ...f, business_phone: e.target.value })}
          />
        </L>
        <L t="Timezone" hint="Used for local business schedules and reporting.">
          <input
            className="field"
            value={f.timezone}
            disabled={!canEdit}
            placeholder="Asia/Kolkata"
            onChange={(e) => setF({ ...f, timezone: e.target.value })}
          />
        </L>
        <div className="sm:col-span-2">
          <L t="Billing address">
            <textarea
              className="field"
              rows={2}
              value={f.billing_address}
              disabled={!canEdit}
              onChange={(e) => setF({ ...f, billing_address: e.target.value })}
            />
          </L>
        </div>
        <L t="Financial year starts in">
          <select
            className="field"
            value={f.financial_year_start_month}
            disabled={!canEdit}
            onChange={(e) =>
              setF({ ...f, financial_year_start_month: Number(e.target.value) })
            }
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </L>
        <L
          t="Currency"
          hint="PowerOS GST and Razorpay checkout currently operate in INR."
        >
          <input
            className="field"
            value="INR — Indian Rupee"
            disabled
            readOnly
          />
        </L>
      </div>
    </SectionCard>
  );
}
