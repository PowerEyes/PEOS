"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Crop, Loader2, Minus, Plus } from "lucide-react";

type Props = {
  /** object URL of the file being cropped */
  src: string;
  /** width/height ratio the site will render this image at (object-cover) */
  aspect: number;
  busy?: boolean;
  onCancel: () => void;
  /** upload the untouched file instead of a crop */
  onSkip: () => void;
  /** upload the cropped JPEG */
  onConfirm: (blob: Blob) => void;
};

const MAX_EDGE = 1600;
const QUALITY = 0.85;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Fixed-aspect crop: the box is the shape the site renders at, so what you see
 * here is exactly what visitors get. Drag to reposition, zoom to tighten.
 *
 * No dependency — the maths is a cover-scale plus a bounded offset, which is
 * less code than integrating a cropper library and keeps the output identical
 * to `shrink()`'s JPEG settings.
 */
export function ImageCropper({ src, aspect, busy, onCancel, onSkip, onConfirm }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });

  // The box is sized by CSS (width + aspect-ratio), so measure it rather than
  // guessing — the crop rect has to be in real pixels.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A new file means a fresh crop; without this a leftover offset would carry
  // over and silently cut the wrong region.
  useEffect(() => {
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setNat(null);
  }, [src]);

  const ready = !!box && !!nat;
  // Scale that makes the image cover the box at zoom 1 (never letterboxes).
  const s = ready ? Math.max(box!.w / nat!.w, box!.h / nat!.h) * zoom : 1;
  const dw = nat ? nat.w * s : 0;
  const dh = nat ? nat.h * s : 0;
  const maxX = box && nat ? Math.max(0, (dw - box.w) / 2) : 0;
  const maxY = box && nat ? Math.max(0, (dh - box.h) / 2) : 0;
  const cx = clamp(off.x, -maxX, maxX);
  const cy = clamp(off.y, -maxY, maxY);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: cx, oy: cy };
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setOff({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) });
  }
  function up() {
    // Store the clamped values so the next gesture starts from a real position.
    if (drag.current) setOff({ x: cx, y: cy });
    drag.current = null;
  }

  async function confirm() {
    if (!ready) return;
    const img = new Image();
    img.src = src;
    try { await img.decode(); } catch { return; }
    // Where the box sits on the source image, in natural pixels.
    const left = box!.w / 2 - dw / 2 + cx;
    const top = box!.h / 2 - dh / 2 + cy;
    const sx = clamp(-left / s, 0, nat!.w - 1);
    const sy = clamp(-top / s, 0, nat!.h - 1);
    const sw = clamp(box!.w / s, 1, nat!.w - sx);
    const sh = clamp(box!.h / s, 1, nat!.h - sy);

    // Output keeps the exact target ratio; drawImage stretches the sub-pixel
    // rounding away.
    const outW = aspect >= 1 ? MAX_EDGE : Math.round(MAX_EDGE * aspect);
    const outH = aspect >= 1 ? Math.round(MAX_EDGE / aspect) : MAX_EDGE;
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", QUALITY));
    if (blob) onConfirm(blob);
  }

  return (
    <div className="space-y-4">
      <div
        ref={boxRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="relative w-full max-w-[720px] touch-none overflow-hidden rounded-xl bg-slate-900 shadow-inner select-none"
        style={{ aspectRatio: aspect, cursor: ready ? "grab" : "default" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: nat ? dw : undefined,
            height: nat ? dh : undefined,
            transform: `translate(-50%, -50%) translate(${cx}px, ${cy}px)`,
            opacity: nat ? 1 : 0,
          }}
        />
        {/* Thirds grid — a crop aid, not a border; it keeps off-centre faces out of the crop. */}
        {ready && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">Loading…</div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => clamp(z - 0.1, 1, 3))}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <Minus size={14} />
        </button>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
        />
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => clamp(z + 0.1, 1, 3))}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <Plus size={14} />
        </button>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">{zoom.toFixed(1)}×</span>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost text-sm">Cancel</button>
        <button type="button" onClick={onSkip} disabled={busy} className="btn btn-ghost text-sm">Use as-is</button>
        <button type="button" onClick={() => void confirm()} disabled={busy || !ready} className="btn btn-gold text-sm">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Crop size={14} />}
          {busy ? "Uploading…" : "Crop & upload"}
        </button>
      </div>
    </div>
  );
}
