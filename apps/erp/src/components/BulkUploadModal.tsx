"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { Modal, useToast } from "@poweros/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { shrink } from "@/lib/image";
import { putImage } from "@/lib/upload";

type Props = {
  open: boolean;
  /** section the new rows land in — null means closed */
  section: string | null;
  /** display_order for the first new row (caller passes the section's max + 1) */
  startOrder: number;
  onClose: () => void;
  /** fired once the rows are committed, so the controller can refresh */
  onCreated: () => void;
};

/** "summer-sale_final.JPG" → "Summer Sale Final" — a usable starting title. */
function titleFrom(name: string): string {
  return (
    name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, (c) => c.toUpperCase()) ||
    "Untitled card"
  );
}

/**
 * Drop N images on a section and get N content rows back, already in upload
 * order so the next thing you do is drag them into place.
 *
 * Uploads are sequential on purpose: the bucket write and the row insert are
 * both cheap, and a parallel loop makes "which files did make it?" impossible
 * to answer when one of them fails.
 */
export function BulkUploadModal({ open, section, startOrder, onClose, onCreated }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<{ file: File; url: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  // Object URLs only live as long as their thumbnail does.
  useEffect(() => () => { setItems((xs) => { xs.forEach((x) => URL.revokeObjectURL(x.url)); return xs; }); }, []);

  function add(list: FileList | File[]) {
    const next = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const rejected = Array.from(list).length - next.length;
    if (rejected) toast(`${rejected} file${rejected === 1 ? "" : "s"} skipped — not an image.`, "err");
    if (next.length) setItems((xs) => [...xs, ...next.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }
  function removeAt(i: number) {
    setItems((xs) => { URL.revokeObjectURL(xs[i].url); return xs.filter((_, n) => n !== i); });
  }
  function close() {
    setItems((xs) => { xs.forEach((x) => URL.revokeObjectURL(x.url)); return []; });
    onClose();
  }

  async function run() {
    if (!section || !items.length) return;
    setBusy(true); setDone(0);
    const paths: string[] = [];
    let committed = false;
    try {
      const rows: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const path = await putImage(await shrink(items[i].file, 1600));
        paths.push(path);
        const title = titleFrom(items[i].file.name);
        rows.push({
          section, title, image_path: path, image_alt: title,
          display_order: startOrder + i, is_active: true,
        });
        setDone(i + 1);
      }
      const { error } = await supabaseBrowser().from("website_content").insert(rows);
      if (error) throw new Error(error.message);
      committed = true;
      toast(`${rows.length} card${rows.length === 1 ? "" : "s"} added to ${section.replace("_", " ")}`);
      onCreated();
      close();
    } catch (e: any) {
      // Nothing is in the DB yet, so the files uploaded so far are orphans.
      if (!committed && paths.length) void supabaseBrowser().storage.from("site-images").remove(paths);
      toast(e?.message ?? "Upload failed.", "err");
    } finally { setBusy(false); setDone(0); }
  }

  const total = items.length;
  const label = section ? section.replace("_", " ") : "";

  return (
    <Modal
      open={open && !!section}
      onClose={close}
      title="Bulk upload images"
      subtitle={`Each image becomes a card in “${label}”, added after order ${startOrder - 1}.`}
    >
      <div className="space-y-4 p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) add(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? "border-gold-500 bg-gold-50" : "border-slate-200 bg-slate-50"}`}
        >
          <UploadCloud size={22} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">Drop images here, or</p>
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="btn btn-ghost mt-2 text-sm">
            browse files
          </button>
          <p className="mt-2 text-[11px] text-slate-400">Multiple selection supported. Each one is resized in the browser before upload.</p>
          <input
            ref={inputRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }}
          />
        </div>

        {total > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {items.map((it, i) => (
              <li key={it.url} className="group relative overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" className="aspect-[4/3] w-full object-cover" />
                <p className="truncate px-1.5 py-1 text-[10px] text-slate-500" title={titleFrom(it.file.name)}>
                  {titleFrom(it.file.name)}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${it.file.name}`}
                  className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-slate-600 opacity-0 shadow transition group-hover:opacity-100 hover:text-rose-600 focus:opacity-100"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-gold-500 hover:text-gold-600"
              >
                <ImagePlus size={18} />
              </button>
            </li>
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            {busy ? `Uploading ${done} of ${total}…` : `${total} image${total === 1 ? "" : "s"} ready`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={close} disabled={busy} className="btn btn-ghost text-sm">Cancel</button>
            <button type="button" onClick={() => void run()} disabled={busy || !total} className="btn btn-gold text-sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {busy ? "Uploading…" : `Add ${total || ""} card${total === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
