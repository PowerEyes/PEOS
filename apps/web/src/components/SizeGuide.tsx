"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Ruler } from "lucide-react";

/**
 * Static "Frame Size Guide": how to measure your face width, what the three
 * numbers on the temple arm mean, and a size chart.
 *
 * Self-contained (button + modal) so it can be dropped into listing toolbars
 * and every product card. Portalled to <body> because cards sit inside
 * transformed (framer-motion) containers that would otherwise clip a fixed
 * overlay.
 */
export function SizeGuide({
  label = "Frame Size Guide",
  className = "",
}: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const btnClass = className ||
    "inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-navy-700 hover:text-navy-900";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}>
        📏 {label}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Frame size guide">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <p className="flex items-center gap-2 font-bold text-navy-900">
                <Ruler size={16} className="text-gold-500" /> {label}
              </p>
              <button onClick={() => setOpen(false)} aria-label="Close size guide"
                className="rounded-full bg-slate-100 p-1.5 transition hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 text-sm leading-relaxed text-slate-600">
              <section>
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">1 · Measure your face width</h3>
                <p>
                  Hold a ruler flat across your cheekbones — the widest part of your
                  face, just below your eyes — and note the width in centimetres.
                  That is the frame width that will sit comfortably on you.
                </p>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500">
                  Cheekbone to cheekbone → <b className="text-navy-900">Small &lt; 13 cm · Medium 13–14.5 cm · Large &gt; 14.5 cm</b>
                </div>
              </section>

              <section>
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">2 · The three numbers on the temple arm</h3>
                <p>
                  Every frame prints its size inside the arm, for example{" "}
                  <b className="font-mono text-navy-900">52 □ 18 – 145</b>:
                </p>
                <ul className="mt-2 space-y-1.5">
                  <li className="rounded-lg bg-slate-50 px-3 py-2"><b className="text-navy-900">52 — Lens width</b> (mm): the width of one lens at its widest point.</li>
                  <li className="rounded-lg bg-slate-50 px-3 py-2"><b className="text-navy-900">18 — Bridge width</b> (mm): the gap between the lenses that rests on your nose.</li>
                  <li className="rounded-lg bg-slate-50 px-3 py-2"><b className="text-navy-900">145 — Temple length</b> (mm): the arm length from hinge to tip.</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">3 · Size chart</h3>
                <table className="w-full overflow-hidden rounded-xl border border-slate-100 text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr><th className="px-3 py-2">Size</th><th className="px-2 py-2">Face width</th><th className="px-2 py-2">Lens width</th><th className="px-2 py-2">Temple</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr><td className="px-3 py-2 font-semibold text-navy-900">Small</td><td className="px-2 py-2">&lt; 13 cm</td><td className="px-2 py-2">≤ 48 mm</td><td className="px-2 py-2">135–140 mm</td></tr>
                    <tr><td className="px-3 py-2 font-semibold text-navy-900">Medium</td><td className="px-2 py-2">13–14.5 cm</td><td className="px-2 py-2">49–53 mm</td><td className="px-2 py-2">140–145 mm</td></tr>
                    <tr><td className="px-3 py-2 font-semibold text-navy-900">Large</td><td className="px-2 py-2">&gt; 14.5 cm</td><td className="px-2 py-2">≥ 54 mm</td><td className="px-2 py-2">145–150 mm</td></tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">
                  Between sizes? Pick the larger one — our team adjusts nose pads and
                  temples free of charge in-store.
                </p>
              </section>
            </div>
          </div>
        </div>,
        document.body)}
    </>
  );
}
