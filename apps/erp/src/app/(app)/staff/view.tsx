"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, Drawer, useToast } from "@poweros/ui";
import { CheckCircle2, UserX, Shield, UserPlus, Pencil, Mail, Phone, Building2 } from "lucide-react";
import { approveStaff, updateStaff, inviteByEmail } from "./actions";

// Mirrors profiles_role_key_chk + rbac.ts GRANTABLE_ROLES. Order matters:
// the invite drawer defaults to the first entry.
const ROLES = ["staff","branch_manager","optometrist","receptionist","sales_executive","cashier","inventory_manager","lab_technician","accountant","admin","owner"] as const;
type Role = typeof ROLES[number];

function Avatar({ name }: { name?: string }) {
  const ch = (name??"?")[0].toUpperCase();
  const colors = ["bg-blue-600","bg-violet-600","bg-emerald-600","bg-rose-600","bg-amber-600","bg-navy-700"];
  const c = colors[ch.charCodeAt(0) % colors.length];
  return <div className={`grid h-10 w-10 place-items-center rounded-full ${c} text-sm font-bold text-white shrink-0`}>{ch}</div>;
}

export function StaffView({ staff, branches }: { staff: any[]; branches: any[] }) {
  const router = useRouter(); const toast = useToast();
  const [busy, setBusy] = useState<string|null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(""); const [inviteRole, setInviteRole] = useState<Role>("staff"); const [inviteBranch, setInviteBranch] = useState("");

  const pending     = staff.filter(s => !s.is_approved && !s.deactivated);
  const active      = staff.filter(s =>  s.is_approved && !s.deactivated);
  const deactivated = staff.filter(s =>  s.deactivated);

  async function run<T>(id: string, fn: () => Promise<{ error?: string; ok?: string }>) {
    setBusy(id); const r = await fn(); setBusy(null);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  async function sendInvite() {
    setBusy("invite"); const r = await inviteByEmail(inviteEmail, inviteRole, inviteBranch || branches[0]?.id || null); setBusy(null);
    r.error ? toast(r.error, "err") : (toast(r.ok!), setInviteOpen(false), setInviteEmail(""));
  }

  const needReview = staff.filter(s => s.is_approved && !s.deactivated && s.branch_reviewed === false);
  const branchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? "All branches";

  function StaffRow({ s }: { s: any }) {
    const review = s.is_approved && !s.deactivated && s.branch_reviewed === false;
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar name={s.full_name}/>{review && <button title="Branch was auto-assigned. Click to confirm." disabled={busy===s.id} onClick={()=>run(s.id, ()=>updateStaff(s.id,{branch_id:s.branch_id}))} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Confirm branch</button>}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold text-sm truncate">{s.full_name || <span className="text-slate-400 italic">Name not set</span>}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Building2 size={11}/>{branchName(s.branch_id)}</span>
              <span>Joined {new Date(s.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</span>
            </div>
          </div>
          <Pill tone={s.deactivated?"red":s.is_approved?"green":"gold"} className="shrink-0 sm:hidden">
            {s.deactivated?"Deactivated":s.is_approved?s.role_key:"Pending"}
          </Pill>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Role selector for approved staff */}
          {s.is_approved && !s.deactivated && (
            <select value={s.role_key} disabled={busy===s.id}
              onChange={e=>run(s.id, ()=>updateStaff(s.id,{role_key:e.target.value}))}
              className="field w-auto py-1.5 text-xs sm:text-sm capitalize">
              {ROLES.map(r=><option key={r} value={r} className="capitalize">{r}</option>)}
            </select>)}

          {/* Branch selector for approved staff */}
          {s.is_approved && !s.deactivated && (
            <select value={s.branch_id??""} disabled={busy===s.id}
              onChange={e=>run(s.id, ()=>updateStaff(s.id,{branch_id:e.target.value||null}))}
              className="field w-auto py-1.5 text-xs sm:text-sm">
              <option value="">All branches</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>)}

          {/* Pending — approve / reject buttons */}
          {!s.is_approved && !s.deactivated && (
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button disabled={busy===s.id} onClick={()=>run(s.id, ()=>approveStaff(s.id,"staff"))}
                className="btn btn-primary !py-1.5 text-xs gap-1 flex-1 sm:flex-initial"><CheckCircle2 size={13}/>Staff</button>
              <button disabled={busy===s.id} onClick={()=>run(s.id, ()=>approveStaff(s.id,"admin"))}
                className="btn btn-ghost !py-1.5 text-xs gap-1 flex-1 sm:flex-initial"><Shield size={13}/>Admin</button>
              <button disabled={busy===s.id} onClick={()=>run(s.id, ()=>updateStaff(s.id,{deactivated:true}))}
                className="btn btn-ghost !py-1.5 text-xs text-rose-600 gap-1"><UserX size={13}/>Reject</button>
            </div>)}

          {/* Active — deactivate button */}
          {s.is_approved && !s.deactivated && (
            <button disabled={busy===s.id}
              onClick={()=>{ if(confirm(`Deactivate ${s.full_name}? They will lose access immediately.`)) run(s.id, ()=>updateStaff(s.id,{deactivated:true})); }}
              className="btn btn-ghost !py-1.5 text-xs text-rose-600 gap-1"><UserX size={13}/>Deactivate</button>)}

          {/* Deactivated — reactivate */}
          {s.deactivated && (
            <button disabled={busy===s.id}
              onClick={()=>run(s.id, ()=>updateStaff(s.id,{deactivated:false, is_approved:true}))}
              className="btn btn-ghost !py-1.5 text-xs gap-1"><CheckCircle2 size={13}/>Reactivate</button>)}

          <Pill tone={s.deactivated?"red":s.is_approved?"green":"gold"} className="shrink-0 hidden sm:inline-flex">
            {s.deactivated?"Deactivated":s.is_approved?s.role_key:"Pending"}
          </Pill>
        </div>
      </div>);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {needReview.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{needReview.length} staff were automatically assigned to a branch during the upgrade. Use “Confirm branch” (or change their branch) — branch access depends on it.</div>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">Staff & Users</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{active.length} active · {pending.length} pending · {deactivated.length} deactivated</p>
        </div>
        <button onClick={()=>setInviteOpen(true)} className="btn btn-primary gap-2 self-start sm:self-auto"><UserPlus size={16}/>Invite staff</button>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="card overflow-hidden ring-1 ring-amber-200">
          <div className="flex items-center justify-between bg-amber-50 px-4 py-2.5">
            <p className="text-sm font-semibold text-amber-900">⏳ Pending approval ({pending.length})</p>
            <p className="text-xs text-amber-700">These users registered and are waiting for access</p>
          </div>
          <div className="divide-y divide-slate-100">{pending.map(s=><StaffRow key={s.id} s={s}/>)}</div>
        </div>)}

      {/* Active */}
      <div className="card overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Active staff ({active.length})</p>
        </div>
        <div className="divide-y divide-slate-100">
          {active.length === 0
            ? <p className="px-4 py-8 text-center text-sm text-slate-400">No active staff yet. Approve a pending user or invite someone.</p>
            : active.map(s=><StaffRow key={s.id} s={s}/>)}
        </div>
      </div>

      {/* Deactivated */}
      {deactivated.length > 0 && (
        <div className="card overflow-hidden opacity-70">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-500">Deactivated ({deactivated.length})</p>
          </div>
          <div className="divide-y divide-slate-100">{deactivated.map(s=><StaffRow key={s.id} s={s}/>)}</div>
        </div>)}

      {/* How it works info */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How to add staff</p>
        <p>Share the PowerOS login URL with your team member. They sign up with their email — they will appear here as Pending. Click <b>Approve</b>, assign their role and branch, and they can log in immediately.</p>
        <p className="text-xs text-blue-600 mt-2">Owner can approve admins. Admin can approve staff. Neither can modify the owner account.</p>
      </div>

      {/* Invite drawer */}
      <Drawer open={inviteOpen} onClose={()=>setInviteOpen(false)} title="Invite a staff member"
        subtitle="They will need to sign up using the PowerOS URL and the email you enter here"
        footer={<>
          <button onClick={()=>setInviteOpen(false)} className="btn btn-ghost">Cancel</button>
          <button disabled={busy==="invite"||!inviteEmail} onClick={sendInvite} className="btn btn-primary">
            {busy==="invite"?"Sending…":"Send instructions"}
          </button></>}>
        <div className="space-y-4 p-1">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email address *</span>
            <div className="relative"><Mail size={16} className="absolute left-3 top-3 text-slate-400"/><input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="colleague@example.com" className="field pl-9"/></div>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Role to assign on approval</span>
            <select value={inviteRole} onChange={e=>setInviteRole(e.target.value as Role)} className="field capitalize">
              {ROLES.map(r=><option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
            <select value={inviteBranch} onChange={e=>setInviteBranch(e.target.value)} className="field"><option value="">{branches[0]?.name ?? "Branch"}</option>{branches.slice(1).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </label>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1">
            <p><b>Staff</b> — Can serve customers, create sales and manage lab orders</p>
            <p><b>Specialised roles</b> — Optometrist, reception, sales, cashier, inventory, lab and accountant open with role-appropriate permissions (tune them under Staff → Permissions)</p>
            <p><b>Admin</b> — All staff permissions + manage inventory, view finance, approve staff</p>
            <p><b>Owner</b> — Full access including settings, staff roles and discount overrides</p>
          </div>
        </div>
      </Drawer>
    </div>);
}
