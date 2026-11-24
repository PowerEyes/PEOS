import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

const DAYS = 30;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString();

/** Branch Manager performance view (plan phase 4): revenue, collections,
 *  daily trend, per-staff sales and appointment outcomes — all scoped to
 *  this branch by can_access_branch() + RLS on every query. */
export default async function BranchPerformancePage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();

  const { data: branch } = await sb.from("branches").select("*").eq("id", params.id).maybeSingle();
  if (!branch) notFound();

  // Managers see only their own branch's numbers; owners/admins pass for all.
  const { data: can } = await sb.rpc("can_access_branch", { b: params.id });
  if (!can) notFound();

  const sinceIso = new Date(Date.now() - DAYS * 86400000).toISOString();
  const sinceDay = sinceIso.slice(0, 10);

  const [salesRes, apptRes, staffRes] = await Promise.all([
    sb.from("sales")
      .select("id, grand_total, paid_total, payment_status, salesperson, created_at")
      .eq("branch_id", params.id).eq("kind", "order").neq("status", "cancelled")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }).limit(1000),
    sb.from("appointments").select("id, appt_date, status")
      .eq("branch_id", params.id).gte("appt_date", sinceDay),
    sb.from("profiles").select("id, full_name, role_key")
      .eq("branch_id", params.id).eq("deactivated", false),
  ]);

  const sales = salesRes.data ?? [];
  const appts = apptRes.data ?? [];
  const staff = staffRes.data ?? [];

  const revenue = sales.reduce((s, x) => s + (Number(x.grand_total) || 0), 0);
  const collected = sales.reduce((s, x) => s + (Number(x.paid_total) || 0), 0);
  const orders = sales.length;
  const avgOrder = orders ? revenue / orders : 0;

  const payPaid = sales.filter((s) => s.payment_status === "paid").length;
  const payPartial = sales.filter((s) => s.payment_status === "partial").length;
  const payUnpaid = sales.filter((s) => s.payment_status === "unpaid").length;

  // 30-day series; each row object is shared with byDay so buckets fill in place.
  const series: { day: string; rev: number; n: number }[] = [];
  const byDay = new Map<string, { day: string; rev: number; n: number }>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const row = { day, rev: 0, n: 0 };
    byDay.set(day, row);
    series.push(row);
  }
  for (const s of sales) {
    const row = byDay.get(s.created_at.slice(0, 10));
    if (row) { row.rev += Number(s.grand_total) || 0; row.n += 1; }
  }
  const maxRev = series.reduce((m, r) => Math.max(m, r.rev), 0);

  // Sales by staff (salesperson may reference someone who has since left).
  const byPerson = new Map<string, { rev: number; n: number }>();
  for (const s of sales) {
    const key = s.salesperson ?? "";
    const row = byPerson.get(key) ?? { rev: 0, n: 0 };
    row.rev += Number(s.grand_total) || 0;
    row.n += 1;
    byPerson.set(key, row);
  }
  const staffById = new Map(staff.map((p: any) => [p.id, p]));
  const ranking = [...byPerson.entries()]
    .map(([id, v]) => ({
      id,
      name: id ? (staffById.get(id)?.full_name ?? "Former staff") : "Unassigned",
      role: id ? (staffById.get(id)?.role_key ?? "") : "",
      ...v,
    }))
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 8);

  const apptDone = appts.filter((a) => a.status === "completed").length;
  const apptArrived = appts.filter((a) => a.status === "arrived").length;
  const apptNoShow = appts.filter((a) => a.status === "no_show").length;
  const apptPending = appts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;
  const apptCancelled = appts.filter((a) => a.status === "cancelled").length;
  const settled = apptDone + apptArrived + apptNoShow;
  const showRate = settled ? Math.round(((settled - apptNoShow) / settled) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{branch.name} — Performance</h1>
          <p className="text-sm text-slate-500">Last {DAYS} days · {orders} order{orders === 1 ? "" : "s"} · {staff.length} staff</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/branches/${params.id}`} className="btn btn-outline">Branch</Link>
          <Link href={`/branches/${params.id}/finance`} className="btn btn-outline">Finance</Link>
          <Link href={`/branches/${params.id}/cashbook`} className="btn btn-outline">Cashbook</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="text-2xl font-bold text-navy-900">{inr(revenue)}</p>
          <p className="text-xs text-slate-500">avg {inr(avgOrder)} / order</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">{inr(collected)}</p>
          <p className="text-xs text-slate-500">{inr(revenue - collected)} outstanding</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Orders</p>
          <p className="text-2xl font-bold text-navy-900">{orders}</p>
          <p className="text-xs text-slate-500">{payPaid} paid · {payPartial} partial · {payUnpaid} unpaid</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Appointment show rate</p>
          <p className="text-2xl font-bold text-navy-900">{showRate == null ? "—" : `${showRate}%`}</p>
          <p className="text-xs text-slate-500">{settled} settled · {apptNoShow} no-show</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Daily revenue</h3>
          <span className="text-xs text-slate-500">peak {inr(maxRev)}</span>
        </div>
        <div className="flex h-32 items-end gap-[2px]">
          {series.map((row) => (
            <div
              key={row.day}
              className="flex-1 rounded-t bg-navy-800/80"
              style={{ height: `${maxRev ? Math.max(row.rev > 0 ? 4 : 0, (row.rev / maxRev) * 100) : 0}%` }}
              title={`${row.day}: ${inr(row.rev)} (${row.n} order${row.n === 1 ? "" : "s"})`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{series[0]?.day}</span>
          <span>{series[series.length - 1]?.day}</span>
        </div>
        {!orders && <p className="mt-2 text-sm text-slate-500">No orders in this period.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-navy-900">Sales by staff</h3>
          {ranking.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Staff</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.id || "unassigned"} className="border-t">
                    <td className="py-2">
                      <p className="font-medium">{r.name}</p>
                      {r.role && <p className="text-xs capitalize text-slate-500">{r.role.replace(/_/g, " ")}</p>}
                    </td>
                    <td className="py-2 text-right">{r.n}</td>
                    <td className="py-2 text-right font-medium">{inr(r.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!ranking.length && <p className="text-sm text-slate-500">No orders in this period.</p>}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-navy-900">Appointments ({appts.length})</h3>
          {appts.length > 0 && (
            <ul className="space-y-2 text-sm">
              {([
                ["Completed", apptDone],
                ["Arrived (in progress)", apptArrived],
                ["No-show", apptNoShow],
                ["Scheduled / confirmed", apptPending],
                ["Cancelled", apptCancelled],
              ] as [string, number][]).map(([label, n]) => (
                <li key={label} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {!appts.length && <p className="text-sm text-slate-500">No appointments in this period.</p>}
        </div>
      </div>
    </div>
  );
}
