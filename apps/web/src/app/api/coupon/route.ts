
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { getOrgId } from "@/lib/tenant";

export async function POST(req: Request) {
  if (await rateLimited(req, "coupon", 20, 600)) return tooMany();
  const { code, orderTotal, customerId } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code.trim() || code.length > 40) return NextResponse.json({ error:"Enter a coupon code." },{status:400});

  const sb = supabaseServer();
  const { data: coupon } = await sb.from("coupons")
    .select("*").eq("org_id", await getOrgId()).eq("code", code.trim().toUpperCase())
    .eq("is_active", true).maybeSingle();

  if (!coupon) return NextResponse.json({ error:`"${code}" is not a valid coupon code.` },{status:404});

  // Date check
  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now)
    return NextResponse.json({ error:"This coupon is not active yet." },{status:400});
  if (coupon.valid_until && new Date(coupon.valid_until) < now)
    return NextResponse.json({ error:"This coupon has expired." },{status:400});

  // Min order check
  if (orderTotal < Number(coupon.min_order))
    return NextResponse.json({ error:`Minimum order of ₹${Number(coupon.min_order).toLocaleString("en-IN")} required for this coupon.` },{status:400});

  // Max uses check
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses)
    return NextResponse.json({ error:"This coupon has reached its usage limit." },{status:400});

  // Per-customer check
  if (customerId && coupon.per_customer > 0) {
    const { count } = await sb.from("coupon_uses")
      .select("id",{count:"exact",head:true})
      .eq("coupon_id", coupon.id).eq("customer_id", customerId);
    if ((count ?? 0) >= coupon.per_customer)
      return NextResponse.json({ error:"You've already used this coupon." },{status:400});
  }

  // Calculate discount
  const discount = coupon.type === "percent"
    ? Math.round(orderTotal * coupon.value / 100 * 100) / 100
    : Math.min(coupon.value, orderTotal);

  return NextResponse.json({
    code: coupon.code, type: coupon.type, value: coupon.value,
    discount, description: coupon.description,
    message: coupon.type === "percent"
      ? `${coupon.value}% off applied — you save ₹${discount.toLocaleString("en-IN")}`
      : `₹${discount.toLocaleString("en-IN")} off applied!`
  });
}
