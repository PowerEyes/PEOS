"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS, GRANTABLE_ROLES, ROLE_LABELS } from "@/lib/rbac";
import { setRolePermission } from "./actions";
// Owners/admins always have every permission; this grid grants the rest, role
// by role. Every row is a real role_permissions write (audited in the DB).
export function Permissions({ rows }: { rows: { role_key: string; permission: string; allowed: boolean }[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  const val = (role: string, perm: string) => rows.find((r) => r.role_key === role && r.permission === perm)?.allowed ?? role === "branch_manager";
  async function toggle(role: string, perm: string) {
    setBusy(role + perm); const r = await setRolePermission(role, perm, !val(role, perm)); setBusy(""); setMsg(r.error ?? r.ok ?? ""); router.refresh();
  }
  return (<section className="card space-y-3 p-4"><div><h2 className="font-semibold">Role permissions</h2>
    <p className="text-xs text-slate-500">Branch data stays limited to each person&apos;s branch. These switches control sensitive areas — each role starts with sensible defaults. Changes apply on the next page load and are audited.</p></div>
    {msg && <p className="text-sm text-slate-600">{msg}</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500">
      <th className="py-1 pr-3">Permission</th>
      {GRANTABLE_ROLES.map((role) => (<th key={role} className="py-1 px-1 text-center whitespace-nowrap">{ROLE_LABELS[role] ?? role}</th>))}
    </tr></thead>
    <tbody>{PERMISSIONS.map((p) => (<tr key={p.key} className="border-t"><td className="py-2 pr-3">{p.label}</td>
      {GRANTABLE_ROLES.map((role) => (<td key={role} className="text-center">
        <input type="checkbox" aria-label={`${p.label} for ${ROLE_LABELS[role] ?? role}`} disabled={busy === role + p.key} checked={val(role, p.key)} onChange={() => toggle(role, p.key)} className="h-4 w-4 accent-emerald-600" /></td>))}</tr>))}</tbody></table></div></section>);
}
