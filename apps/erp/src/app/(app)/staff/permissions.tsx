"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@/lib/rbac";
import { setRolePermission } from "./actions";
// Owners/admins always have every permission; this grid controls branch managers and plain staff.
export function Permissions({ rows }: { rows: { role_key: string; permission: string; allowed: boolean }[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  const val = (role: string, perm: string) => rows.find((r) => r.role_key === role && r.permission === perm)?.allowed ?? role === "branch_manager";
  async function toggle(role: string, perm: string) {
    setBusy(role + perm); const r = await setRolePermission(role, perm, !val(role, perm)); setBusy(""); setMsg(r.error ?? r.ok ?? ""); router.refresh();
  }
  return (<section className="card space-y-3 p-4"><div><h2 className="font-semibold">Role permissions</h2>
    <p className="text-xs text-slate-500">Branch data stays limited to each person's branch. These switches control sensitive areas. Changes apply on the next page load and are audited.</p></div>
    {msg && <p className="text-sm text-slate-600">{msg}</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Permission</th><th className="text-center">Branch manager</th><th className="text-center">Staff</th></tr></thead>
      <tbody>{PERMISSIONS.map((p) => (<tr key={p.key} className="border-t"><td className="py-2">{p.label}</td>
        {["branch_manager", "staff"].map((role) => (<td key={role} className="text-center">
          <input type="checkbox" aria-label={`${p.label} for ${role}`} disabled={busy === role + p.key} checked={val(role, p.key)} onChange={() => toggle(role, p.key)} className="h-4 w-4 accent-emerald-600" /></td>))}</tr>))}</tbody></table></div></section>);
}
