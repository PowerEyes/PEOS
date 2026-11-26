"use client";
import { useState, useTransition } from "react";
import { backupNow, disconnectDrive } from "./actions";
export function BackupActions({ connected }: { connected: boolean }) {
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ error?: string; ok?: string }>) => start(async () => { const r = await fn(); setMsg({ t: r.error ?? r.ok ?? "", bad: !!r.error }); });
  return (<div className="space-y-3"><div className="flex flex-wrap gap-2">
    {connected ? <>
      <button disabled={pending} onClick={() => go(backupNow)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">{pending ? "Backing up…" : "Back up now"}</button>
      <button disabled={pending} onClick={() => confirm("Disconnect Google Drive? Automatic backups will stop.") && go(disconnectDrive)} className="rounded-lg border px-3 py-2 text-sm">Disconnect</button></>
      : <a href="/api/google/connect" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Connect Google Drive</a>}
    <a href="/api/backup/download" className="rounded-lg border px-3 py-2 text-sm">Download a copy</a></div>
    {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.t}</p>}</div>);
}
