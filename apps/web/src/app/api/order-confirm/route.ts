import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { dbError } from "@poweros/business-rules";
export async function POST(req: Request) {
  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, cartItems, delivery, branch, addr, total, payMethod } = body;
  // Verify Razorpay signature (skip for COD/test)
  if (razorpay_payment_id && razorpay_signature && process.env.RAZORPAY_KEY_SECRET) {
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (hmac !== razorpay_signature) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Find or create customer
  const customerPhone = addr?.phone ?? "";
  let customerId: string | null = null;
  if (addr?.email) {
    const { data: cust } = await sb.from("customers").select("id").eq("email", addr.email).limit(1).single();
    if (cust) customerId = cust.id;
  }
  if (!customerId && customerPhone) {
    const { data: cust } = await sb.from("customers").select("id").eq("phone", customerPhone).limit(1).single();
    if (cust) customerId = cust.id;
  }
  if (!customerId) {
    const { data: nc } = await sb.from("customers").insert({ full_name: addr?.name ?? "Online Customer", phone: customerPhone, email: addr?.email, org_id: "00000000-0000-0000-0000-000000000001", city: addr?.city ?? "Chennai", state: addr?.state ?? "Tamil Nadu", pincode: addr?.pincode ?? "600000" }).select("id").single();
    customerId = nc?.id ?? null;
  }
  if (!customerId) return NextResponse.json({ error: "Could not identify customer" }, { status: 500 });
  // Get branch id
  const { data: br } = await sb.from("branches").select("id").ilike("name", `%${branch?.split(" ")[1] ?? "East"}%`).single();
  const branchId = br?.id;
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
  const payment = razorpay_payment_id ? { amount: total, method: "razorpay", reference: razorpay_payment_id } : payMethod === "cash" ? { amount: 0, method: "cash" } : undefined;
  const { data: saleData, error } = await sb.rpc("place_sale", { p: { kind: "order", customer_id: customerId, branch_id: branchId, lines, notes: `Online order. ${delivery==="pickup"?`Pickup: ${branch}`:`Deliver to ${addr?.city}`}. Razorpay: ${razorpay_order_id}`, payment } });
  if (error) { console.error("place_sale error:", error.message); return NextResponse.json({ error: dbError(error.message) }, { status: 500 }); }
  // Record online payment
  if (razorpay_payment_id) {
    await sb.from("online_payments").insert({ org_id: "00000000-0000-0000-0000-000000000001", sale_id: saleData.id, customer_id: customerId, razorpay_order_id, razorpay_payment_id, razorpay_signature: razorpay_signature ?? null, amount: total, status: "paid" });
  }
  return NextResponse.json({ code: saleData.code, id: saleData.id });
}
