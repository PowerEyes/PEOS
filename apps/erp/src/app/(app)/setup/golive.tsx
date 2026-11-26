"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLive } from "./actions";
export function GoLive({ ready }: { ready: boolean }) {
  const [e, setE] = useState(""), [p, start] = useTransition(), r = useRouter();
  return (<div className="card space-y-2 p-4">
    <p className="text-sm">{ready ? "Everything is in place." : "Some steps are incomplete. You can still go live and finish them later."}</p>
    {e && <p className="text-xs text-rose-600">{e}</p>}
    <button disabled={p} onClick={() => start(async () => { const x = await markLive(); if (x.error) setE(x.error); else r.push("/"); })} className="btn btn-primary text-sm">{p ? "…" : "Mark as live"}</button></div>);
}
