
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ChevronLeft, Check, Clock, Wrench, Package, Phone, ImageOff } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const dStr = (d: string, withTime = false) => d
  ? new Date(d).toLocaleDateString("en-IN", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" })
  : "—";

const STEPS = [
  { key: "pending",    label: "Ticket Registered", icon: Clock },
  { key: "in_progress", label: "In Progress",      icon: Wrench },
  { key: "ready",      label: "Ready for Pickup",  icon: Package },
  { key: "delivered",  label: "Delivered",         icon: Check },
];
const STEP_ORDER = STEPS.map((s) => s.key);

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  in_progress: "text-blue-700 bg-blue-50 border-blue-200",
  ready: "text-emerald-700 bg-emerald-50 border-emerald-200",
  delivered: "text-slate-600 bg-slate-100 border-slate-200",
  cancelled: "text-rose-600 bg-rose-50 border-rose-200",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", in_progress: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};

export default async function RepairDetailPage({ params }: { params: { id: string } }) {
  const site = await getSiteSettings();
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");

  const { data: customer } = await sb.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!customer) redirect("/my/login");

  const { data: repair } = await sb.from("repairs")
    .select("id,code,problem,item_type,item_brand,item_model,item_color,frame_no,status,priority,due_date,total_amount,paid,created_at,technician_notes,images,after_images,photo_consent,photo_consent_at,branches(name,address)")
    .eq("id", params.id).eq("customer_id", customer.id).maybeSingle();

  if (!repair) notFound();

  const [{ data: events }, ...photoUrls] = await Promise.all([
    sb.from("repair_events").select("from_status,to_status,note,at").eq("repair_id", repair.id).order("at", { ascending: true }),
    ...[...(repair.images ?? []), ...(repair.after_images ?? [])].map((p: string) =>
      sb.storage.from("repair-images").createSignedUrl(p, 3600).then(({ data }) => data?.signedUrl ?? "")),
  ]);
  const intakeUrls = photoUrls.slice(0, (repair.images ?? []).length);
  const afterUrls = photoUrls.slice((repair.images ?? []).length);

  const st = repair.status ?? "pending";
  const cancelled = st === "cancelled";
  const stepIdx = STEP_ORDER.indexOf(st);

  return (
    <PortalLayout activePath="/my/repairs">
      <LiveRefresh seconds={30} />

      <Link href="/my/repairs" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700 mb-5 transition">
        <ChevronLeft size={16} />Back to My Repairs
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-navy-800 text-white px-6 py-8 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-slate-400 text-xs mb-1">Repair Ticket</p>
            <h1 className="font-bold text-2xl font-mono tracking-wide">{repair.code || "—"}</h1>
            <p className="text-slate-300 text-sm mt-1">Registered on {dStr(repair.created_at)}</p>
          </div>
          <span className={`rounded-full border px-4 py-1.5 text-sm font-bold ${STATUS_STYLE[st] ?? STATUS_STYLE.pending}`}>
            {STATUS_LABEL[st] ?? st}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Stepper */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-navy-900 mb-5">Repair Progress</p>
            {cancelled ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                This repair ticket was cancelled. Need help? Contact us on WhatsApp.
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-3 bottom-3 w-px bg-slate-200" />
                <div className="space-y-5">
                  {STEPS.map((s, i) => {
                    const done = stepIdx >= i;
                    const current = stepIdx === i;
                    return (
                      <div key={s.key} className="flex items-center gap-4 relative">
                        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 z-10 transition ${done ? "bg-navy-800 border-navy-800 text-white" : "bg-white border-slate-200 text-slate-300"}`}>
                          {done ? <Check size={13} /> : <s.icon size={13} />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${done ? "text-navy-900" : "text-slate-400"}`}>{s.label}</p>
                          {current && <p className="text-xs text-gold-600 font-medium">Current status</p>}
                        </div>
                        {current && <span className="h-2 w-2 rounded-full bg-gold-500 animate-pulse shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {repair.due_date && !cancelled && (
              <div className="mt-4 rounded-xl bg-navy-50 border border-navy-100 p-3 text-sm text-navy-800">
                📅 Expected by <b>{dStr(repair.due_date)}</b>
              </div>
            )}
          </div>

          {/* Problem + notes */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-navy-900 mb-2 text-rose-700">Problem Reported</p>
            <p className="text-sm text-slate-700">{repair.problem}</p>
            {repair.technician_notes && (
              <>
                <p className="font-bold text-navy-900 mt-4 mb-2">Technician Notes</p>
                <p className="text-sm text-slate-700">{repair.technician_notes}</p>
              </>
            )}
          </div>

          {/* Photos */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-navy-900 mb-4">Photos</p>
            {intakeUrls.length === 0 && afterUrls.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-500">
                <ImageOff size={16} />
                {repair.photo_consent
                  ? `No photos were attached — consent recorded${repair.photo_consent_at ? ` on ${dStr(repair.photo_consent_at)}` : ""}.`
                  : "No photos attached to this ticket yet."}
              </div>
            ) : (
              <div className="space-y-4">
                {intakeUrls.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">As received</p>
                    <div className="grid grid-cols-3 gap-3">
                      {intakeUrls.map((u: string, i: number) => u && (
                        <a key={i} href={u} target="_blank" rel="noreferrer"
                          className="block aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                          <img src={u} alt={`Intake photo ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {afterUrls.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">After repair</p>
                    <div className="grid grid-cols-3 gap-3">
                      {afterUrls.map((u: string, i: number) => u && (
                        <a key={i} href={u} target="_blank" rel="noreferrer"
                          className="block aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                          <img src={u} alt={`After photo ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-navy-900 mb-4">Status History</p>
            {(!events || events.length === 0) ? (
              <p className="text-sm text-slate-500">No status changes yet — updates will appear here as the repair progresses.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-3 bottom-3 w-px bg-slate-200" />
                <div className="space-y-4">
                  {(events as any[]).map((e, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className="z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-slate-200 bg-white">
                        <Clock size={13} className="text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-navy-900">
                          {e.to_status ? (STATUS_LABEL[e.to_status] ?? e.to_status.replace("_", " ")) : "Updated"}
                          {e.from_status && <span className="font-normal text-slate-400">{" "}from {STATUS_LABEL[e.from_status] ?? e.from_status.replace("_", " ")}</span>}
                        </p>
                        {e.note && <p className="text-xs text-slate-500">{e.note}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{dStr(e.at, true)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-3 text-sm">
            <p className="font-bold text-navy-900">Repair Info</p>
            <div className="flex justify-between"><span className="text-slate-500">Item</span>
              <span className="text-right font-medium text-slate-700">
                {[repair.item_type, repair.item_brand, repair.item_model].filter(Boolean).join(" · ") || "—"}
              </span></div>
            {repair.item_color && <div className="flex justify-between"><span className="text-slate-500">Colour</span><span className="text-slate-700">{repair.item_color}</span></div>}
            {repair.frame_no && <div className="flex justify-between"><span className="text-slate-500">Frame no.</span><span className="text-slate-700">{repair.frame_no}</span></div>}
            <div className="flex justify-between"><span className="text-slate-500">Priority</span>
              <span className="capitalize font-medium text-slate-700">{repair.priority ?? "medium"}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-3"><span className="text-slate-500">Charges</span>
              <span className="font-bold text-navy-900">{inr(repair.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Payment</span>
              <span className={`font-semibold ${repair.paid ? "text-emerald-600" : "text-amber-600"}`}>
                {repair.paid ? "Paid" : Number(repair.total_amount) > 0 ? "Due on pickup" : "No charge"}
              </span></div>
            {repair.branches && (
              <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-slate-500">
                <span>📍</span>
                <span className="text-xs">{(repair.branches as any).name}{(repair.branches as any).address ? ` — ${(repair.branches as any).address}` : ""}</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="font-bold text-navy-900">Actions</p>
            <a href={waHref(site.whatsappNumber, `Status update for repair ticket ${repair.code || repair.id.slice(0, 8).toUpperCase()}`)} target="_blank"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition">
              💬 Track via WhatsApp
            </a>
            <Link href="/my/repairs/new"
              className="flex items-center justify-center gap-2 rounded-xl border border-navy-800 px-4 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50 transition">
              + Register another repair
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-center">
            <p className="text-slate-500">Need help with this ticket?</p>
            <div className="flex justify-center gap-3 mt-2">
              <a href={`tel:${site.phones[0]}`} className="flex items-center gap-1 text-navy-700 font-semibold hover:underline"><Phone size={13} />Call us</a>
              <a href={waHref(site.whatsappNumber)} target="_blank" className="flex items-center gap-1 text-emerald-700 font-semibold hover:underline">💬 WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
