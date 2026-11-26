import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export interface TenantProvisioningData {
  company_name: string;
  email: string;
  password: string;
  branch_name?: string;
  gstin?: string;
}

export async function provisionTenant(data: TenantProvisioningData) {
  // 1. Create auth user
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw new Error(authError?.message || "Failed to create user");

  const userId = authData.user.id;

  try {
    // 2. Create tenant
    const slug = data.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tenant, error: tenantError } = await sb.from("tenants").insert({
      name: data.company_name, slug, plan: "trial", trial_ends_at: trialEnds, onboarding_complete: false, gstin: data.gstin || null,
    }).select().single();
    if (tenantError || !tenant) throw new Error(tenantError?.message || "Failed to create tenant");

    // 3. Create first branch
    const { data: branch, error: branchError } = await sb.from("branches").insert({
      tenant_id: tenant.id, name: data.branch_name || "Main Branch", is_default: true, is_active: true,
    }).select().single();
    if (branchError || !branch) throw new Error(branchError?.message || "Failed to create branch");

    // 4. Assign owner role
    await sb.from("staff_profiles").insert({
      user_id: userId, tenant_id: tenant.id, branch_id: branch.id, role: "owner", status: "approved", full_name: data.company_name + " Owner",
    });

    return { tenant_id: tenant.id, branch_id: branch.id, user_id: userId, trial_ends_at: trialEnds };
  } catch (err) {
    // Rollback: delete auth user
    await sb.auth.admin.deleteUser(userId);
    throw err;
  }
}

export async function deactivateTenant(tenantId: string) {
  await sb.from("tenants").update({ is_active: false, deactivated_at: new Date().toISOString() }).eq("id", tenantId);
  await sb.from("staff_profiles").update({ is_active: false }).eq("tenant_id", tenantId);
}

export async function reactivateTenant(tenantId: string) {
  await sb.from("tenants").update({ is_active: true, deactivated_at: null }).eq("id", tenantId);
  await sb.from("staff_profiles").update({ is_active: true }).eq("tenant_id", tenantId);
}