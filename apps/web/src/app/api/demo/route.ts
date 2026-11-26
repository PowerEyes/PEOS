import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Create demo tenant
    const demoSlug = `demo-${Date.now()}`;
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: "Demo Optical Store",
        slug: demoSlug,
        plan: "demo",
        is_demo: true,
        demo_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        onboarding_complete: true,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: { code: "UNKNOWN", message: "Failed to create demo", recovery: "Try again" } },
        { status: 500 }
      );
    }

    // Create demo branch
    const { data: branch } = await supabase
      .from("branches")
      .insert({ tenant_id: tenant.id, name: "Demo Branch", is_default: true })
      .select()
      .single();

    // Create demo user
    const demoEmail = `demo-${Date.now()}@powerosc-demo.com`;
    const { data: authData } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: "demo1234",
      email_confirm: true,
    });

    if (authData?.user && branch) {
      await supabase.from("staff_profiles").insert({
        user_id: authData.user.id,
        tenant_id: tenant.id,
        branch_id: branch.id,
        role: "owner",
        status: "approved",
      });
    }

    return NextResponse.json({
      email: demoEmail,
      password: "demo1234",
      tenant_id: tenant.id,
      expires_at: tenant.demo_expires_at,
      message: "Demo account created. Login with the provided credentials.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Demo creation failed", recovery: "Try again" } },
      { status: 500 }
    );
  }
}