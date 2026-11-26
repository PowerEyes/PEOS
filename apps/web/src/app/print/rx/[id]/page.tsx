import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata = { title: "Print Prescription" };

const dStr = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const f = (n: number | string | null | undefined, digits = 2) =>
  n == null || n === "" ? "—" : Number(n).toFixed(digits);

export default async function PrintRxPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  // RLS scopes prescriptions to their owner (see 0019_customer_document_access),
  // so a signed-out visitor is sent to login and a stranger to a 404.
  if (!user) redirect("/login");

  const { data: rx } = await sb
    .from("prescriptions")
    .select(
      "id, rx_code, rx_date, valid_till, examined_by, rx_type, purpose, " +
      "od_sph, od_cyl, od_axis, od_add, od_va_dist, od_va_near, " +
      "os_sph, os_cyl, os_axis, os_add, os_va_dist, os_va_near, " +
      "pd_far, pd_near, remarks, status, branch_id, " +
      "customers(full_name, phone, customer_code, vision_id)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!rx) notFound();
  const r = rx as any;
  const patient = (r.customers ?? null) as any;

  // Fetch branch/store info from database
  let storeName = "Power Eyes Opticals";
  let storeAddress = "";
  let storePhone = "";
  let storeEmail = "";
  if (r.branch_id) {
    const { data: branch } = await sb.from("branches").select("name, address, phone, email").eq("id", r.branch_id).maybeSingle();
    if (branch) {
      storeName = branch.name || storeName;
      storeAddress = branch.address || "";
      storePhone = branch.phone || "";
      storeEmail = branch.email || "";
    }
  }
  // Fallback to site settings if branch not found
  if (!storePhone) {
    const { data: settings } = await sb.from("public_site_settings").select("key, value");
    const siteMap: Record<string, string> = {};
    for (const s of settings ?? []) { siteMap[s.key] = typeof s.value === "string" ? s.value : ""; }
    if (siteMap.whatsapp_number) storePhone = siteMap.whatsapp_number;
    if (siteMap.store_email) storeEmail = siteMap.store_email;
    if (siteMap.store_address) storeAddress = siteMap.store_address;
  }
  const patientName = patient?.full_name || "Customer";
  const rxNo = r.rx_code ?? `RX-${String(r.id).slice(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      {/* Toolbar — screen only */}
      <div className="mx-auto max-w-3xl mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/my/prescriptions"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-navy-700 transition"
        >
          ← Back to prescriptions
        </Link>
        <PrintButton />
      </div>

      {/* The prescription sheet */}
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-lg print:max-w-none print:rounded-none print:shadow-none print:p-0">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-navy-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900">
              <span className="text-white text-xl">👁</span>
            </div>
            <div>
              <p className="font-bold text-navy-900 text-lg leading-tight">
                POWER EYES <span className="text-gold-500">OPTICALS</span>
              </p>
              <p className="text-[10px] text-slate-500 tracking-wider">
                Since 1998 — Your Family&apos;s Vision Partner
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-extrabold tracking-wide text-navy-900 text-sm">PRESCRIPTION</p>
            <p className="text-xs text-slate-500">#{rxNo}</p>
            <p className="text-xs text-slate-500">Issued: {dStr(r.rx_date)}</p>
          </div>
        </header>

        {/* Patient & meta */}
        <section className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Patient</p>
            <p className="font-semibold text-navy-900">{patientName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Contact</p>
            <p className="text-slate-700">{patient?.phone ? `+91 ${patient.phone}` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Vision ID</p>
            <p className="text-slate-700">{patient?.vision_id ?? patient?.customer_code ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Valid Till</p>
            <p className="text-slate-700">{r.valid_till ? dStr(r.valid_till) : "No expiry recorded"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Type</p>
            <p className="text-slate-700">{r.rx_type ?? "Spectacle"}{r.purpose ? ` · ${r.purpose}` : ""}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Examined By</p>
            <p className="text-slate-700">{r.examined_by ? `Dr. ${r.examined_by}` : "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Pupillary Distance</p>
            <p className="text-slate-700">
              Far {f(r.pd_far, 1)} mm{r.pd_near != null ? ` · Near ${f(r.pd_near, 1)} mm` : ""}
            </p>
          </div>
        </section>

        {/* Power table */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy-900 text-white text-[11px] uppercase tracking-wide">
              <th className="border border-slate-300 px-3 py-2 text-left">Eye</th>
              <th className="border border-slate-300 px-3 py-2">SPH</th>
              <th className="border border-slate-300 px-3 py-2">CYL</th>
              <th className="border border-slate-300 px-3 py-2">AXIS</th>
              <th className="border border-slate-300 px-3 py-2">ADD</th>
              <th className="border border-slate-300 px-3 py-2">VA (Distance)</th>
              <th className="border border-slate-300 px-3 py-2">VA (Near)</th>
            </tr>
          </thead>
          <tbody className="text-center text-navy-900">
            <tr>
              <td className="border border-slate-300 px-3 py-2.5 text-left font-semibold">Right Eye (OD)</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{f(r.od_sph)}</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{f(r.od_cyl)}</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{r.od_axis ?? "—"}</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{f(r.od_add)}</td>
              <td className="border border-slate-300 px-3 py-2.5">{r.od_va_dist ?? "—"}</td>
              <td className="border border-slate-300 px-3 py-2.5">{r.od_va_near ?? "—"}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-3 py-2.5 text-left font-semibold">Left Eye (OS)</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{f(r.os_sph)}</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{f(r.os_cyl)}</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{r.os_axis ?? "—"}</td>
              <td className="border border-slate-300 px-3 py-2.5 font-mono">{f(r.os_add)}</td>
              <td className="border border-slate-300 px-3 py-2.5">{r.os_va_dist ?? "—"}</td>
              <td className="border border-slate-300 px-3 py-2.5">{r.os_va_near ?? "—"}</td>
            </tr>
          </tbody>
        </table>

        {r.remarks && (
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-semibold text-navy-900">Remarks:</span> {r.remarks}
          </p>
        )}

        {/* Signature + store footer */}
        <footer className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-5 text-xs text-slate-500">
          <div>
            <p className="mb-10">Optometrist / Refractionist</p>
            <p className="w-52 border-t border-slate-400 pt-1 text-center font-medium text-slate-700">
              {r.examined_by ? `Dr. ${r.examined_by}` : "\u00A0"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-navy-900">{storeName}</p>
            {storeAddress && <p>{storeAddress}</p>}
            {storePhone && <p>📞 {storePhone}</p>}
            {storeEmail && <p>{storeEmail}</p>}
          </div>
        </footer>

        <p className="mt-4 text-center text-[10px] text-slate-400">
          Valid for the period stated above. Carry this printout or quote your Vision ID when visiting any Power Eyes store.
        </p>
      </article>
    </div>
  );
}
