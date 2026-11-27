import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { getOrgId, serviceDb } from "@/lib/tenant";
import { applyDiscountCap, getMaxDiscountPct } from "@/lib/discounts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (await rateLimited(req, "coupon", 20, 600)) return tooMany();
  const body = await req.json().catch(() => ({})) as Record<string, any>;
  const { code, orderTotal, customerId } = body;
  if (typeof code !== "string" || !code.trim() || code.length > 40) {
    return NextResponse.json({ error: "Enter a coupon code." }, { status: 400 });
  }
  const total = Number(orderTotal);
  if (!Number.isFinite(total) || total < 0) {
    return NextResponse.json({ error: "Add items to your cart before applying a coupon." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Coupons are not available right now." }, { status: 503 });
  }

  let orgId: string;
  try { orgId = await getOrgId(); } catch {
    return NextResponse.json({ error: "This store isn't configured for coupons yet." }, { status: 503 });
  }
  const db = serviceDb();
  const normalizedCode = code.trim().toUpperCase();
  const { data: coupon } = await db.from("coupons")
    .select("*")
    .eq("org_id", orgId)
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!coupon) return NextResponse.json({ error: `"${code}" is not a valid coupon code.` }, { status: 404 });

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return NextResponse.json({ error: "This coupon is not active yet." }, { status: 400 });
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return NextResponse.json({ error: "This coupon has expired." }, { status: 400 });
  }
  if (total < Number(coupon.min_order ?? 0)) {
    return NextResponse.json({
      error: `Minimum order of ₹${Number(coupon.min_order ?? 0).toLocaleString("en-IN")} required for this coupon.`,
    }, { status: 400 });
  }
  if (coupon.max_uses != null && Number(coupon.uses ?? 0) >= Number(coupon.max_uses)) {
    return NextResponse.json({ error: "This coupon has reached its usage limit." }, { status: 400 });
  }

  // Accept a signed-in customer, otherwise resolve one from the session. The
  // cart used to send no customer at all, so per-customer limits never worked.
  let knownCustomer = typeof customerId === "string" && UUID.test(customerId) ? customerId : null;
  if (!knownCustomer) {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (user) {
      const { data: customer } = await db.from("customers")
        .select("id").eq("org_id", orgId).eq("auth_user_id", user.id).maybeSingle();
      knownCustomer = customer?.id ?? null;
    }
  }
  if (knownCustomer && Number(coupon.per_customer ?? 0) > 0) {
    const { count } = await db.from("coupon_uses")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("customer_id", knownCustomer);
    if ((count ?? 0) >= Number(coupon.per_customer)) {
      return NextResponse.json({ error: "You've already used this coupon." }, { status: 400 });
    }
  }

  const capPct = await getMaxDiscountPct(db, orgId);
  const requested = coupon.type === "percent"
    ? (total * Number(coupon.value)) / 100
    : Math.min(Number(coupon.value), total);
  const { discount, capped, capAmount } = applyDiscountCap(total, requested, capPct);
  const capNote = capped ? ` Capped at ${capPct}% (₹${capAmount.toLocaleString("en-IN")}) for this store.` : "";

  return NextResponse.json({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
    capped,
    max_discount_pct: capPct,
    description: coupon.description,
    message: coupon.type === "percent"
      ? `${coupon.value}% off applied — you save ₹${discount.toLocaleString("en-IN")}${capNote}`
      : `₹${discount.toLocaleString("en-IN")} off applied!${capNote}`,
  });
}
