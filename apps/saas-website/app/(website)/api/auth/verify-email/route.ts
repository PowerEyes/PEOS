import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tokenHash = String(body.token_hash || "").trim();
    const type = String(body.type || "signup");
    const token = String(body.token || "").trim();
    const email = String(body.email || "").trim();

    if (!tokenHash && (!token || !email)) {
      return NextResponse.json(
        { error: "Verification token and email are required" },
        { status: 400 }
      );
    }

    const anon = createClient();
    const verifyArgs = tokenHash
      ? { token_hash: tokenHash, type: type as any }
      : { email, token, type: "email" as const };

    const { data, error } = await anon.auth.verifyOtp(verifyArgs as any);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const matchedToken = tokenHash || token;
    if (matchedToken) {
      const admin = createAdminClient();
      await admin
        .from("email_verifications")
        .update({ used_at: new Date().toISOString() })
        .eq("token", matchedToken);
    }

    const response = NextResponse.json({
      success: true,
      message: "Email verified successfully!",
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
    });

    if (data.session?.access_token) {
      response.cookies.set(SITE_SESSION_COOKIE, data.session.access_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Verification failed" },
      { status: 500 }
    );
  }
}
