import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import { PortalLayout } from "@/components/PortalLayout";
import { inr } from "@/lib/types";
import { FolderOpen, Receipt, CreditCard, FileText, Eye, Wrench } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

const dStr = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");

const ORDER_BADGE: Record<string, { label: string; cls: string }> = {
  draft:          { label: "Processing",     cls: "bg-slate-100 text-slate-600" },
  sent:           { label: "Sent",           cls: "bg-slate-100 text-slate-600" },
  lab_pending:    { label: "In Production",  cls: "bg-blue-50 text-blue-700" },
  in_workshop:    { label: "In Workshop",    cls: "bg-violet-50 text-violet-700" },
  qc:             { label: "Quality Check",  cls: "bg-orange-50 text-orange-700" },
  ready:          { label: "Ready for Pickup", cls: "bg-emerald-50 text-emerald-700" },
  delivered:      { label: "Delivered",      cls: "bg-emerald-50 text-emerald-700" },
  cancelled:      { label: "Cancelled",      cls: "bg-rose-50 text-rose-600" },
};
const PAY_BADGE: Record<string, { label: string; cls: string }> = {
  unpaid:   { label: "Unpaid",   cls: "bg-rose-50 text-rose-600" },
  partial:  { label: "Partial",  cls: "bg-amber-50 text-amber-700" },
  paid:     { label: "Paid",     cls: "bg-emerald-50 text-emerald-700" },
  success:  { label: "Paid",     cls: "bg-emerald-50 text-emerald-700" },
  failed:   { label: "Failed",   cls: "bg-rose-50 text-rose-600" },
  pending:  { label: "Pending",  cls: "bg-amber-50 text-amber-700" },
  refunded: { label: "Refunded", cls: "bg-blue-50 text-blue-700" },
};
const REPAIR_LABEL: Record<string, string> = { pending: "Pending", in_progress: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled" };
const REPAIR_BADGE: Record<string, string> = { pending: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", ready: "bg-emerald-100 text-emerald-700", delivered: "bg-slate-100 text-slate-600", cancelled: "bg-rose-100 text-rose-600" };

function DocSection({ title, icon, count, action, empty, children }: {
  title: string; icon: React.ReactNode; count: number;
  action?: React.ReactNode; empty: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-bold text-lg text-navy-900 flex items-center gap-2">
          {icon}{title}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span>
        </h2>
        {action}
      </div>
      {count === 0
        ? <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center text-sm text-slate-500">{empty}</div>
        : <div className="space-y-3">{children}</div>}
    </section>
  );
}

export default async function DocumentsPage() {
  const site = await getSiteSettings();
  const customer = await getCustomer();
  if (!customer) redirect("/my/login");
  const sb = supabaseServer();
  const cid = customer.id;

  // ── Every list below is read live from the database (RLS-scoped to this
  //    customer by supabase/migrations/0019_customer_document_access.sql).
  //    Column names are the ones that exist in the live schema.
  const [invoicesRes, storePayRes, onlinePayRes, rxRes, examsRes, repairsRes] = await Promise.all([
    sb.from("sales")
      .select("id, code, status, payment_status, grand_total, paid_total, created_at, sale_lines(description, qty, line_total)")
      .eq("customer_id", cid).eq("kind", "order")
      .order("created_at", { ascending: false }).limit(20),
    sb.from("payments")
      .select("id, amount, method, reference, created_at, sales!inner(id, code)")
      .eq("sales.customer_id", cid)
      .order("created_at", { ascending: false }).limit(20),
    sb.from("online_payments")
      .select("id, amount, status, razorpay_payment_id, created_at")
      .eq("customer_id", cid)
      .order("created_at", { ascending: false }).limit(20),
    sb.from("prescriptions")
      .select("id, rx_code, rx_date, valid_till, examined_by, rx_type, purpose, status, image_path, od_sph, od_cyl, os_sph, os_cyl, pd_far")
      .eq("customer_id", cid)
      .order("rx_date", { ascending: false }).limit(20),
    sb.from("eye_examinations")
      .select("id, created_at, examiner_name, va_od_dist_ua, va_os_dist_ua, od_sph, od_cyl, os_sph, os_cyl, pd_far, rx_type, lens_recommendation, notes, prescription_id")
      .eq("customer_id", cid)
      .order("created_at", { ascending: false }).limit(20),
    sb.from("repairs")
      .select("id, code, problem, status, priority, due_date, total_amount, paid, created_at, item_brand, item_model")
      .eq("customer_id", cid)
      .order("created_at", { ascending: false }).limit(20),
  ]);

  const invoices = (invoicesRes.data ?? []) as any[];
  const rxs = (rxRes.data ?? []) as any[];
  const exams = (examsRes.data ?? []) as any[];
  const repairs = (repairsRes.data ?? []) as any[];

  // In-store + online payments, merged into one receipt list (newest first).
  const receipts = [
    ...((storePayRes.data ?? []) as any[]).map((p) => ({
      key: `s-${p.id}`,
      amount: Number(p.amount ?? 0),
      label: p.method ? String(p.method).toUpperCase() : "IN-STORE",
      reference: p.reference as string | null,
      when: p.created_at as string,
      badge: PAY_BADGE.paid,
      orderCode: ((p.sales as any)?.code ?? null) as string | null,
    })),
    ...((onlinePayRes.data ?? []) as any[]).map((p) => ({
      key: `o-${p.id}`,
      amount: Number(p.amount ?? 0),
      label: "ONLINE",
      reference: (p.razorpay_payment_id ?? null) as string | null,
      when: p.created_at as string,
      badge: PAY_BADGE[p.status] ?? { label: String(p.status ?? ""), cls: "bg-slate-100 text-slate-600" },
      orderCode: null as string | null,
    })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  // Signed URLs (1 h) for prescription scans the customer is allowed to see.
  // If storage RLS has not been granted yet the call fails quietly and the
  // link is simply not shown — no broken promises.
  const scans: Record<string, string> = {};
  for (const r of rxs.slice(0, 5)) {
    if (!r.image_path) continue;
    try {
      const { data } = await sb.storage.from("prescriptions").createSignedUrl(String(r.image_path), 3600);
      if (data?.signedUrl) scans[r.id] = data.signedUrl;
    } catch { /* not viewable — skip */ }
  }

  const summary: [string, number][] = [
    ["Invoices", invoices.length],
    ["Receipts", receipts.length],
    ["Prescriptions", rxs.length],
    ["Eye Tests", exams.length],
    ["Repairs", repairs.length],
  ];

  return (
    <PortalLayout activePath="/my/documents">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white px-7 py-9 mb-7">
        <h1 className="font-extrabold text-3xl flex items-center gap-3"><FolderOpen size={28} />MY DOCUMENTS</h1>
        <p className="text-slate-300 mt-1">Every invoice, receipt, prescription and report linked to your account.</p>
        <div className="mt-4 flex flex-wrap gap-6">
          {summary.map(([label, n]) => (
            <div key={label}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="font-extrabold text-2xl text-gold-400">{n}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices & orders */}
      <DocSection
        title="Invoices & Orders" icon={<Receipt size={19} />} count={invoices.length}
        action={<Link href="/my/orders" className="text-xs font-semibold text-navy-700 hover:underline">View all orders →</Link>}
        empty={<>No invoices yet.<br /><Link href="/eyeglasses" className="mt-2 inline-block font-semibold text-navy-800 hover:underline">Shop eyewear →</Link></>}
      >
        {invoices.map((o) => {
          const lines = (o.sale_lines ?? []) as any[];
          return (
            <div key={o.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-navy-900">{o.code}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ORDER_BADGE[o.status]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                      {ORDER_BADGE[o.status]?.label ?? o.status}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PAY_BADGE[o.payment_status]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                      {PAY_BADGE[o.payment_status]?.label ?? o.payment_status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Placed {dStr(o.created_at)}{lines.length ? ` · ${lines.length} item${lines.length > 1 ? "s" : ""}` : ""}</p>
                  <div className="mt-1.5 space-y-0.5">
                    {lines.slice(0, 3).map((l, i) => <p key={i} className="text-xs text-slate-600">{l.qty}× {l.description} — {inr(l.line_total)}</p>)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-navy-900">{inr(o.grand_total)}</p>
                  {Number(o.paid_total) > 0 && <p className="text-xs text-slate-500">Paid {inr(o.paid_total)}</p>}
                  <Link href={`/my/orders/${o.id}`} className="mt-2 inline-block rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:border-navy-700 transition">View order</Link>
                </div>
              </div>
            </div>
          );
        })}
      </DocSection>

      {/* Payment receipts */}
      <DocSection
        title="Payment Receipts" icon={<CreditCard size={19} />} count={receipts.length}
        action={<Link href="/my/payments" className="text-xs font-semibold text-navy-700 hover:underline">View all payments →</Link>}
        empty={<>No payment receipts yet.</>}
      >
        {receipts.map((r) => (
          <div key={r.key} className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-navy-900">{r.label}{r.orderCode ? ` · ${r.orderCode}` : ""}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.badge.cls}`}>{r.badge.label}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {dStr(r.when)}{r.reference ? ` · Ref ${r.reference}` : ""}
              </p>
            </div>
            <p className="font-bold text-navy-900">{inr(r.amount)}</p>
          </div>
        ))}
      </DocSection>

      {/* Prescriptions */}
      <DocSection
        title="Prescriptions (Rx)" icon={<FileText size={19} />} count={rxs.length}
        action={<Link href="/my/prescriptions" className="text-xs font-semibold text-navy-700 hover:underline">View all prescriptions →</Link>}
        empty={<>No prescriptions on file yet.<br /><Link href="/eye-test" className="mt-2 inline-block font-semibold text-navy-800 hover:underline">Book an eye test →</Link></>}
      >
        {rxs.map((r) => {
          const valid = r.valid_till && new Date(r.valid_till) > new Date();
          return (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-navy-900">{r.rx_code ?? `Rx ${String(r.id).slice(0, 8).toUpperCase()}`}</p>
                  <p className="text-xs text-slate-400">
                    {dStr(r.rx_date)}{r.examined_by ? ` · Dr. ${r.examined_by}` : ""}{r.rx_type ? ` · ${r.rx_type}` : ""}{r.purpose ? ` · ${r.purpose}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {valid ? `Valid till ${dStr(r.valid_till)}` : r.valid_till ? "Expired" : "No expiry recorded"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Right Eye (OD)</p>
                  <p className="font-mono text-xs">{r.od_sph ?? "—"} / {r.od_cyl ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Left Eye (OS)</p>
                  <p className="font-mono text-xs">{r.os_sph ?? "—"} / {r.os_cyl ?? "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/my/prescriptions" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-navy-700 transition">Full prescription</Link>
                {scans[r.id] && (
                  <a href={scans[r.id]} target="_blank" rel="noopener noreferrer"
                     className="rounded-full border border-gold-400 px-3 py-1.5 text-xs font-medium text-gold-700 hover:bg-amber-50 transition">
                    📎 View scan
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </DocSection>

      {/* Eye test reports */}
      <DocSection
        title="Eye Test Reports" icon={<Eye size={19} />} count={exams.length}
        action={<Link href="/my/appointments" className="text-xs font-semibold text-navy-700 hover:underline">My appointments →</Link>}
        empty={<>No eye test reports yet.<br /><Link href="/eye-test" className="mt-2 inline-block font-semibold text-navy-800 hover:underline">Book an eye test →</Link></>}
      >
        {exams.map((e) => (
          <div key={e.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-navy-900">Eye Examination</p>
                <p className="text-xs text-slate-400">{dStr(e.created_at)}{e.examiner_name ? ` · ${e.examiner_name}` : ""}</p>
              </div>
              {e.rx_type && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{String(e.rx_type).replace(/_/g, " ")}</span>}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <p>Distance VA — OD {e.va_od_dist_ua ?? "—"} · OS {e.va_os_dist_ua ?? "—"}</p>
              <p>Refraction — OD {e.od_sph ?? "—"} / {e.od_cyl ?? "—"} · OS {e.os_sph ?? "—"} / {e.os_cyl ?? "—"}</p>
              {e.pd_far != null && <p>PD {e.pd_far} mm</p>}
              {e.lens_recommendation && <p>Recommended: {e.lens_recommendation}</p>}
            </div>
            {e.notes && <p className="mt-2 text-xs text-slate-500">📝 {e.notes}</p>}
            {e.prescription_id && (
              <div className="mt-3">
                <Link href="/my/prescriptions" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-navy-700 transition">View prescription →</Link>
              </div>
            )}
          </div>
        ))}
      </DocSection>

      {/* Repair job cards */}
      <DocSection
        title="Repair Job Cards" icon={<Wrench size={19} />} count={repairs.length}
        action={<Link href="/my/repairs" className="text-xs font-semibold text-navy-700 hover:underline">View all repairs →</Link>}
        empty={<>No repair job cards yet.<br /><Link href="/my/repairs" className="mt-2 inline-block font-semibold text-navy-800 hover:underline">Book a repair →</Link></>}
      >
        {repairs.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-navy-900">{r.code ?? `JOB ${String(r.id).slice(0, 8).toUpperCase()}`}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${REPAIR_BADGE[r.status] ?? "bg-slate-100 text-slate-500"}`}>
                    {REPAIR_LABEL[r.status] ?? r.status}
                  </span>
                  {r.priority === "urgent" && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600">Urgent</span>}
                </div>
                <p className="text-sm text-slate-700 mt-1">{r.problem}{r.item_brand ? ` · ${r.item_brand} ${r.item_model ?? ""}` : ""}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                  <span>Logged: {dStr(r.created_at)}</span>
                  {r.due_date && <span>Due: {dStr(r.due_date)}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-navy-900">{inr(Number(r.total_amount ?? 0))}</p>
                <p className={`text-xs font-semibold ${r.paid ? "text-emerald-600" : Number(r.total_amount) > 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {r.paid ? "Settled" : Number(r.total_amount) > 0 ? "Balance due" : "No charge"}
                </p>
                <Link href="/my/repairs" className="mt-2 inline-block rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:border-navy-700 transition">Open ticket</Link>
              </div>
            </div>
          </div>
        ))}
      </DocSection>

      <p className="text-xs text-slate-400">
        Documents are generated from your account records at Power Eyes Opticals.
        Need a copy by email or WhatsApp? <a href={waHref(site.whatsappNumber, "Please send me a copy of my documents")} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-700 hover:underline">Contact us</a>.
      </p>
    </PortalLayout>
  );
}
