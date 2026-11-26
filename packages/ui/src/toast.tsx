"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
type T = { id: number; msg: string; tone: "ok" | "err" };
const Ctx = createContext<(msg: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random(); setItems((l) => [...l, { id, msg, tone }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3800); }, []);
  return (<Ctx.Provider value={push}>{children}
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 sm:bottom-6">
      <AnimatePresence>{items.map((t) => (
        <motion.div key={t.id} layout initial={{ y: 30, opacity: 0, scale: .95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}
          className={`pointer-events-auto flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${t.tone === "ok" ? "bg-navy-800" : "bg-rose-600"}`}>
          {t.tone === "ok" ? <CheckCircle2 size={16} className="text-emerald-300" /> : <AlertTriangle size={16} />}{t.msg}</motion.div>))}</AnimatePresence></div></Ctx.Provider>);
}
