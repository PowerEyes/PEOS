import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const admin = createAdminClient();
  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "";

  let query = admin.from("organizations").select("id,name,plan,status,created_at,subdomain,business_email").order("created_at", { ascending: false });
  if (q) query = query.or(`name.ilike.%${q}%,business_email.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  const { data: orgs } = await query;
  const list = orgs || [];
  const ids = list.map((o) => o.id);

  const [branches, customers, products, sales] = await Promise.all([
    ids.length ? admin.from("branches").select("org_id").in("org_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("customers").select("org_id").in("org_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("products").select("org_id").in("org_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("sales").select("org_id").in("org_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const countBy = (rows: any[]) => {
    const m = new Map<string, number>();
    for (const r of rows || []) m.set(r.org_id, (m.get(r.org_id) || 0) + 1);
    return m;
  };
  const bc = countBy(branches.data as any[]);
  const cc = countBy(customers.data as any[]);
  const pc = countBy(products.data as any[]);
  const sc = countBy(sales.data as any[]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Organisations</h1>
          <p className="text-slate-600">Manage all organisations on the platform</p>
        </div>
        <Link href="/organisations/new" className="bg-navy-900 hover:bg-navy-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
          + Create Organisation
        </Link>
      </div>

      <form method="get" className="flex gap-4 mb-6">
        <input name="q" defaultValue={q} placeholder="Search organisations..." className="w-64 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none" />
        <select name="status" defaultValue={status} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none">
          <option value="">All Status</option>
          {["active", "trial", "past_due", "suspended", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="px-4 py-2 bg-navy-900 text-white rounded-lg">Filter</button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-50">
              {["Organisation", "Plan", "Status", "Branches", "Customers", "Products", "Orders", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left pb-3 text-navy-700 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((org) => (
              <tr key={org.id} className="border-b border-slate-200 hover:bg-navy-50">
                <td className="py-3 font-medium text-navy-900">{org.name}</td>
                <td className="py-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{org.plan}</span></td>
                <td className="py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">{org.status}</span></td>
                <td className="py-3">{bc.get(org.id) || 0}</td>
                <td className="py-3">{cc.get(org.id) || 0}</td>
                <td className="py-3">{pc.get(org.id) || 0}</td>
                <td className="py-3">{sc.get(org.id) || 0}</td>
                <td className="py-3">{fmt(org.created_at)}</td>
                <td className="py-3">
                  <Link href={`/organisations/${org.id}`} className="text-sm text-navy-900 hover:text-navy-700 font-medium underline">View Details</Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-slate-500">No organisations found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
