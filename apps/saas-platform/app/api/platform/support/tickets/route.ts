import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || "").trim();
  const org_id = String(body.org_id || "").trim();
  if (!subject || !org_id) return NextResponse.json({ error: "Organisation and subject are required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_tickets")
    .insert({ org_id, subject, priority: body.priority || "normal", created_by: session.user.id })
    .select("id,subject,status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ticket: data });
}
