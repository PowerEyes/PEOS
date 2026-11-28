import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const role = String(body.role || "support");
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });

  const token = randomUUID().replace(/-/g, "");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_invitations")
    .insert({
      email,
      role,
      token,
      invited_by: session.user.id,
      invited_by_name: session.name,
    })
    .select("id,email,role,status,expires_at,token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendEmail({
      to: email,
      subject: "You are invited to PowerOS Platform",
      text: `Accept your invitation: ${process.env.NEXT_PUBLIC_PLATFORM_URL || "http://localhost:3002"}/admin/invitations/accept?token=${data.token}`,
      template: "platform_invitation",
      context: { role, invitedBy: session.name, token: data.token },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Invitation created but email failed: ${e.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, invitation: data });
}
