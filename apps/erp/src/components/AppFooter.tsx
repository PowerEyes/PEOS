"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
// Status is measured: browser connectivity + the app's /api/health (database reachability).
export function AppFooter({ tenantName, branchLabel, version, webUrl }: { tenantName?: string; branchLabel: string; version?: string; webUrl?: string }) {
  const [st, setSt] = useState<"ok" | "degraded" | "offline">("ok");
  useEffect(() => {
    let live = true;
    const check = async () => { if (!navigator.onLine) return live && setSt("offline"); try { const r = await fetch("/api/health", { cache: "no-store" }); live && setSt(r.ok ? "ok" : "degraded"); } catch { live && setSt("degraded"); } };
    check(); const t = setInterval(check, 60000); window.addEventListener("online", check); window.addEventListener("offline", check);
    return () => { live = false; clearInterval(t); window.removeEventListener("online", check); window.removeEventListener("offline", check); };
  }, []);
  const dot = st === "ok" ? "bg-emerald-500" : st === "degraded" ? "bg-amber-500" : "bg-rose-500", txt = st === "ok" ? "All systems normal" : st === "degraded" ? "Service degraded" : "Offline";
  const base = (webUrl ?? "").replace(/\/$/, "");
  return (<footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-400 sm:px-6">
    <span className="truncate">© {new Date().getFullYear()} PowerOS{tenantName ? ` · ${tenantName}` : ""} · {branchLabel}{version ? ` · v${version}` : ""}</span>
    <span className="flex items-center gap-3">
      {base && <a href={`${base}/privacy`} target="_blank" rel="noreferrer" className="hover:text-slate-600">Privacy</a>}
      {base && <a href={`${base}/terms`} target="_blank" rel="noreferrer" className="hover:text-slate-600">Terms</a>}
      <Link href="/support" className="hover:text-slate-600">Help &amp; support</Link>
      <span className="flex items-center gap-1.5" role="status"><span className={`h-2 w-2 rounded-full ${dot}`} />{txt}</span></span></footer>);
}
