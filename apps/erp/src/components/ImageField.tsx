"use client";
import { useEffect, useRef, useState } from "react";
import { UploadCloud, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Modal, useToast } from "@poweros/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { parseAspect, shrink } from "@/lib/image";
import { putImage } from "@/lib/upload";
import { ImageCropper } from "@/components/ImageCropper";

type Props = {
  /** storage path, e.g. "<org_id>/<uuid>.jpg" — null/"" = no image yet */
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  /** alt text column (image_alt). Omit to hide the alt input. */
  alt?: string;
  onAltChange?: (v: string) => void;
  /** storage bucket — "site-images" for CMS, "product-images" for goods */
  bucket?: string;
  /** tailwind aspect class for the preview box */
  aspect?: string;
  /** rendered in the empty state so an unset image still looks intentional */
  fallbackIcon?: string;
  label?: string;
  hint?: string;
  /** max longest-edge px passed to shrink() */
  max?: number;
  /**
   * Offer a crop step before uploading, cut to `aspect`. Only for images the
   * site renders with `object-cover` — cropping a product shot (shown with
   * `object-contain`) would cut the frame in half, so that caller leaves this off.
   */
  crop?: boolean;
};

/**
 * Drag-and-drop / click-to-upload image picker backed by Supabase Storage.
 *
 * Uploads are client-resized via shrink() (JPEG q0.85) before they leave the
 * browser, so a 6 MB phone photo never lands in the bucket. The stored path is
 * written to the parent row's image_path column; the component never writes to
 * the database itself.
 *
 * An empty value renders a dashed placeholder with `fallbackIcon` rather than a
 * broken <img>, so sections without an image keep their designed look.
 */
export function ImageField({
  value, onChange, alt, onAltChange,
  bucket = "site-images", aspect = "aspect-[4/3]",
  fallbackIcon = "🖼️", label = "Image", hint, max = 1600,
  crop = false,
}: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // A picked file waiting to be cropped. Held rather than uploaded so the crop
  // step can still be cancelled without leaving an object in the bucket.
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const src = value ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${value}` : null;

  // The object URL backing the crop preview is only good for as long as the
  // preview exists; leaking one per upload pins the decoded bitmap in memory.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  /** Encode → upload → swap in, dropping the previous object. */
  async function store(encode: () => Promise<Blob>) {
    setErr(null); setBusy(true);
    try {
      const path = await putImage(await encode(), bucket);
      // Swap in the new image, then drop the old object so the bucket doesn't
      // accumulate orphans. Failure here is harmless — it just leaks a file.
      const old = value;
      onChange(path);
      if (old) void supabaseBrowser().storage.from(bucket).remove([old]);
      return true;
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed.");
      return false;
    } finally { setBusy(false); }
  }

  async function accept(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("That file isn't an image.", "err");
    if (crop) { setErr(null); setPending({ file, url: URL.createObjectURL(file) }); return; }
    await store(() => shrink(file, max));
  }

  function closePending() {
    setPending((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
  }

  async function confirmCrop(blob: Blob) {
    if (await store(() => Promise.resolve(blob))) closePending();
  }

  async function uploadOriginal() {
    if (!pending) return;
    const { file } = pending;
    if (await store(() => shrink(file, max))) closePending();
  }

  async function clear() {
    const old = value;
    onChange(null);
    if (onAltChange) onAltChange("");
    if (old) {
      const { error } = await supabaseBrowser().storage.from(bucket).remove([old]);
      if (error) toast(`Image cleared, but the file wasn't deleted: ${error.message}`, "err");
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void accept(e.dataTransfer.files?.[0]); }}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed transition ${drag ? "border-gold-500 bg-gold-50" : "border-slate-200 bg-slate-50"}`}
      >
        {src ? (
          <div className={`relative ${aspect}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt || ""} className="h-full w-full object-cover" />
            {/* max-sm:opacity-100 mirrors product-drawer — no hover on a touch
                device, and this controller gets used on shop-floor tablets. */}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-white/95 p-1.5 text-xs font-medium text-slate-700 hover:bg-white">Replace</button>
              <button type="button" onClick={clear} title="Remove image" className="rounded-lg bg-white/95 p-1.5 text-rose-600 hover:bg-white"><Trash2 size={14} /></button>
            </div>
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-white/70">
                <Loader2 className="animate-spin text-slate-500" />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`grid w-full place-items-center gap-1.5 px-4 py-7 text-center ${aspect} ${busy ? "opacity-60" : ""}`}
          >
            {busy ? <Loader2 className="animate-spin text-slate-400" /> : <UploadCloud size={20} className="text-slate-400" />}
            <span className="text-xs font-medium text-slate-500">{busy ? "Uploading…" : "Drop an image, or click to browse"}</span>
            <span className="text-[11px] text-slate-400">{fallbackIcon} Shown until you add one</span>
          </button>
        )}
        <input
          ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>

      {hint && <p className="text-[11px] leading-snug text-slate-400">{hint}</p>}

      {onAltChange && (
        <input
          className="field" value={alt ?? ""} maxLength={200}
          placeholder="Alt text (describe the image for screen readers)"
          onChange={(e) => onAltChange(e.target.value)}
        />
      )}

      {err && (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-rose-600">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />{err}
        </p>
      )}

      {pending && (
        <Modal
          open
          onClose={closePending}
          title="Crop image"
          subtitle="Drag to reposition and zoom to fit — this is exactly the shape the website renders at."
        >
          <div className="p-5">
            <ImageCropper
              src={pending.url}
              aspect={parseAspect(aspect)}
              busy={busy}
              onCancel={closePending}
              onSkip={() => void uploadOriginal()}
              onConfirm={(b) => void confirmCrop(b)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
