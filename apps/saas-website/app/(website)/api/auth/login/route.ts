import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const anon = createClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data.user || !data.session) {
      return NextResponse.json({ error: "Login failed" }, { status: 400 });
    }

    if (!data.user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your email before logging in" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { data: members } = await admin
      .from("organization_members")
      .select("org_id, role, organizations(id,name,onboarding_completed_at,plan,status)")
      .eq("user_id", data.user.id);

    const memberships: any[] = (members as any) || [];
    const org: any = memberships[0]?.organizations || null;

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
      },
      requires_onboarding: memberships.length === 0 || !org?.onboarding_completed_at,
      organisations: memberships.map((m: any) => m.organizations),
    });

    response.cookies.set(SITE_SESSION_COOKIE, data.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Login failed" },
      { status: 500 }
    );
  }
}
