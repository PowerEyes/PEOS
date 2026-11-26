"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { MessageCircle } from "lucide-react";
import { saveWebsiteContact } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard } from "./ui";

export function WebsiteSection({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [wa, setWa] = useState(settings.whatsappNumber);
  const [ig, setIg] = useState(settings.instagram);
  const [busy, setBusy] = useState(false);

  const igHref = ig ? (ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace(/^@/, "")}`) : "";

  async function save() {
    setBusy(true);
    const r = await saveWebsiteContact({ whatsappNumber: wa, instagram: ig });
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <SectionCard title="Website & Contact" icon={MessageCircle}
      footer={canEdit ? (
        <button disabled={busy} onClick={save} className="btn btn-gold">
          {busy ? "Saving…" : "Save contact details"}
        </button>) : <p className="text-xs text-slate-400">Only owners and admins can change these settings.</p>}>
      <L t="WhatsApp number" hint="Country code included, e.g. 919840496404. Every WhatsApp button on the public website opens a chat with this number.">
        <input className="field" inputMode="numeric" value={wa} disabled={!canEdit}
          onChange={(e) => setWa(e.target.value.replace(/\D/g, ""))} placeholder="919840496404" />
      </L>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm text-emerald-700 hover:underline">
          Test chat → wa.me/{wa}
        </a>)}
      <L t="Instagram" hint="Handle (@powereyes) or full URL — linked from the website footer.">
        <input className="field" value={ig} disabled={!canEdit}
          onChange={(e) => setIg(e.target.value)} placeholder="@powereyesopticals" />
      </L>
      {igHref && (
        <a href={igHref} target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm text-navy-700 hover:underline">
          Open Instagram → {ig}
        </a>)}
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        The website reads these values live — changes appear on the public site within a minute of saving.
      </p>
    </SectionCard>);
}
