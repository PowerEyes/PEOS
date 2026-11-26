"use client";
import { animate } from "framer-motion";
import { useEffect, useState } from "react";
export function CountUp({ to }: { to: number }) {
  const [n, set] = useState(0);
  useEffect(() => { const c = animate(0, to, { duration: 1, ease: "easeOut", onUpdate: (v) => set(Math.round(v)) }); return () => c.stop(); }, [to]);
  return <>{n.toLocaleString("en-IN")}</>;
}
export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
