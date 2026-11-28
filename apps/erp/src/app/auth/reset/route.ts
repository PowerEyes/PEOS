import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  makeRecoveryProof,
  RECOVERY_COOKIE,
  RECOVERY_WINDOW_SECONDS,
  RESET_APP,
  verifyAppProof,
} from "@/lib/password-reset";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fail = (reason: "invalid" | "expired" | "error") =>
    NextResponse.redirect(new URL(`/reset-password?error=${reason}`, req.url));

  const proofStatus = verifyAppProof(RESET_APP, params.get("proof"));
  if (proofStatus !== "valid") return fail(proofStatus);

  const description = params.get("error_description") || params.get("error") || "";
  if (description) return fail(/expired|invalid|used/i.test(description) ? "expired" : "error");

  // The secure dev server moves the single-use code into a header so Next's
  // request logger never prints it. Direct hosting still supplies it in the URL.
  const code = req.headers.get("x-poweros-reset-code") || params.get("code");
  if (!code) return fail("invalid");

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: CookieToSet[]) => {
          cookiesToSet.push(...list);
          list.forEach(({ name, value }) => req.cookies.set(name, value));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code, {
    flowId: params.get("sb_flow_id") || undefined,
  });
  const redirectType = (data as { redirectType?: string | null }).redirectType;
  if (error || redirectType !== "recovery") return fail("invalid");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return fail("expired");

  const res = NextResponse.redirect(new URL("/reset-password", req.url));
  cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  res.cookies.set(
    RECOVERY_COOKIE,
    makeRecoveryProof(Date.now() + RECOVERY_WINDOW_SECONDS * 1000),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: RECOVERY_WINDOW_SECONDS,
      path: "/",
    },
  );
  return res;
}
