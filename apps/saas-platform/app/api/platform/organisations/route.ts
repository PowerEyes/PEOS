import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .insert({
      name,
      legal_name: body.legal_name || null,
      business_email: body.business_email || null,
      business_phone: body.business_phone || null,
      plan: body.plan || "starter",
      status: body.status || "trial",
      created_by: session.user.id,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id,name,plan,status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, organisation: data });
}
