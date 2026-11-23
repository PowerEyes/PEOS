"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Runs a server action and shows its error inline. `action` is a bound server action.
export function ActBtn({ action, label, tone = "primary", confirm }: { action: () => Promise<{ error?: string; ok?: string }>; label: string; tone?: "primary" | "ghost"; confirm?: string }) {
  const [e, setE] = useState(""), [p, start] = useTransition(), r = useRouter();
  return (<span className="inline-flex flex-col items-end"><button disabled={p} className={`btn btn-${tone} text-xs`}
    onClick={() => { if (confirm && !window.confirm(confirm)) return; start(async () => { const x = await action(); setE(x.error ?? ""); if (!x.error) r.refresh(); }); }}>{p ? "…" : label}</button>
    {e && <span className="mt-0.5 max-w-[14rem] text-right text-[11px] text-rose-600">{e}</span>}</span>);
}
