"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, Pill, useToast } from "@poweros/ui";
import { Pencil, ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ImageField } from "@/components/ImageField";

const GROUPS: [string, string, string][] = [["page", "Enterprise pages", "About, Clinic and Lab pages shown on the website"], ["guide", "Buying & size guides", "Each category page has its own guide. The frame size guide shows only on Eyeglasses."], ["config", "Page headings & Eye consultation", "Listing-page hero text and the eye-test booking form"]];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

export function PagesStudio({ rows }: { rows: any[] }) {
  const router = useRouter(); const toast = useToast();
  const [edit, setEdit] = useState<any | null>(null); const [busy, setBusy] = useState(false);
  const open = (r: any) => { const b = r.body ?? {}; const { sections: _s, stats: _t, table: _b, ...rest } = b; setEdit({ ...r, extra: Object.keys(rest).length && r.kind !== "config" ? JSON.stringify(rest, null, 2) : "", sections: b.sections ?? [], stats: b.stats ?? [], thead: (b.table?.headers ?? []).join(" | "), trows: (b.table?.rows ?? []).map((x: string[]) => x.join(" | ")).join("\n"),
    price: b.price ?? "", duration: b.duration ?? "", intro: b.intro ?? "", types: (b.types ?? []).join("\n"), times: (b.times ?? []).join("\n"), cta: b.cta ?? "", note: b.note ?? "", closed: b.closed_weekdays ?? [] }); };
  const set = (k: string, v: any) => setEdit((e: any) => ({ ...e, [k]: v }));
  const move = (arr: string, i: number, d: number) => setEdit((e: any) => { const a = [...e[arr]]; const j = i + d; if (j < 0 || j >= a.length) return e; [a[i], a[j]] = [a[j], a[i]]; return { ...e, [arr]: a }; });
  const upd = (arr: string, i: number, k: string, v: string) => setEdit((e: any) => ({ ...e, [arr]: e[arr].map((x: any, n: number) => (n === i ? { ...x, [k]: v } : x)) }));
  async function save() {
    if (!edit.title.trim()) return toast("Title is required", "err");
    const body: any = { ...(edit.body ?? {}) };
    if (edit.kind === "config" && edit.slug === "eye-consultation") Object.assign(body, { price: edit.price, duration: edit.duration, intro: edit.intro, types: lines(edit.types), times: lines(edit.times), cta: edit.cta, note: edit.note, closed_weekdays: edit.closed });
    else if (edit.kind !== "config") {
      if (edit.extra?.trim()) { try { Object.assign(body, JSON.parse(edit.extra)); } catch { return toast("Extra data is not valid JSON", "err"); } }
      body.sections = edit.sections.filter((s: any) => s.heading || s.body);
      if (edit.slug === "about") body.stats = edit.stats.filter((s: any) => s.value);
      const headers = edit.thead.split("|").map((x: string) => x.trim()).filter(Boolean);
      if (edit.kind === "guide") body.table = headers.length ? { headers, rows: lines(edit.trows).map((r) => r.split("|").map((c) => c.trim())) } : undefined;
    }
    setBusy(true);
    const { error } = await supabaseBrowser().from("site_pages").update({ title: edit.title.trim(), subtitle: edit.subtitle?.trim() || null, hero_image: edit.hero_image || null, is_active: edit.is_active, body }).eq("id", edit.id);
    setBusy(false); if (error) return toast(error.message, "err");
    toast("Saved. Live on the website within a minute."); setEdit(null); router.refresh();
  }
  const toggle = async (r: any) => { const { error } = await supabaseBrowser().from("site_pages").update({ is_active: !r.is_active }).eq("id", r.id); if (error) toast(error.message, "err"); router.refresh(); };

  return (<div className="space-y-6">
    <div className="flex items-center gap-3"><Link href="/website" className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50" aria-label="Back to Website Studio"><ArrowLeft size={16} /></Link>
      <div><h1 className="text-xl font-bold text-slate-900">Pages &amp; Guides</h1><p className="text-sm text-slate-500">Everything here is read live by the website. Turn an item off to hide it.</p></div></div>
    {GROUPS.map(([kind, title, hint]) => (<section key={kind}><h2 className="font-semibold text-slate-800">{title}</h2><p className="mb-2 text-xs text-slate-500">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.filter((r) => r.kind === kind).map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{r.title}</p><p className="truncate text-xs text-slate-500">/{r.slug}</p></div>
          <button onClick={() => toggle(r)} title="Show / hide"><Pill tone={r.is_active ? "green" : "red"}>{r.is_active ? "Live" : "Hidden"}</Pill></button>
          <button onClick={() => open(r)} className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200" aria-label={`Edit ${r.title}`}><Pencil size={14} /></button></div>))}</div></section>))}
    {rows.length === 0 && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">No pages yet. Run migration 20261125000000_site_pages.sql.</p>}

    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Edit: ${edit.title}` : ""}>
      {edit && (<div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <label className="block text-sm font-medium">Title<input className="field mt-1" value={edit.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="block text-sm font-medium">Subtitle<input className="field mt-1" value={edit.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} /></label>
        {edit.kind !== "guide" && <ImageField value={edit.hero_image ?? ""} onChange={(p) => set("hero_image", p)} label="Hero image (optional)" aspect="aspect-[21/9]" crop />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => set("is_active", e.target.checked)} />Visible on website</label>

        {edit.slug === "eye-consultation" ? (<>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Price label<input className="field mt-1" value={edit.price} onChange={(e) => set("price", e.target.value)} placeholder="Free / ₹300" /></label><label className="text-sm font-medium">Duration<input className="field mt-1" value={edit.duration} onChange={(e) => set("duration", e.target.value)} /></label></div>
          <label className="block text-sm font-medium">Intro text<textarea className="field mt-1" rows={2} value={edit.intro} onChange={(e) => set("intro", e.target.value)} /></label>
          <label className="block text-sm font-medium">Appointment types (one per line)<textarea className="field mt-1" rows={4} value={edit.types} onChange={(e) => set("types", e.target.value)} /></label>
          <label className="block text-sm font-medium">Time slots (one per line)<textarea className="field mt-1" rows={5} value={edit.times} onChange={(e) => set("times", e.target.value)} /></label>
          <div><p className="mb-1 text-sm font-medium">Closed days</p><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <button type="button" key={d} onClick={() => set("closed", edit.closed.includes(i) ? edit.closed.filter((x: number) => x !== i) : [...edit.closed, i])} className={`rounded-full border px-3 py-1.5 text-xs ${edit.closed.includes(i) ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200"}`}>{d}</button>)}</div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Button label<input className="field mt-1" value={edit.cta} onChange={(e) => set("cta", e.target.value)} /></label><label className="text-sm font-medium">Footnote<input className="field mt-1" value={edit.note} onChange={(e) => set("note", e.target.value)} /></label></div>
          <p className="text-xs text-slate-500">Stores listed are your active branches.</p></>)
        : edit.kind !== "config" && (<>
          {edit.slug === "about" && <div><p className="mb-1 text-sm font-medium">Headline numbers</p>{edit.stats.map((s: any, i: number) => <div key={i} className="mb-2 flex gap-2"><input className="field w-24" value={s.value} onChange={(e) => upd("stats", i, "value", e.target.value)} placeholder="25+" /><input className="field flex-1" value={s.label} onChange={(e) => upd("stats", i, "label", e.target.value)} placeholder="Years of trust" /><button onClick={() => set("stats", edit.stats.filter((_: any, n: number) => n !== i))} aria-label="Remove"><Trash2 size={15} /></button></div>)}<button onClick={() => set("stats", [...edit.stats, { value: "", label: "" }])} className="text-xs font-semibold text-navy-700"><Plus size={12} className="inline" /> Add number</button></div>}
          <div><p className="mb-1 text-sm font-medium">Sections</p>{edit.sections.map((s: any, i: number) => (
            <div key={i} className="mb-3 space-y-2 rounded-xl border border-slate-200 p-3"><div className="flex gap-2"><input className="field w-16" value={s.icon ?? ""} onChange={(e) => upd("sections", i, "icon", e.target.value)} placeholder="🔬" /><input className="field flex-1" value={s.heading ?? ""} onChange={(e) => upd("sections", i, "heading", e.target.value)} placeholder="Heading" />
              <button onClick={() => move("sections", i, -1)} aria-label="Up"><ArrowUp size={15} /></button><button onClick={() => move("sections", i, 1)} aria-label="Down"><ArrowDown size={15} /></button><button onClick={() => set("sections", edit.sections.filter((_: any, n: number) => n !== i))} aria-label="Remove"><Trash2 size={15} /></button></div>
              <textarea className="field" rows={3} value={s.body ?? ""} onChange={(e) => upd("sections", i, "body", e.target.value)} placeholder="Text" /></div>))}
            <button onClick={() => set("sections", [...edit.sections, { heading: "", body: "" }])} className="text-xs font-semibold text-navy-700"><Plus size={12} className="inline" /> Add section</button></div>
          {edit.kind === "guide" && <div><p className="mb-1 text-sm font-medium">Size / info table (optional)</p><input className="field mb-2" value={edit.thead} onChange={(e) => set("thead", e.target.value)} placeholder="Headers separated by | e.g. Fit | Lens width | Bridge" /><textarea className="field" rows={5} value={edit.trows} onChange={(e) => set("trows", e.target.value)} placeholder={"One row per line, cells separated by |\nNarrow | 44–48 | 16–18"} /></div>}</>)}
        {edit.extra !== "" && edit.kind !== "config" && <label className="block text-sm font-medium">Structured content (FAQ groups, ages, hours…) — JSON<textarea className="field mt-1 font-mono text-xs" rows={8} value={edit.extra} onChange={(e) => set("extra", e.target.value)} /></label>}
        <div className="flex justify-end gap-2 pt-2"><button onClick={() => setEdit(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Cancel</button><button onClick={save} disabled={busy} className="rounded-xl bg-navy-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
      </div>)}
    </Modal>
  </div>);
}
