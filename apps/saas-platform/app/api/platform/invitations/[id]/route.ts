import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "revoked");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_invitations")
    .update({ status, accepted_at: status === "accepted" ? new Date().toISOString() : null })
    .eq("id", params.id)
    .select("id,email,role,status")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  return NextResponse.json({ success: true, invitation: data });
}
