import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeAllowed } from "@/lib/rbac";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(req: NextRequest) {
  // Customer document links: /d/<token> and /print/*?dt=<token> are validated server-side (HMAC + expiry + revocation).
  const pth = req.nextUrl.pathname;
  if (pth.startsWith("/d/") || (pth.startsWith("/print/") && req.nextUrl.searchParams.has("dt"))) return NextResponse.next();
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(),
      setAll: (list: CookieToSet[]) => { list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req }); list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } });
  const { data: { user } } = await sb.auth.getUser();
  const onLogin = pth.startsWith("/login");
  if (!user) return onLogin ? res : NextResponse.redirect(new URL("/login", req.url));
  // Deactivation / role changes take effect on the very next request (not at JWT expiry).
  const { data: p } = await sb.from("profiles").select("role_key, is_approved, deactivated").eq("id", user.id).maybeSingle();
  const active = !!p && p.is_approved && !p.deactivated;
  if (onLogin) return NextResponse.redirect(new URL("/", req.url));
  const open = pth === "/" || pth.startsWith("/onboarding"); // the layout shows the pending / onboarding screens
  if (!active) return open ? res : NextResponse.redirect(new URL("/", req.url));
  const { data: perms } = await sb.rpc("my_permissions");
  // Platform Super Admin is a separate authorization scope; the /platform layout
  // enforces platform_users. Do not apply tenant RBAC route rules there.
  if (pth === "/platform" || pth.startsWith("/platform/")) return res;
  if (!routeAllowed(p!.role_key, pth, (perms as string[]) ?? [])) return NextResponse.redirect(new URL("/?denied=1", req.url));
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
