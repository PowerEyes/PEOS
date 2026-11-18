"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

type Props = { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean };

/** Right drawer on desktop, full-height sheet on mobile. */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: Props) {
  useEsc(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside role="dialog" aria-label={title}
            className={`absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl ${wide ? "max-w-3xl" : "max-w-xl"}`}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div><h2 className="text-lg font-semibold text-navy-900">{title}</h2>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>
              <button onClick={onClose} aria-label="Close" className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={16} /></button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Centered modal on desktop, bottom sheet on mobile. */
export function Modal({ open, onClose, title, subtitle, children, wide }: Props & { wide?: boolean }) {
  useEsc(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div role="dialog" aria-label={title}
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-5xl" : "sm:max-w-2xl"}`}
            initial={{ y: 60, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}>
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div><h2 className="text-xl font-semibold text-navy-900">{title}</h2>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>
              <button onClick={onClose} aria-label="Close" className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={16} /></button>
            </header>
            <div className="overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
