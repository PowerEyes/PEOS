import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_COOKIE, siteHeaders, verifyRecoveryProof } from "@/lib/password-reset";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function POST(req: NextRequest) {
  if (!verifyRecoveryProof(req.cookies.get(RECOVERY_COOKIE)?.value)) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 401 });
  }

  let password = "";
  let confirm = "";
  try {
    const body = (await req.json()) as { password?: unknown; confirm?: unknown };
    password = typeof body.password === "string" ? body.password : "";
    confirm = typeof body.confirm === "string" ? body.confirm : "";
  } catch {
    // handled by validation below
  }

  if (password !== confirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (password.length < 8 || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Use at least 8 characters with both letters and numbers." },
      { status: 400 },
    );
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: siteHeaders(req) },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: CookieToSet[]) => {
          cookiesToSet.push(...list);
          list.forEach(({ name, value }) => req.cookies.set(name, value));
        },
      },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: error.message || "Unable to update password." }, { status: 400 });
  }

  await supabase.auth.signOut({ scope: "local" });
  const res = NextResponse.json({ ok: true });
  cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  res.cookies.set(RECOVERY_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
