import { getOrgId } from "@/lib/tenant";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { dbError } from "@poweros/business-rules";
export async function POST(req: Request) {
  if (await rateLimited(req, "order-confirm", 30, 600)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, cartItems, delivery, branch, addr, total, payMethod } = body;
  // Verify Razorpay payment: fail closed. A payment id without a valid signature is never accepted.
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  let paidAmount = 0;
  if (razorpay_payment_id) {
    if (!keySecret || !keyId || !razorpay_order_id || !razorpay_signature) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    const hmac = crypto.createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const a = Buffer.from(hmac), b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    // Confirm the amount with Razorpay itself instead of trusting the browser-supplied total.
    const pr = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` } });
    const pd = await pr.json().catch(() => null);
    if (!pr.ok || !pd || pd.order_id !== razorpay_order_id || !["captured", "authorized"].includes(pd.status)) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    paidAmount = Number(pd.amount) / 100;
  } else if (payMethod !== "cash") {
    return NextResponse.json({ error: "Select a valid payment method" }, { status: 400 });
  }
  if (!Array.isArray(cartItems) || cartItems.length === 0 || cartItems.length > 50) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Server is not configured" }, { status: 503 });
  const orgId = await getOrgId();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Idempotency: a retried confirm must not create a second order for the same payment.
  if (razorpay_payment_id) {
    const { data: prev } = await sb.from("online_payments").select("sale_id, sales(code)").eq("razorpay_payment_id", razorpay_payment_id).not("sale_id", "is", null).maybeSingle();
    if (prev?.sale_id) return NextResponse.json({ code: (prev as any).sales?.code, id: prev.sale_id });
  }
  // Find or create customer
  const customerPhone = addr?.phone ?? "";
  let customerId: string | null = null;
  if (addr?.email) {
    const { data: cust } = await sb.from("customers").select("id").eq("email", addr.email).limit(1).maybeSingle();
    if (cust) customerId = cust.id;
  }
  if (!customerId && customerPhone) {
    const { data: cust } = await sb.from("customers").select("id").eq("phone", String(customerPhone).replace(/\D/g,"")).limit(1).maybeSingle();
    if (cust) customerId = cust.id;
  }
  if (!customerId) {
    const { data: nc } = await sb.from("customers").insert({ full_name: addr?.name ?? "Online Customer", phone: customerPhone, email: addr?.email, org_id: orgId, city: addr?.city ?? "Chennai", state: addr?.state ?? "Tamil Nadu", pincode: addr?.pincode ?? "600000" }).select("id").single();
    customerId = nc?.id ?? null;
  }
  if (!customerId) return NextResponse.json({ error: "Could not identify customer" }, { status: 500 });
  // Get branch id
  const token = String(branch ?? "").split(" ")[1]?.replace(/[%_,()]/g, "") || "East";
  let { data: br } = await sb.from("branches").select("id").eq("org_id", orgId).ilike("name", `%${token}%`).limit(1).maybeSingle();
  if (!br) ({ data: br } = await sb.from("branches").select("id").eq("org_id", orgId).limit(1).maybeSingle());
  const branchId = br?.id;
  if (!branchId) return NextResponse.json({ error: "No branch available" }, { status: 500 });
  // Build sale lines
  const lines = (cartItems ?? []).map((item: any) => ({
    line_type: item.lensPackageId ? "lens" : "product",
    product_id: item.lensPackageId ? undefined : item.productId,
    lens_package_id: item.lensPackageId ?? undefined,
    option_ids: item.addons ?? [],
    description: item.productName,
    qty: item.qty ?? 1,
    unit_price: item.framePrice ?? item.total,
    discount_pct: 0,
    tax_pct: 5,
  }));
  const payment = razorpay_payment_id ? { amount: paidAmount, method: "razorpay", reference: razorpay_payment_id } : payMethod === "cash" ? { amount: 0, method: "cash" } : undefined;
  const { data: saleData, error } = await sb.rpc("place_sale", { p: { kind: "order", customer_id: customerId, branch_id: branchId, lines, notes: `Online order. ${delivery==="pickup"?`Pickup: ${branch}`:`Deliver to ${addr?.city}`}. Razorpay: ${razorpay_order_id}`, payment } });
  if (error) { console.error("place_sale error:", error.message); return NextResponse.json({ error: dbError(error.message) }, { status: 500 }); }
  // Record online payment
  if (razorpay_payment_id) {
    // Webhook may have logged this payment first (sale_id null): attach instead of duplicating.
    await sb.from("online_payments").delete().eq("razorpay_payment_id", razorpay_payment_id).is("sale_id", null);
    await sb.from("online_payments").insert({ org_id: orgId, sale_id: saleData.id, customer_id: customerId, razorpay_order_id, razorpay_payment_id, razorpay_signature: razorpay_signature ?? null, amount: paidAmount, status: "paid" });
  }
  return NextResponse.json({ code: saleData.code, id: saleData.id });
}
