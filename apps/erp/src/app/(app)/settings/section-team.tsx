import Link from "next/link";
import { PERMISSIONS } from "@/lib/rbac";

// Read-only summary of what each role can do. Fixed rules mirror the database policies; switchable ones are edited in Staff.
const FIXED: [string, string, string, string, string][] = [
  ["See all branches' data (read-only)", "✓", "✓", "✓", "✓"],
  ["Edit data in own branch", "✓", "✓", "✓", "✓"],
  ["Edit another branch's data", "✓", "✓", "—", "—"],
  ["Switch to all-branch view and dashboard", "✓", "✓", "—", "—"],
  ["Reports and CRM automation", "✓", "✓", "✓", "—"],
  ["View product cost prices", "✓", "✓", "✓", "—"],
  ["Settings, Website Studio, Staff", "✓", "✓", "—", "—"],
  ["Invite staff and manage roles", "✓", "✓ (not owners/admins)", "—", "—"],
];
export function TeamSection({ canEdit }: { canEdit: boolean }) {
  const cell = (v: string) => <td className={`px-2 text-center ${v === "—" ? "text-slate-300" : "text-emerald-700"}`}>{v}</td>;
  return (<div className="space-y-4">
    <section className="card space-y-2 p-4"><h2 className="font-semibold">Team & access</h2>
      <p className="text-sm text-slate-500">Invite people, set their branch and role, and grant temporary cross-branch access.</p>
      <div className="flex flex-wrap gap-2"><Link href="/staff" className="btn btn-primary text-sm">Open Staff</Link><Link href="/setup" className="btn btn-ghost text-sm">Setup checklist</Link></div>
      {!canEdit && <p className="text-xs text-amber-700">Only owners and admins can change roles.</p>}</section>
    <section className="card space-y-2 p-4"><h2 className="font-semibold">What each role can do</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Capability</th><th className="px-2">Owner</th><th className="px-2">Admin</th><th className="px-2">Manager</th><th className="px-2">Staff</th></tr></thead>
        <tbody>{FIXED.map(([l, ...v]) => <tr key={l} className="border-t"><td className="py-1.5">{l}</td>{v.map((x, i) => <Fragment2 key={i}>{cell(x)}</Fragment2>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-slate-500">Switchable per role in Staff → Role permissions: {PERMISSIONS.map(p => p.label).join("; ")}.</p></section>
  </div>);
}
const Fragment2 = ({ children }: { children: React.ReactNode }) => <>{children}</>;
