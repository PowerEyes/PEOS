import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function POST(req: Request) {
  await supabaseServer().auth.signOut();
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
