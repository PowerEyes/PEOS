import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Sign in before accepting the invitation" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("platform_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.status !== "pending" || new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Invitation is invalid or expired" }, { status: 400 });
  }
  if (String(invite.email).toLowerCase() !== String(session.user.email || "").toLowerCase()) {
    return NextResponse.json({ error: "This invitation was sent to a different email address" }, { status: 403 });
  }

  const role = invite.role || "support";
  const { error: userError } = await admin.from("platform_users").upsert(
    {
      id: randomUUID(),
      user_id: session.user.id,
      email: invite.email,
      role,
      platform_role: role,
      full_name: session.name,
      is_active: true,
    },
    { onConflict: "user_id" }
  );
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  await admin
    .from("platform_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ success: true });
}
