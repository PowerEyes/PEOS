"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Building2, Pencil, Plus, Store } from "lucide-react";
import { addBranch, saveBranch, saveOrgName } from "@/app/(app)/settings-actions";
import { ImageField } from "@/components/ImageField";
import { isSafeMapEmbed, normalizeMapEmbed } from "@/lib/branch-map";
import { L, SectionCard } from "./ui";

type Branch = {
  id: string; name: string; address: string; phone: string;
  email: string | null; udyam_no: string | null; code?: string;
  image_path?: string | null; image_alt?: string | null; map_embed?: string | null;
  /** raw map input in the edit form — normalised to `map_embed` on save */
  map?: string;
};
const EMPTY = { name: "", address: "", phone: "", email: "", udyam_no: "", image_path: null as string | null, image_alt: "", map: "" };

const branchImgUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-images/${path}`;

function BranchFields({ v, set }: { v: any; set: (patch: any) => void }) {
  const [preview, setPreview] = useState<{ url: string; error?: string }>({ url: "" });
  // Debounced so typing an address doesn't reload the preview iframe per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setPreview(normalizeMapEmbed(v.map ?? "")), 500);
    return () => clearTimeout(t);
  }, [v.map]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="Branch name"><input className="field" value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} /></L>
      <L t="Phone"><input className="field" value={v.phone} onChange={(e) => set({ ...v, phone: e.target.value })} /></L>
      <div className="sm:col-span-2">
        <L t="Address"><textarea className="field" rows={2} value={v.address} onChange={(e) => set({ ...v, address: e.target.value })} /></L>
      </div>
      <L t="Email"><input className="field" value={v.email ?? ""} onChange={(e) => set({ ...v, email: e.target.value })} /></L>
      <L t="UDYAM number"><input className="field" value={v.udyam_no ?? ""} onChange={(e) => set({ ...v, udyam_no: e.target.value })} /></L>
      <div className="sm:col-span-2">
        <ImageField
          value={v.image_path}
          onChange={(p) => set({ ...v, image_path: p })}
          alt={v.image_alt ?? ""}
          onAltChange={(x) => set({ ...v, image_alt: x })}
          bucket="site-images"
          aspect="aspect-[16/6]"
          label="Branch photo"
          fallbackIcon="🏪"
          hint="Shown on the website homepage and store locator."
          crop
        />
      </div>
      <div className="sm:col-span-2">
        <L t="Google Map"
          hint="Paste the embed HTML from Google Maps (Share → Embed a map), any Google Maps link, or just the address — it is converted to a safe embed on save.">
          <div className="flex gap-2">
            <input className="field" value={v.map ?? ""}
              placeholder={"<iframe …> or a Google Maps link or address"}
              onChange={(e) => set({ ...v, map: e.target.value })} />
            <button type="button" disabled={!v.address?.trim()}
              onClick={() => set({ ...v, map: v.address })}
              className="btn btn-ghost shrink-0 whitespace-nowrap text-xs">Use address</button>
          </div>
        </L>
        {preview.error && <p className="mt-1 text-[11px] leading-snug text-rose-600">{preview.error}</p>}
        {preview.url && (
          <iframe src={preview.url} title="Map preview" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            className="mt-2 h-44 w-full rounded-xl border border-slate-200" />
        )}
      </div>
    </div>);
}

export function BusinessSection({ orgName, branches, canEdit }: { orgName: string; branches: Branch[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(orgName);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Branch | null>(null);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ error?: string; ok?: string }>, after?: () => void) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.error) return toast(r.error, "err");
    toast(r.ok!);
    after?.();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Business profile" icon={Building2}
        footer={canEdit ? (
          <button disabled={busy} onClick={() => run(() => saveOrgName(name))} className="btn btn-gold">
            {busy ? "Saving…" : "Save business name"}
          </button>) : null}>
        <L t="Business name" hint="Shown on invoices, the website and customer messages.">
          <input className="field" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </L>
      </SectionCard>

      <SectionCard title="Branches" icon={Store}
        footer={canEdit && !adding ? (
          <button onClick={() => setAdding(true)} className="btn btn-ghost"><Plus size={15} />Add branch</button>) : null}>
        {adding && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">New branch</p>
            <BranchFields v={nf} set={setNf} />
            <div className="flex gap-2">
              <button disabled={busy}
                onClick={() => run(() => addBranch(nf), () => { setAdding(false); setNf({ ...EMPTY }); })}
                className="btn btn-gold text-sm">
                {busy ? "Adding…" : "Add branch"}
              </button>
              <button onClick={() => { setAdding(false); setNf({ ...EMPTY }); }} className="btn btn-ghost text-sm">Cancel</button>
            </div>
          </div>)}
        {branches.length === 0 && <p className="text-sm text-slate-500">No branches yet.</p>}
        {branches.map((b) => (editId === b.id && form ? (
          <div key={b.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <BranchFields v={form} set={setForm} />
            <div className="flex gap-2">
              <button disabled={busy}
                onClick={() => run(() => saveBranch(form), () => { setEditId(null); setForm(null); })}
                className="btn btn-gold text-sm">
                {busy ? "Saving…" : "Save branch"}
              </button>
              <button onClick={() => { setEditId(null); setForm(null); }} className="btn btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div key={b.id} className="space-y-1 rounded-xl border border-slate-100 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{b.name} {b.code && <span className="text-slate-400">({b.code})</span>}</p>
              {canEdit && (
                <button onClick={() => { setEditId(b.id); setForm({ ...b, image_alt: b.image_alt ?? "", map: b.map_embed ?? "" }); }} className="btn btn-ghost px-2 py-1 text-xs">
                  <Pencil size={13} />Edit
                </button>)}
            </div>
            {b.image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branchImgUrl(b.image_path)} alt={b.image_alt || b.name} loading="lazy"
                className="mt-2 h-36 w-full rounded-xl object-cover" />
            )}
            <p className="text-slate-600">{b.address}</p>
            <p className="text-slate-600">{b.phone}{b.email ? ` | ${b.email}` : ""}</p>
            {b.udyam_no && <p className="text-slate-500">UDYAM: {b.udyam_no}</p>}
            {isSafeMapEmbed(b.map_embed) && (
              <iframe src={b.map_embed as string} title={`Map — ${b.name}`} loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="mt-2 h-44 w-full rounded-xl border border-slate-200" />
            )}
          </div>
        )))}
      </SectionCard>
    </div>);
}
