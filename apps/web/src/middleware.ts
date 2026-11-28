import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // The studio opens `?preview=1&k=<SITE_PREVIEW_KEY>`. Validate it here, once,
  // and forward a trusted internal header so layouts/pages (which cannot read
  // searchParams) can render hidden CMS rows too.
  const requestHeaders = new Headers(request.headers);
  const previewKey = process.env.SITE_PREVIEW_KEY;
  if (
    previewKey &&
    request.nextUrl.searchParams.get("preview") === "1" &&
    request.nextUrl.searchParams.get("k") === previewKey
  ) {
    requestHeaders.set("x-site-preview", "1");
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: any) { response.cookies.set({ name, value, ...options }); },
        remove(name: string, options: any) { response.cookies.set({ name, value: "", ...options }); },
      },
    }
  );

  // A deleted user or an expired/rotated refresh token must resolve to
  // anonymous, not throw into every request. signOut({ scope: "local" }) clears
  // the stale auth cookies through the handlers above without a network call.
  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    // Network failure during auth is treated as anonymous.
  }
  if (!user) {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    // Belt-and-braces: signOut can fail if the refresh token is already gone.
    for (const c of request.cookies.getAll()) {
      if (/^sb-.*-auth-token$/.test(c.name)) {
        response.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" });
      }
    }
  }

  // Protected routes. A client-controlled cookie must never bypass auth.
  // Demo tenants are created by /api/demo and still require a real session.
  const protectedPaths = ["/my", "/checkout", "/cart"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|api/).*)"],
};