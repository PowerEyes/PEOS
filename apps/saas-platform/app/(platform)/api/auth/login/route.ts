import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data.user || !data.session) {
      return NextResponse.json({ error: "Login failed" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: platformUser } = await admin
      .from("platform_users")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!platformUser) {
      return NextResponse.json(
        { error: "You are not authorised to access the platform" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: platformUser.full_name || data.user.email,
        role: platformUser.role || platformUser.platform_role,
      },
    });

    response.cookies.set(PLATFORM_SESSION_COOKIE, data.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
  }
}
