"use server";
// Platform server actions — every one gated by the platform authorization scope.
// Service-role client is only obtained AFTER requirePlatform() succeeds.
import { revalidatePath } from "next/cache";
import { requirePlatform, type PlatformUser, type PlatformRole } from "@/lib/platform-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type R = { error?: string; ok?: string };

async function platformCtx(roles: PlatformRole[] = ["super_admin", "support", "billing"]): Promise<R & { pu?: PlatformUser; admin?: any }> {
  const pu = await requirePlatform();
  if (!roles.includes(pu.platform_role)) return { error: "Your platform role cannot perform this action." };
  return { pu, admin: supabaseAdmin() };
}

async function audit(admin: any, pu: PlatformUser, action: string, targetType?: string, targetId?: string, metadata: any = {}) {
  await admin.from("platform_audit_logs").insert({ actor_id: pu.user_id, action, target_type: targetType, target_id: targetId ?? null, metadata });
}

export async function setPlanActive(id: string, active: boolean): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  const { error } = await a.admin.from("billing_plans").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, "plan.set_active", "billing_plan", id, { active });
  revalidatePath("/platform/plans");
  return { ok: active ? "Plan activated." : "Plan deactivated." };
}

export async function savePlan(data: {
  id?: string; code: string; name: string; price_minor: number | null; interval: "month" | "year";
  trial_days: number; grace_days: number; max_branches: number | null; max_employees: number | null;
  max_customers: number | null; storage_mb: number | null; features: Record<string, unknown>;
}): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  if (!/^[a-z0-9_-]{2,32}$/.test(data.code)) return { error: "Plan code must be 2–32 lowercase letters, numbers, dashes or underscores." };
  if (!data.name.trim()) return { error: "Plan name is required." };
  if (data.price_minor != null && data.price_minor < 0) return { error: "Price cannot be negative." };
  const row = {
    code: data.code, name: data.name.trim(), price_minor: data.price_minor, interval: data.interval,
    trial_days: Math.max(0, data.trial_days | 0), grace_days: Math.max(0, data.grace_days | 0),
    max_branches: data.max_branches, max_employees: data.max_employees,
    max_customers: data.max_customers, storage_mb: data.storage_mb,
    features: data.features ?? {},
  };
  let err;
  if (data.id) ({ error: err } = await a.admin.from("billing_plans").update(row).eq("id", data.id));
  else ({ error: err } = await a.admin.from("billing_plans").insert(row));
  if (err) return { error: err.message };
  await audit(a.admin, a.pu!, data.id ? "plan.update" : "plan.create", "billing_plan", data.id, { code: data.code });
  revalidatePath("/platform/plans");
  return { ok: data.id ? "Plan updated." : "Plan created." };
}

export async function suspendCompany(orgId: string, suspended: boolean): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  const status = suspended ? "suspended" : "active";
  const { error } = await a.admin.from("org_subscriptions").update({ status }).eq("org_id", orgId);
  if (error) return { error: error.message };
  await a.admin.from("subscription_events").insert({ org_id: orgId, event_type: suspended ? "company.suspended" : "company.reactivated", actor_id: a.pu!.user_id });
  await audit(a.admin, a.pu!, suspended ? "company.suspend" : "company.reactivate", "organization", orgId, { status });
  revalidatePath("/platform/companies");
  return { ok: suspended ? "Company suspended." : "Company reactivated." };
}

export async function changeSubscriptionPlan(orgId: string, planId: string): Promise<R> {
  const a = await platformCtx(["super_admin", "billing"]);
  if (a.error || !a.admin) return { error: a.error };
  const { data: plan } = await a.admin.from("billing_plans").select("id").eq("id", planId).maybeSingle();
  if (!plan) return { error: "Plan not found." };
  const { data: existing } = await a.admin.from("org_subscriptions").select("id").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let err;
  if (existing) ({ error: err } = await a.admin.from("org_subscriptions").update({ plan_id: planId, status: "active", current_period_start: new Date().toISOString() }).eq("id", existing.id));
  else ({ error: err } = await a.admin.from("org_subscriptions").insert({ org_id: orgId, plan_id: planId, status: "active", current_period_start: new Date().toISOString() }));
  if (err) return { error: err.message };
  await a.admin.from("subscription_events").insert({ org_id: orgId, event_type: "subscription.plan_changed", actor_id: a.pu!.user_id, payload: { plan_id: planId } });
  await audit(a.admin, a.pu!, "subscription.change_plan", "organization", orgId, { plan_id: planId });
  revalidatePath("/platform/companies");
  return { ok: "Subscription plan changed." };
}

export async function registerCompanyManual(data: { name: string; ownerEmail: string; planCode: string }): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  if (!data.name.trim()) return { error: "Company name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.ownerEmail)) return { error: "Enter a valid owner email." };
  // Resolve the plan BEFORE creating the company: an org without a subscription
  // row sits in status 'none' (writes blocked) until the grandfather backfill
  // would adopt it — a new registration must never fall into that hole.
  const { data: plan } = await a.admin.from("billing_plans").select("id, trial_days").eq("code", data.planCode).maybeSingle();
  if (!plan) return { error: "Plan not found — pick an existing plan code." };
  const { data: org, error } = await a.admin.from("organizations").insert({ name: data.name.trim() }).select("id").single();
  if (error) return { error: error.message };
  const now = new Date();
  const { error: subErr } = await a.admin.from("org_subscriptions").insert({
    org_id: org.id, plan_id: plan.id, status: "trialing",
    trial_ends_at: new Date(now.getTime() + (plan.trial_days ?? 14) * 86400000).toISOString(),
    current_period_start: now.toISOString(),
  });
  if (subErr) return { error: subErr.message };
  await audit(a.admin, a.pu!, "company.register", "organization", org.id, { name: data.name, owner_email: data.ownerEmail, plan: data.planCode });
  revalidatePath("/platform/companies");
  return { ok: "Company registered. The owner will receive an invitation to set up their account." };
}

export async function addPlatformUser(data: { email: string; platform_role: PlatformRole }): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return { error: "Enter a valid email." };
  const { error } = await a.admin.from("platform_users").insert({ email: data.email.trim().toLowerCase(), platform_role: data.platform_role });
  if (error) return { error: error.message.includes("duplicate") ? "That email already has platform access." : error.message };
  await audit(a.admin, a.pu!, "platform_user.add", "platform_user", undefined, { email: data.email, role: data.platform_role });
  revalidatePath("/platform/admin");
  return { ok: "Platform user added." };
}

export async function setPlatformUserRole(id: string, role: PlatformRole): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  const { error } = await a.admin.from("platform_users").update({ platform_role: role }).eq("id", id);
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, "platform_user.role", "platform_user", id, { role });
  revalidatePath("/platform/admin");
  return { ok: "Role updated." };
}

export async function setPlatformUserActive(id: string, active: boolean): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  const { error } = await a.admin.from("platform_users").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, active ? "platform_user.enable" : "platform_user.disable", "platform_user", id, { active });
  revalidatePath("/platform/admin");
  return { ok: active ? "Enabled." : "Disabled." };
}

export async function setEntitlementEnforcement(mode: "log" | "enforce"): Promise<R> {
  const a = await platformCtx(["super_admin"]);
  if (a.error || !a.admin) return { error: a.error };
  if (mode !== "log" && mode !== "enforce") return { error: "Unknown enforcement mode." };
  const { error } = await a.admin.from("platform_settings").upsert(
    { key: "entitlement_enforcement", value: mode, updated_at: new Date().toISOString(), updated_by: a.pu!.user_id },
    { onConflict: "key" },
  );
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, "entitlement.set_enforcement", "platform_setting", "entitlement_enforcement", { mode });
  revalidatePath("/platform/security");
  return {
    ok: mode === "enforce"
      ? "Enforcement is ON: blocked writes are now refused."
      : "Enforcement is log-only: blocked writes are recorded and allowed.",
  };
}

export async function publishAnnouncement(data: { title: string; body: string; target: "all" | "trialing" | "past_due" | "expired" }): Promise<R> {
  const a = await platformCtx(["super_admin", "support"]);
  if (a.error || !a.admin) return { error: a.error };
  if (!data.title.trim() || !data.body.trim()) return { error: "Title and body are required." };
  const { error } = await a.admin.from("announcements").insert({ title: data.title.trim(), body: data.body.trim(), target: data.target, created_by: a.pu!.user_id });
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, "announcement.publish", "announcement");
  revalidatePath("/platform/support");
  return { ok: "Announcement published." };
}

// ── Break-glass: explicit, audited access to a company's private records ─────
// plan §10: platform admins have no standing access to company data; a grant
// is per-user, per-company, reason-logged and expires after 30 minutes (the
// expiry default lives in the database, so a buggy caller cannot mint a
// longer-lived one). /platform/companies/[id]/records refuses to render the
// data without an active grant, and logs the view.

export async function grantBreakGlass(orgId: string, reason: string): Promise<R> {
  const a = await platformCtx(["super_admin", "support"]);
  if (a.error || !a.admin) return { error: a.error };
  const why = reason.trim();
  if (why.length < 10) return { error: "Give a reason of at least 10 characters — it is recorded in the platform audit log." };
  const { error } = await a.admin.from("break_glass_grants").insert({
    org_id: orgId, platform_user_id: a.pu!.user_id, reason: why,
  });
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, "break_glass.granted", "organization", orgId, { reason: why });
  revalidatePath(`/platform/companies/${orgId}/records`);
  return { ok: "Break-glass access granted for 30 minutes. The grant and every view are recorded in the platform audit log." };
}

export async function revokeBreakGlass(grantId: string, orgId: string): Promise<R> {
  const a = await platformCtx(["super_admin", "support"]);
  if (a.error || !a.admin) return { error: a.error };
  const { error } = await a.admin.from("break_glass_grants")
    .update({ revoked_at: new Date().toISOString() }).eq("id", grantId).is("revoked_at", null);
  if (error) return { error: error.message };
  await audit(a.admin, a.pu!, "break_glass.revoked", "organization", orgId, { grant_id: grantId });
  revalidatePath(`/platform/companies/${orgId}/records`);
  return { ok: "Access revoked." };
}
