import Link from "next/link";
import { redirect } from "next/navigation";
import { getSiteSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { subscribed?: string; onboarding?: string };
}) {
  const session = await getSiteSession();
  if (!session) redirect("/auth/login?next=/dashboard");

  const orgId = session.primaryOrganisationId;
  const admin = createAdminClient();

  const { data: org } = orgId
    ? await admin.from("organizations").select("*").eq("id", orgId).maybeSingle()
    : { data: null };

  const [{ data: subscription }, branches, customers, sales] = await Promise.all([
    orgId
      ? admin
          .from("organization_subscriptions")
          .select("id,plan_id,status,current_period_end")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    orgId ? admin.from("branches").select("id").eq("org_id", orgId) : Promise.resolve({ data: [] }),
    orgId ? admin.from("customers").select("id").eq("org_id", orgId) : Promise.resolve({ data: [] }),
    orgId ? admin.from("sales").select("id").eq("org_id", orgId) : Promise.resolve({ data: [] }),
  ]);

  const stats = [
    { label: "Branches", value: branches.data?.length || 0 },
    { label: "Customers", value: customers.data?.length || 0 },
    { label: "Orders", value: sales.data?.length || 0 },
  ];

  return (
    <div className="min-h-screen bg-navy-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-navy-900">Welcome back</h1>
            <p className="text-slate-600">
              {org?.name || session.user.email} · {session.user.email}
            </p>
          </div>
          <LogoutButton />
        </div>

        {searchParams.subscribed === "1" && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm">
            Payment received. Your subscription is now active.
          </div>
        )}
        {session.requiresOnboarding && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex justify-between items-center gap-4">
            <span className="text-sm">Finish setting up your business to unlock the ERP.</span>
            <Link href="/onboarding" className="underline font-medium text-sm">
              Complete onboarding
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-600">{s.label}</p>
              <p className="text-3xl font-bold text-navy-900 mt-2">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-navy-900 mb-4">Your account</h2>
          <dl className="grid md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
            {[
              ["Organisation", org?.name || "—"],
              ["Plan", subscription?.plan_id || org?.plan || "starter"],
              ["Subscription status", subscription?.status || "none"],
              ["Trial ends", org?.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString("en-IN") : "—"],
              ["GSTIN", org?.gstin || "—"],
              ["City", org?.city || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-medium text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex gap-3">
            <Link href="/subscribe" className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm">
              Manage subscription
            </Link>
            <a
              href="http://localhost:3001"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700"
            >
              Open ERP
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
