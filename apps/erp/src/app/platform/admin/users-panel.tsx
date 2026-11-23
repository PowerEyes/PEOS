"use client";
import { useState, useTransition } from "react";
import { addPlatformUser, setPlatformUserRole, setPlatformUserActive } from "../actions";

const ROLES = ["super_admin", "support", "billing", "read_only"] as const;

export function PlatformUsersPanel({ users, canManage }: { users: any[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("support");

  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Platform users</p>
        {canManage && (
          <form className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setMsg({}); start(async () => { const r = await addPlatformUser({ email, platform_role: role }); setMsg(r); if (r.ok) setEmail(""); }); }}>
            <input className="input w-56" placeholder="email@platform.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <select className="input w-40" value={role} onChange={(e) => setRole(e.target.value as any)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
            <button disabled={pending} className="btn bg-gold-500 text-slate-950 disabled:opacity-50">Add</button>
          </form>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Email</th><th>Role</th><th>Status</th>{canManage && <th></th>}</tr></thead>
        <tbody className="divide-y divide-slate-800">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="py-2">{u.email}</td>
              <td className="capitalize text-slate-400">{u.platform_role.replace("_", " ")}</td>
              <td>{u.is_active ? <span className="text-emerald-400">Active</span> : <span className="text-rose-400">Disabled</span>}</td>
              {canManage && (
                <td className="text-right text-xs">
                  <button className="mr-3 text-gold-400 hover:underline" disabled={pending}
                    onClick={() => start(async () => { const r = await setPlatformUserRole(u.id, u.platform_role === "super_admin" ? "support" : "super_admin"); setMsg(r); })}>Toggle super</button>
                  <button className={u.is_active ? "text-rose-400 hover:underline" : "text-emerald-400 hover:underline"} disabled={pending}
                    onClick={() => start(async () => { const r = await setPlatformUserActive(u.id, !u.is_active); setMsg(r); })}>{u.is_active ? "Disable" : "Enable"}</button>
                </td>
              )}
            </tr>
          ))}
          {!users.length && <tr><td colSpan={4} className="py-3 text-slate-500">No platform users. Add yourself to grant access.</td></tr>}
        </tbody>
      </table>
      {msg.error && <p className="mt-2 text-xs text-rose-400">{msg.error}</p>}
      {msg.ok && <p className="mt-2 text-xs text-emerald-400">{msg.ok}</p>}
    </div>
  );
}
