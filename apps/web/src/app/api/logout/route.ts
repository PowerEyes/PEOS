import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function POST() {
  await supabaseServer().auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"));
}
