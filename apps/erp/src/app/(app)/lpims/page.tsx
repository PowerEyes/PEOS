import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function LpimsPage() {
  const sb = supabaseServer();
  const { data: packages, error } = await sb.from("lens_packages")
    .select("id, code, name, design, base_price, mrp, available_indexes, included_coatings, status")
    .eq("status", "active").order("display_order").limit(200);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Lens Package Catalogue</h1>
          <p className="text-sm text-slate-500">Active lens designs, index options and included coatings</p>
        </div>
        <Link href="/sales" className="btn btn-primary">Open Sales & Lens Selection</Link>
      </div>
      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This screen currently displays the lens package catalogue. Per-power physical lens stock, exact/nearest power matching and automated LPIMS fulfilment are not yet verified as production features. Do not use this screen as an on-hand stock guarantee.
      </div>
      {error ? <div role="alert" className="card p-5 text-sm text-rose-600">Lens packages could not be loaded. {error.message}</div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(packages ?? []).map((item: any) => (
            <article key={item.id} className="card space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.code}</p><h2 className="mt-1 font-semibold text-navy-900">{item.name}</h2></div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-600">{String(item.design ?? "").replaceAll("_", " ")}</span>
              </div>
              <div className="flex items-baseline gap-2"><span className="text-xl font-bold">₹{Number(item.base_price ?? 0).toLocaleString("en-IN")}</span>{item.mrp != null && <span className="text-sm text-slate-500 line-through">₹{Number(item.mrp).toLocaleString("en-IN")}</span>}</div>
              <div><p className="text-xs text-slate-500">Available indexes</p><p className="mt-1 text-sm">{(item.available_indexes ?? []).join(", ") || "Not specified"}</p></div>
              <div><p className="text-xs text-slate-500">Included coatings</p><p className="mt-1 text-sm">{(item.included_coatings ?? []).join(", ") || "Not specified"}</p></div>
            </article>
          ))}
          {(!packages || packages.length === 0) && <div className="card p-6 text-sm text-slate-500">No active lens packages configured.</div>}
        </div>
      )}
    </div>
  );
}
