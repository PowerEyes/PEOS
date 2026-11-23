import Link from "next/link";
import { redirect } from "next/navigation";
import { inr } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
import { getEntitlements, type Entitlements } from "@/lib/entitlements";
import { CheckoutButton } from "./checkout-button";
import { SubscriptionActions } from "./change-plan";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-sky-100 text-sky-700",
  grace: "bg-amber-100 text-amber-700",
  past_due: "bg-amber-100 text-amber-700",
  payment_pending: "bg-amber-100 text-amber-700",
  payment_failed: "bg-rose-100 text-rose-700",
  expired: "bg-rose-100 text-rose-700",
  suspended: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
  none: "bg-slate-100 text-slate-600",
  inactive: "bg-slate-100 text-slate-600",
};

const INVOICE_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  issued: "bg-sky-100 text-sky-700",
  overdue: "bg-amber-100 text-amber-700",
  void: "bg-slate-100 text-slate-500",
  credited: "bg-slate-100 text-slate-500",
};

const date = (x?: string | null) =>
  x ? new Date(x).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (minor: number | null | undefined, currency = "INR") =>
  currency === "INR" ? inr((Number(minor) || 0) / 100) : `${((Number(minor) || 0) / 100).toFixed(2)} ${currency}`;

function UsageRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const near = max != null && max > 0 && used >= max;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${near ? "text-rose-600" : "text-navy-900"}`}>
          {used}{max != null ? ` / ${max}` : ""}
        </span>
      </div>
      {max != null && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${near ? "bg-rose-500" : "bg-navy-800"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function SubscriptionPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles")
    .select("role_key, org_id, full_name").eq("id", user.id).maybeSingle();
  const orgId = profile?.org_id as string | undefined;
  if (!orgId) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold text-navy-900">Subscription</h1>
        <p className="mt-2 text-sm text-slate-500">Your account is not linked to an organisation yet.</p>
      </div>
    );
  }

  const [entitlements, subRes, plansRes, invoicesRes, orgRes, branchCount, employeeCount, customerCount] = await Promise.all([
    getEntitlements(orgId),
    sb.from("org_subscriptions").select("*").eq("org_id", orgId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("billing_plans").select("*").eq("active", true).order("display_order"),
    sb.from("subscription_invoices")
      .select("id, invoice_no, amount_minor, tax_minor, currency, status, issued_at, paid_at, plan:billing_plans(name)")
      .order("issued_at", { ascending: false }).limit(8),
    sb.from("organizations").select("name, legal_name, billing_address").eq("id", orgId).maybeSingle(),
    sb.from("branches").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    sb.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const e: Entitlements | null = entitlements;
  const sub = subRes.data;
  const status = e?.status ?? "none";
  const plans = (plansRes.data ?? []).filter((p: any) => p.is_public || p.id === sub?.plan_id);
  const currentPlanId = sub?.plan_id as string | undefined;
  const currentPlan = plans.find((p: any) => p.id === currentPlanId);
  const freePlans = (plansRes.data ?? []).filter((p: any) => p.active && p.price_minor != null && Number(p.price_minor) === 0);
  const invoices = invoicesRes.data ?? [];
  const restricted = ["expired", "suspended", "cancelled", "none", "inactive"].includes(status);
  const limits = e?.limits ?? {};
  const features = Object.entries(e?.features ?? {}).filter(([k, v]) => !k.startsWith("_") && v);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Subscription</h1>
          <p className="text-sm text-slate-500">Plan, usage and billing for {orgRes.data?.name}</p>
        </div>
        <Link href="/subscription/invoices" className="btn btn-ghost">Billing history</Link>
      </div>

      {restricted && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Your subscription is <b>{status}</b>. You can still read, export and download invoices — renew below to
          start writing data again.
        </div>
      )}

      {/* Current plan */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-navy-900">{currentPlan?.name ?? e?.plan_name ?? "No plan yet"}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}>
                {status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {currentPlan
                ? `${money(currentPlan.price_minor, currentPlan.currency)} / ${currentPlan.interval}`
                : "Choose a plan below to activate your workspace."}
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            {sub?.trial_ends_at && status === "trialing" && (
              <p>Trial ends <span className="font-medium text-navy-900">{date(sub.trial_ends_at)}</span></p>
            )}
            {sub?.current_period_end && (
              <p>Renews <span className="font-medium text-navy-900">{date(sub.current_period_end)}</span></p>
            )}
            {sub?.grace_ends_at && status === "grace" && (
              <p>Access until <span className="font-medium text-amber-700">{date(sub.grace_ends_at)}</span></p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <SubscriptionActions orgId={orgId} plans={freePlans} status={status} />
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p: any) => {
            const isCurrent = p.id === currentPlanId;
            const priced = p.price_minor != null;
            const payable = p.is_public && priced && Number(p.price_minor) > 0;
            const isFree = priced && Number(p.price_minor) === 0;
            return (
              <div key={p.id} className={`card flex flex-col p-5 ${isCurrent ? "ring-2 ring-navy-800" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-navy-900">{p.name}</h3>
                  {isCurrent && <span className="text-xs font-medium text-navy-800">Current</span>}
                </div>
                <p className="mt-2 text-2xl font-bold text-navy-900">
                  {!priced ? "Talk to us" : payable ? money(p.price_minor, p.currency) : "Free"}
                  {priced && <span className="text-sm font-normal text-slate-500"> / {p.interval}</span>}
                </p>
                <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">
                  <li>{p.max_branches ?? "—"} branch{p.max_branches === 1 ? "" : "es"}</li>
                  <li>{p.max_employees ?? "—"} employees</li>
                  <li>{p.max_customers ?? "—"} customers</li>
                  {Number(p.trial_days) > 0 && <li>{p.trial_days}-day trial</li>}
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    <span className="inline-flex w-full justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
                      In use
                    </span>
                  ) : payable ? (
                    <CheckoutButton planId={p.id} planName={p.name} priceLabel={money(p.price_minor, p.currency)} />
                  ) : !priced ? (
                    <span className="inline-flex w-full justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-400">
                      Contact sales
                    </span>
                  ) : (
                    <span className="inline-flex w-full justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-400">
                      Free — choose above
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {plans.length === 0 && (
            <p className="text-sm text-slate-500">No plans are available yet — please contact billing.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usage */}
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Usage against plan limits</h2>
          <div className="space-y-4">
            <UsageRow label="Branches" used={branchCount.count ?? 0} max={limits.branches ?? null} />
            <UsageRow label="Employees" used={employeeCount.count ?? 0} max={limits.employees ?? null} />
            <UsageRow label="Customers" used={customerCount.count ?? 0} max={limits.customers ?? null} />
          </div>
          {features.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Included features</p>
              <ul className="flex flex-wrap gap-2">
                {features.map(([k, v]) => (
                  <li key={k} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {String(k).replace(/_/g, " ")}{typeof v === "string" && v !== "true" ? `: ${v}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent invoices</h2>
            <Link href="/subscription/invoices" className="text-sm text-navy-800 hover:underline">View all</Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <Link href={`/print/subscription-invoice/${inv.id}`} className="font-medium text-navy-800 hover:underline">
                        {inv.invoice_no || "—"}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-500">{date(inv.issued_at)}</td>
                    <td className="py-2 text-right font-medium text-navy-900">{money(inv.amount_minor, inv.currency)}</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STYLE[inv.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {orgRes.data?.billing_address && (
        <p className="text-xs text-slate-400">Billing address: {orgRes.data.billing_address}</p>
      )}
    </div>
  );
}
