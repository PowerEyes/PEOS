"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

type Props = {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
};

const MAX = 4;

/**
 * Full-screen image lightbox — scroll-to-zoom on desktop, pinch- and
 * double-tap-to-zoom on mobile, drag/finger pan while zoomed.
 */
export function Lightbox({ images, index, onIndex, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const scaleRef = useRef(1);
  const movedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const lastTapRef = useRef(0);
  const layerRef = useRef<HTMLDivElement>(null);

  // Reset zoom when the image changes; keep scale in a ref for gesture math.
  useEffect(() => { setScale(1); setPos({ x: 0, y: 0 }); }, [index]);
  useEffect(() => {
    scaleRef.current = scale;
    if (scale <= 1) setPos({ x: 0, y: 0 });
  }, [scale]);

  const step = (d: number) => {
    if (images.length < 2) return;
    onIndex((index + d + images.length) % images.length);
  };

  // Escape / arrow keys + lock page scroll behind the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length, onClose]);

  // Wheel zoom (desktop) — non-passive so the page behind doesn't scroll.
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.min(MAX, Math.max(1, s - e.deltaY * 0.0025)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const clamp = (p: { x: number; y: number }, s: number) => {
    const limit = s > 1 ? 260 * (s - 1) : 0;
    return {
      x: Math.max(-limit, Math.min(limit, p.x)),
      y: Math.max(-limit, Math.min(limit, p.y)),
    };
  };

  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    movedRef.current = false;
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches), scale: scaleRef.current };
      startRef.current = null;
    } else if (e.touches.length === 1 && scaleRef.current > 1) {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, px: pos.x, py: pos.y };
      setDragging(true);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      movedRef.current = true;
      const ns = Math.min(MAX, Math.max(1, pinchRef.current.scale * (touchDist(e.touches) / pinchRef.current.dist)));
      setScale(ns);
      setPos((p) => clamp(p, ns));
    } else if (e.touches.length === 1 && startRef.current) {
      e.preventDefault();
      movedRef.current = true;
      const t = e.touches[0];
      setPos(clamp({ x: startRef.current.px + (t.clientX - startRef.current.x), y: startRef.current.py + (t.clientY - startRef.current.y) }, scaleRef.current));
    }
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
    startRef.current = null;
    setDragging(false);
    // Double-tap toggles zoom
    const now = Date.now();
    if (!movedRef.current && scaleRef.current <= 1 && now - lastTapRef.current < 300) {
      setScale(2.5);
      lastTapRef.current = 0;
    } else if (!movedRef.current) {
      lastTapRef.current = now;
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    movedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!startRef.current) return;
    movedRef.current = true;
    setPos(clamp({ x: startRef.current.px + (e.clientX - startRef.current.x), y: startRef.current.py + (e.clientY - startRef.current.y) }, scaleRef.current));
  };
  const onMouseUp = () => { startRef.current = null; setDragging(false); };

  const onDoubleClick = () => {
    setScale((s) => (s > 1 ? 1 : 2.5));
  };

  const url = images[index];
  const hint = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

  return (
    <motion.div className="fixed inset-0 z-[70] bg-black/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Controls */}
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/25">
        <X size={20} />
      </button>
      <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white">
        {index + 1} / {images.length}
      </div>
      {images.length > 1 && (
        <>
          <button onClick={() => step(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25">
            <ChevronLeft size={24} />
          </button>
          <button onClick={() => step(1)} aria-label="Next image" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25">
            <ChevronRight size={24} />
          </button>
        </>)}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[11px] font-medium text-white/90">
          <ZoomIn size={13} />
          {hint ? "Pinch to zoom · Double-tap to zoom" : "Scroll to zoom · Drag to pan · Double-click to zoom"}
        </span>
      </div>

      {/* Interaction layer */}
      <div
        ref={layerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden touch-none select-none"
        style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        onClick={(e) => { if (e.target === e.currentTarget && scale === 1 && !movedRef.current) onClose(); }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
      >
        {url && (
          <img
            src={url} alt="" draggable={false}
            className="max-h-[92vh] max-w-[92vw] object-contain shadow-2xl"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: dragging ? "none" : "transform .18s ease" }}
          />)}
      </div>
    </motion.div>);
}
