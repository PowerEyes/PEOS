
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
const ORG = "00000000-0000-0000-0000-000000000001";

// GET: check if referral code is valid, return discount amount
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ valid:false });
  const sb = supabaseServer();
  const { data } = await sb.from("referrals")
    .select("id,referee_discount,referrer_id,status")
    .eq("referral_code", code.toUpperCase()).eq("status","pending").maybeSingle();
  if (!data) return NextResponse.json({ valid:false, error:"Referral link not found or already used." });
  return NextResponse.json({ valid:true, discount:data.referee_discount, referralId:data.id });
}

// POST: generate referral link for logged-in customer
export async function POST() {
  const sb = supabaseServer();
  const { data:{ user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error:"Not logged in" },{status:401});
  const { data:c } = await sb.from("customers").select("id,referral_code,full_name").eq("auth_user_id",user.id).maybeSingle();
  if (!c) return NextResponse.json({ error:"Customer not found" },{status:404});
  // Create a referral record
  const { data:ref } = await sb.from("referrals").insert({
    org_id:ORG, referrer_id:c.id,
    referral_code: c.referral_code ?? `PE${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    referrer_points:200, referee_discount:100
  }).select().single();
  const link = `${process.env.NEXT_PUBLIC_WEB_URL ?? "https://powereyes.in"}/?ref=${ref?.referral_code}`;
  return NextResponse.json({ code:ref?.referral_code, link, points:200, discount:100 });
}
