"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@poweros/ui";
import { Activity, Plug } from "lucide-react";
import { saveAnalytics } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard } from "./ui";

export function IntegrationsSection({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [ga, setGa] = useState(settings.analyticsId);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await saveAnalytics(ga);
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Website analytics" icon={Activity}
        footer={canEdit ? (
          <button disabled={busy} onClick={save} className="btn btn-gold">
            {busy ? "Saving…" : "Save analytics"}
          </button>) : <p className="text-xs text-slate-400">Only owners and admins can change these settings.</p>}>
        <L t="Analytics ID" hint="Google Analytics measurement ID (G-XXXXXXXXXX) or a Plausible domain. Loaded on every page of the public website once saved.">
          <input className="field" value={ga} disabled={!canEdit}
            onChange={(e) => setGa(e.target.value)} placeholder="G-XXXXXXXXXX" />
        </L>
      </SectionCard>

      <SectionCard title="Integrations" icon={Plug}>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="font-medium text-slate-700">WhatsApp automations</p>
            <p className="mt-1 text-slate-500">
              Birthday, prescription-expiry, cart-recovery and order-update messages read their text from{" "}
              <b>Message Templates</b> below. After changing templates, redeploy the functions so they pick the new copy:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">supabase functions deploy</code>
            </p>
            <Link href="/crm" className="btn btn-ghost mt-3 inline-flex text-sm">Open CRM automations</Link>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="font-medium text-slate-700">Payments & coupons</p>
            <p className="mt-1 text-slate-500">
              Razorpay keys live in the website&apos;s environment (<code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_RAZORPAY_KEY_ID</code>).
              Discount coupons are managed under{" "}
              <Link href="/website/coupons" className="font-medium text-navy-700 hover:underline">Website → Coupons</Link>.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>);
}
