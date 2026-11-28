import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.name) patch.name = String(body.name).trim();
  if (body.plan) patch.plan = String(body.plan);
  if (body.status) patch.status = String(body.status);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .update(patch)
    .eq("id", params.id)
    .select("id,name,plan,status")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  return NextResponse.json({ success: true, organisation: data });
}
