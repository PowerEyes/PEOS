import { redirect } from "next/navigation";
import { adminCtx } from "@/lib/admin-guard";
import { googleConfigured } from "@/lib/google-drive";
import { RETENTION, BACKUP_FOLDER } from "@/lib/backup";
import { BackupActions } from "./view";
export const dynamic = "force-dynamic";
const ERR: Record<string, string> = { forbidden: "Only the owner or an admin can connect Google Drive.", not_configured: "Google sign-in is not configured on this deployment (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", state: "The sign-in session expired. Please try again.", denied: "Google access was not granted.", no_refresh: "Google did not return offline access. Remove the app at myaccount.google.com/permissions and connect again.", save: "Could not save the connection.", google: "Google rejected the connection. Please try again." };
const kb = (n: number | null) => n == null ? "—" : n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
export default async function BackupPage({ searchParams }: { searchParams: { err?: string; connected?: string } }) {
  const a = await adminCtx(); if (!a) redirect("/");
  const [{ data: st }, { data: runs }] = await Promise.all([a.sb.rpc("integration_status", { p_provider: "google_drive" }), a.sb.from("backup_runs").select("id,trigger,status,started_at,file_name,size_bytes,error").order("started_at", { ascending: false }).limit(15)]);
  const s = Array.isArray(st) ? st[0] : st, connected = Boolean(s?.connected), last = (runs ?? []).find((r: any) => r.status === "ok");
  const fmt = (d: string) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (<div className="mx-auto max-w-3xl space-y-4">
    <div><h1 className="text-xl font-semibold">Backup</h1><p className="text-sm text-slate-500">A full copy of your company data is saved to your Google Drive every night (folder “{BACKUP_FOLDER}”), keeping the latest {RETENTION}.</p></div>
    {searchParams.connected && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Google Drive connected. The first backup is running now.</p>}
    {searchParams.err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ERR[searchParams.err] ?? "Something went wrong."}</p>}
    <section className="space-y-3 rounded-xl border bg-white p-4 text-sm">
      <div className="flex justify-between"><span className="text-slate-500">Google Drive</span><span>{connected ? `Connected${s?.account_label ? ` · ${s.account_label}` : ""}` : googleConfigured() ? "Not connected" : "Not configured on this server"}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Last successful backup</span><span>{last ? fmt(last.started_at) : "Never"}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Schedule</span><span>Daily, 2:00 AM IST</span></div>
      <BackupActions connected={connected} /></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-2 font-medium">History</h2>
      {(runs ?? []).length === 0 ? <p className="text-sm text-slate-500">No backups yet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-1">When</th><th>Type</th><th>Status</th><th>File</th><th>Size</th></tr></thead><tbody>
        {(runs ?? []).map((r: any) => <tr key={r.id} className="border-t align-top"><td className="py-1.5">{fmt(r.started_at)}</td><td>{r.trigger === "cron" ? "Automatic" : "Manual"}</td><td className={r.status === "ok" ? "text-emerald-700" : r.status === "failed" ? "text-red-600" : "text-amber-600"} title={r.error ?? ""}>{r.status === "ok" ? "Saved" : r.status === "failed" ? "Failed" : "Running"}{r.error ? <div className="max-w-[16rem] text-xs text-red-500">{r.error}</div> : null}</td><td className="break-all">{r.file_name ?? "—"}</td><td>{kb(r.size_bytes)}</td></tr>)}
      </tbody></table></div>}</section>
    <p className="text-xs text-slate-400">To restore, download a backup, contact support with the file; backups include all branch, sales, customer, stock, payroll and settings records for your company.</p>
  </div>);
}
