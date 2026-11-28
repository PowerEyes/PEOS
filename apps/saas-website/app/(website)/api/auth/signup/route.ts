import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

function cleanupSessionCookie(response: NextResponse) {
  response.cookies.set("poweros_site_session", "", { path: "/", maxAge: 0 });
  return response;
}

export async function POST(req: Request) {
  const anon = createClient();
  const admin = createAdminClient();
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const { email, password, business_name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_WEBSITE_URL ||
      "http://localhost:3003";

    const { data: authData, error: authError } = await anon.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: business_name || email.split("@")[0] },
        emailRedirectTo: `${origin.replace(/\/$/, "")}/auth/verify-email`,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
    userId = authData.user.id;

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: business_name || email.split("@")[0],
        business_email: email,
        status: "trial",
        plan: "starter",
        created_by: userId,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (orgError || !org) {
      throw new Error(orgError?.message || "Could not create organisation");
    }
    orgId = org.id;

    const { error: memberError } = await admin
      .from("organization_members")
      .insert({ org_id: org.id, user_id: userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);

    // Generate a real Supabase verification link and deliver it through the
    // PowerOS email service. The link contains token_hash + type, which the
    // verify-email page exchanges for a session.
    let verificationToken: string | null = null;
    let verificationLink: string | null = null;
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          redirectTo: `${origin.replace(/\/$/, "")}/auth/verify-email`,
        },
      });
      verificationLink =
        (linkData as any)?.properties?.action_link ||
        (linkData as any)?.action_link ||
        null;
      verificationToken =
        (linkData as any)?.properties?.hashed_token ||
        (linkData as any)?.hashed_token ||
        null;
    } catch {
      // Supabase's built-in confirmation email remains a fallback.
    }

    if (verificationToken) {
      await admin.from("email_verifications").insert({
        user_id: userId,
        email,
        token: verificationToken,
      });
    }

    if (verificationLink) {
      await sendEmail({
        to: email,
        subject: "Verify your PowerOS account",
        text: `Welcome to PowerOS. Verify your email: ${verificationLink}`,
        html: `<p>Welcome to PowerOS.</p><p><a href="${verificationLink}">Verify your email</a></p>`,
        template: "signup_verification",
        context: { email, verificationLink, businessName: business_name },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Account created. Please check your email to verify.",
      user: { id: userId, email },
      organisationId: orgId,
    });
  } catch (err: any) {
    // Never leave an orphaned auth user / organisation behind on failure.
    if (orgId) {
      await admin.from("organization_members").delete().eq("org_id", orgId);
      await admin.from("organizations").delete().eq("id", orgId);
    }
    if (userId) {
      await admin.from("customers").delete().eq("auth_user_id", userId);
      await admin.from("email_verifications").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return cleanupSessionCookie(
      NextResponse.json(
        { error: err.message || "Signup failed" },
        { status: 500 }
      )
    );
  }
}
