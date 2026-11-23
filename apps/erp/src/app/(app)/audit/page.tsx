import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getScopeCtx } from "@/lib/branch-scope";

export const dynamic = "force-dynamic";
const PAGE = 100;
export default async function Audit({ searchParams }: { searchParams: { t?: string; a?: string; p?: string } }) {
  const sb = supabaseServer(), page = Math.max(0, Number(searchParams.p) || 0), { scope } = await getScopeCtx();
  let q = sb.from("audit_log").select("id,table_name,row_id,action,old_data,new_data,at,user_id").order("at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
  if (scope) q = q.or(`new_data->>branch_id.eq.${scope},old_data->>branch_id.eq.${scope}`);
  if (searchParams.t) q = q.eq("table_name", searchParams.t);
  if (searchParams.a) q = q.eq("action", searchParams.a);
  const { data } = await q; const rows = (data ?? []).slice(0, PAGE), more = (data ?? []).length > PAGE;
  const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
  const { data: ppl } = ids.length ? await sb.from("profiles").select("id,full_name").in("id", ids) : { data: [] as any[] };
  const name = (id: string) => ppl?.find((p: any) => p.id === id)?.full_name ?? (id ? id.slice(0, 8) : "system");
  const diff = (r: any) => { const o = r.old_data ?? {}, n = r.new_data ?? {}; const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter(k => JSON.stringify(o[k]) !== JSON.stringify(n[k]) && !["updated_at"].includes(k));
    return keys.slice(0, 4).map(k => `${k}: ${r.action === "INSERT" ? "" : JSON.stringify(o[k]) + " → "}${JSON.stringify(n[k])}`.slice(0, 80)).join(" · "); };
  const href = (o: Record<string, string | number | undefined>) => "/audit?" + new URLSearchParams(Object.entries({ ...searchParams, ...o }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return (<div className="mx-auto max-w-6xl space-y-3 p-4 sm:p-6">
    <div><h1 className="font-display text-2xl font-semibold">Audit log</h1><p className="text-sm text-slate-500">Permission, staff, invitation, transfer and other sensitive changes. Read-only and tamper-proof.</p></div>
    <form className="flex flex-wrap gap-2"><input name="t" defaultValue={searchParams.t} placeholder="Table (e.g. profiles)" className="field text-sm" />
      <select name="a" defaultValue={searchParams.a ?? ""} className="field text-sm"><option value="">All actions</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option></select>
      <button className="btn btn-ghost text-sm">Filter</button></form>
    <div className="card overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="p-2">When</th><th>Who</th><th>Table</th><th>Action</th><th>Change</th></tr></thead>
      <tbody>{rows.map((r: any) => (<tr key={r.id} className="border-t align-top"><td className="whitespace-nowrap p-2">{new Date(r.at).toLocaleString("en-IN")}</td><td>{name(r.user_id)}</td><td>{r.table_name}</td><td>{r.action}</td><td className="max-w-md break-words text-slate-600">{diff(r)}</td></tr>))}
        {!rows.length && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No entries.</td></tr>}</tbody></table></div>
    <div className="flex gap-3 text-sm">{page > 0 && <Link href={href({ p: page - 1 })} className="underline">← Newer</Link>}{more && <Link href={href({ p: page + 1 })} className="underline">Older →</Link>}</div>
  </div>);
}
