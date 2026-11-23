import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { company_name, gstin, branch_name, branch_address, seed_data } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Get current user from auth header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in first" } }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Invalid session", recovery: "Log in again" } }, { status: 401 });
    }

    // Get existing tenant for this user
    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("tenant_id, branch_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "No tenant found", recovery: "Contact support" } }, { status: 404 });
    }

    const tenantId = profile.tenant_id;

    // Update tenant
    await supabase
      .from("tenants")
      .update({ name: company_name, gstin: gstin || null, onboarding_complete: true })
      .eq("id", tenantId);

    // Update branch
    if (profile.branch_id) {
      await supabase
        .from("branches")
        .update({ name: branch_name, address: branch_address || null })
        .eq("id", profile.branch_id);
    }

    // Seed sample data if requested
    if (seed_data) {
      // Insert sample products
      const sampleProducts = [
        { tenant_id: tenantId, name: "Classic Round Frame", category: "eyeglasses", price: 1500, sku: "EG-001" },
        { tenant_id: tenantId, name: "Aviator Sunglasses", category: "sunglasses", price: 2500, sku: "SG-001" },
        { tenant_id: tenantId, name: "Blue Light Glasses", category: "computer-glasses", price: 1200, sku: "CG-001" },
      ];
      await supabase.from("products").insert(sampleProducts);

      // Insert sample customers
      const sampleCustomers = [
        { tenant_id: tenantId, name: "Raj Kumar", phone: "9876543210", email: "raj@example.com" },
        { tenant_id: tenantId, name: "Priya Sharma", phone: "9876543211", email: "priya@example.com" },
      ];
      await supabase.from("customers").insert(sampleCustomers);
    }

    return NextResponse.json({ success: true, message: "Onboarding complete" });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Onboarding failed", recovery: "Try again" } },
      { status: 500 }
    );
  }
}