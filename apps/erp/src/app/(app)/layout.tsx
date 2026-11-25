import { resolveScope } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { TemplatesProvider } from "@/components/templates-context";
import { getSettings } from "@/lib/settings";
import { getAnnouncements, getSubscriptionStatus } from "@/lib/announcements";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // An invited user whose email is now confirmed is granted access here (idempotent, DB-verified).
  await sb.rpc("claim_invitation");
  const { data: perms } = await sb.rpc("my_permissions");
  const [{ data: p }, { data: branches }, { data: tmpls }, settings] = await Promise.all([
    sb.from("profiles").select("full_name, role_key, is_approved, org_id, branch_id").eq("id", user.id).single(),
    sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.from("message_templates").select("*").order("sort_order"),
    getSettings(),
  ]);
  const { data: tenantData } = p?.org_id ? await sb.from("organizations").select("name").eq("id", p.org_id).single() : { data: null };
  const tenantName = tenantData?.name || "Power Eyes Opticals";
  if (!p?.is_approved) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div className="card max-w-md p-8 space-y-3">
          <h1 className="font-display text-2xl font-semibold">Waiting for approval</h1>
          <p className="text-sm text-slate-500">Your account was created. You need an invitation from an owner or admin to access PowerOS. If you were invited, confirm your email and refresh.</p>
          <a href="/onboarding" className="text-xs underline text-slate-500">Setting up a new organisation?</a>
          <p className="text-xs text-slate-400">After approval, refresh this page.</p>
          <form action="/login" method="get"><button className="btn btn-ghost text-sm">Back to login</button></form>
        </div>
      </main>
    );
  }
  // Announcements aimed at this company's subscription status (all | trialing |
  // past_due | expired), shown as a dismissible banner above the page content.
  const status = p.org_id ? await getSubscriptionStatus(sb, p.org_id) : "none";
  const announcements = p.org_id ? await getAnnouncements(sb, status) : [];
  const scope = resolveScope(p.role_key, p.branch_id ?? null, (branches ?? []).map((b: any) => b.id));
  const canSeeApprovals = ["owner", "admin"].includes(p.role_key) || (perms ?? []).includes("transfers_approve");
  let pendingApprovals = 0;
  if (canSeeApprovals) {
    let approvalQuery = sb.from("branch_transfers").select("id", { count: "exact", head: true }).eq("status", "requested");
    if (scope) approvalQuery = approvalQuery.or(`from_branch.eq.${scope},to_branch.eq.${scope}`);
    const { count } = await approvalQuery;
    pendingApprovals = count ?? 0;
  }
  return (
    <TemplatesProvider templates={tmpls ?? []} storeName={branches?.[0]?.name ?? "our store"}>
      <Shell user={{ name: p.full_name ?? user.email!, role: p.role_key, perms: perms ?? [] }} branches={branches ?? []} settings={settings} tenantName={tenantName} scope={scope} pendingApprovals={pendingApprovals} canSeeApprovals={canSeeApprovals}>
        <AnnouncementBanner items={announcements} />
        {children}
      </Shell>
    </TemplatesProvider>
  );
}
