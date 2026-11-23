import { History } from "lucide-react";
import { SectionCard } from "./ui";

function changedKeys(row:any) {
  const a=row.old_data??{}, b=row.new_data??{};
  return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>k!="updated_at"&&JSON.stringify(a[k])!==JSON.stringify(b[k])).slice(0,6).join(", ");
}
export function ChangeHistorySection({rows}:{rows:any[]}) {
  return <SectionCard title="Settings change history" icon={History}>
    <p className="mb-3 text-xs text-slate-500">Recent changes to organisation details, branches, settings and message templates. Values are omitted from this view; use the audit log for a full review.</p>
    {!rows.length?<p className="py-6 text-center text-sm text-slate-500">No settings changes recorded yet.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">When</th><th className="p-2">Area</th><th className="p-2">Change</th><th className="p-2">Actor</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-b last:border-0"><td className="whitespace-nowrap p-2">{new Date(r.at).toLocaleString("en-IN")}</td><td className="p-2 capitalize">{String(r.table_name).replace("org_settings","Settings").replace("message_templates","Message template")}</td><td className="p-2">{r.action?.toLowerCase()} {r.table_name==="org_settings"?(r.new_data?.key??r.old_data?.key):changedKeys(r)}</td><td className="p-2 font-mono text-xs text-slate-500">{r.user_id?`${String(r.user_id).slice(0,8)}…`:"System"}</td></tr>)}</tbody></table></div>}
  </SectionCard>;
}
