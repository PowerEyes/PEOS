import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import OrganisationActions from "./organisation-actions";

export const dynamic = "force-dynamic";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function OrganisationDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!org) notFound();

  const [branches, customers, products, sales, tickets] = await Promise.all([
    admin.from("branches").select("id").eq("org_id", org.id),
    admin.from("customers").select("id").eq("org_id", org.id),
    admin.from("products").select("id").eq("org_id", org.id),
    admin.from("sales").select("id").eq("org_id", org.id),
    admin.from("support_tickets").select("id").eq("org_id", org.id),
  ]);

  const stats = [
    { label: "Branches", value: branches.data?.length || 0 },
    { label: "Customers", value: customers.data?.length || 0 },
    { label: "Products", value: products.data?.length || 0 },
    { label: "Orders", value: sales.data?.length || 0 },
    { label: "Tickets", value: tickets.data?.length || 0 },
  ];

  const details: [string, any][] = [
    ["Plan", org.plan],
    ["Status", org.status],
    ["Subdomain", org.subdomain || "—"],
    ["Business email", org.business_email || "—"],
    ["Business phone", org.business_phone || "—"],
    ["GSTIN", org.gstin || "—"],
    ["PAN", org.pan || "—"],
    ["Created", fmt(org.created_at)],
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <Link href="/organisations" className="text-sm text-navy-600 hover:text-navy-900 underline">← Back to Organisations</Link>
          <h1 className="text-3xl font-bold text-navy-900 mt-2">{org.name}</h1>
          <p className="text-slate-600">{org.legal_name || "Organisation"} · Created {fmt(org.created_at)}</p>
        </div>
        <span className="px-3 py-1 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 capitalize">{org.status}</span>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-600">{s.label}</p>
            <p className="text-3xl font-bold text-navy-900 mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">Details</h3>
        <dl className="grid md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-600">{label}</dt>
              <dd className="font-medium text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">Manage</h3>
        <OrganisationActions id={org.id} plan={org.plan} status={org.status} />
      </div>
    </div>
  );
}
