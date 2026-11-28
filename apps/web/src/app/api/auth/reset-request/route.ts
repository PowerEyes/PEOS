import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  APP_PROOF_WINDOW_SECONDS,
  makeAppProof,
  RESET_APP,
  RESET_CALLBACK_PATH,
  siteHeaders,
  webResetBase,
} from "@/lib/password-reset";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    // handled by validation below
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const expiresAt = Date.now() + APP_PROOF_WINDOW_SECONDS * 1000;
  const redirect = new URL(RESET_CALLBACK_PATH, webResetBase(req));
  redirect.searchParams.set("app", RESET_APP);
  redirect.searchParams.set("proof", makeAppProof(RESET_APP, expiresAt));

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

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirect.toString(),
  });

  const res = NextResponse.json({ ok: true });
  cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  if (error) res.headers.set("Cache-Control", "no-store");
  return res;
}
