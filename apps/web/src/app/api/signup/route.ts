import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { company_name, email, password, branch_name } = body;

    if (!company_name || !email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "company_name, email, and password are required", recovery: "Fill in all required fields" } },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: authError?.message || "Failed to create user", recovery: "Try a different email or password" } },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 2. Create tenant
    const slug = company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: company_name,
        slug,
        plan: "trial",
        trial_ends_at: trialEnds,
        onboarding_complete: false,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: { code: "UNKNOWN", message: tenantError?.message || "Failed to create tenant", recovery: "Try again or contact support" } },
        { status: 500 }
      );
    }

    // 3. Create first branch
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .insert({
        tenant_id: tenant.id,
        name: branch_name || "Main Branch",
        is_default: true,
      })
      .select()
      .single();

    if (branchError || !branch) {
      return NextResponse.json(
        { error: { code: "UNKNOWN", message: branchError?.message || "Failed to create branch", recovery: "Try again or contact support" } },
        { status: 500 }
      );
    }

    // 4. Assign owner role
    await supabase.from("staff_profiles").insert({
      user_id: userId,
      tenant_id: tenant.id,
      branch_id: branch.id,
      role: "owner",
      status: "approved",
    });

    return NextResponse.json({
      tenant_id: tenant.id,
      branch_id: branch.id,
      user_id: userId,
      trial_ends_at: trialEnds,
      message: "Account created. Please log in to continue onboarding.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "An unexpected error occurred", recovery: "Try again or contact support" } },
      { status: 500 }
    );
  }
}