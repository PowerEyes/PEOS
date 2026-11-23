import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createInvitation } from "@/lib/invitation";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function getAuthContext(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const sb = getSupabase();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, role, branch_id").eq("user_id", user.id).single();
  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) return null;
  return { user, profile, sb };
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const body = await request.json();
  const { email, full_name, role, branch_id, additional_branches } = body;
  if (!email || !full_name || !role || !branch_id) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "email, full_name, role, branch_id required", recovery: "Fill in all required fields" } }, { status: 400 });
  }

  try {
    const invitation = await createInvitation({
      tenant_id: ctx.profile.tenant_id, branch_id, email, full_name, role,
      invited_by: ctx.user.id, additional_branches: additional_branches || [],
    });

    // Send invitation email (placeholder — integrate with email service)
    // await sendInvitationEmail(email, full_name, invitation.id);

    return NextResponse.json({ data: invitation, message: "Invitation sent successfully" }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: { code: "UNKNOWN", message: err.message, recovery: "Try again" } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const { data, error } = await ctx.sb.from("staff_invitations").select("*").eq("tenant_id", ctx.profile.tenant_id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}