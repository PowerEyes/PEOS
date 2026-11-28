import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.body || "").trim();
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("support_ticket_messages").insert({
    ticket_id: params.id,
    author_id: session.user.id,
    author_name: session.name,
    body: message,
    is_internal: Boolean(body.is_internal),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status) {
    await admin.from("support_tickets").update({ status: String(body.status), updated_at: new Date().toISOString() }).eq("id", params.id);
  }

  return NextResponse.json({ success: true });
}
