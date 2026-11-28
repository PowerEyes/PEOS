import { redirect } from "next/navigation";
import { adminCtx } from "@/lib/admin-guard";
export const dynamic = "force-dynamic";
export default async function ErrorsPage() {
  const a = await adminCtx(); if (!a) redirect("/");
  const { data } = await a.sb.from("error_logs").select("id,app,message,path,created_at,stack").order("created_at", { ascending: false }).limit(100);
  return (<div className="mx-auto max-w-5xl space-y-3"><div><h1 className="text-xl font-semibold">System errors</h1><p className="text-sm text-slate-500">Errors raised in the ERP and the website over the last 60 days. Share an entry with support if a problem keeps happening.</p></div>
    {(data ?? []).length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No errors recorded.</p> :
      <ul className="divide-y rounded-xl border bg-white">{(data ?? []).map((e: any) => <li key={e.id} className="p-3 text-sm"><div className="flex justify-between gap-3"><span className="font-medium text-red-700">{e.message}</span><span className="shrink-0 text-xs text-slate-400">{new Date(e.created_at).toLocaleString("en-IN")}</span></div>
        <p className="text-xs text-slate-500">{e.app} · {e.path ?? "—"}</p>{e.stack && <details className="mt-1"><summary className="cursor-pointer text-xs text-slate-500">Details</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{e.stack}</pre></details>}</li>)}</ul>}</div>);
}
