import { NextResponse } from "next/server";
import { getSiteSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const session = await getSiteSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.primaryOrganisationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "No organisation found for this account" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const required = ["businessName", "businessEmail", "businessPhone", "city", "state", "pincode"];
  const missing = required.filter((key) => !String(body[key] || "").trim());
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error: orgError } = await admin
    .from("organizations")
    .update({
      name: String(body.businessName).trim(),
      legal_name: body.legalName || null,
      business_email: String(body.businessEmail).trim(),
      business_phone: String(body.businessPhone).trim(),
      address_line1: body.addressLine1 || null,
      city: String(body.city).trim(),
      state: String(body.state).trim(),
      pincode: String(body.pincode).trim(),
      gstin: body.gstin || null,
      pan: body.pan || null,
      currency: body.currency || "INR",
      financial_year_start_month: Number(body.financialYearStartMonth || 4),
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

  const branchName = String(body.branchName || "").trim();
  const branchCode = String(body.branchCode || "").trim();
  if (branchName && branchCode) {
    const { error: branchError } = await admin.from("branches").upsert(
      {
        org_id: orgId,
        name: branchName,
        code: branchCode.toUpperCase(),
        phone: body.branchPhone || null,
        address:
          [body.branchAddress, body.city, body.state, body.pincode]
            .filter(Boolean)
            .join(", ") || null,
      },
      { onConflict: "org_id,code" }
    );
    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, organisationId: orgId });
}
