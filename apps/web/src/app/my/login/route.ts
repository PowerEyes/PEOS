import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy login URL.
 *
 * The login page itself must live OUTSIDE this segment: my/layout.tsx gates
 * every /my/* route with `if (!user) redirect("/my/login")`, so a page placed
 * at /my/login would redirect to itself forever and browsers would fail with
 * ERR_TOO_MANY_REDIRECTS. The page now lives at /login (app/login/page.tsx);
 * this route keeps every existing link and `redirect("/my/login")` call site
 * working by forwarding to it.
 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}

export function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
