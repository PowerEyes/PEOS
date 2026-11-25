import { NextResponse } from "next/server";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { getOrgId, serviceDb } from "@/lib/tenant";

const clean = (v: unknown, n: number) => typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (await rateLimited(req, "rzp-order", 15, 600)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) return NextResponse.json({ error: "Your cart is empty or invalid." }, { status: 400 });
  const items = body.items;
  if (!items.every((i: any) => i && (i.productId == null || UUID.test(i.productId)) && (i.lensPackageId == null || UUID.test(i.lensPackageId)) && (Boolean(i.productId) || Boolean(i.lensPackageId)) && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 10 && (i.optionIds == null || (Array.isArray(i.optionIds) && i.optionIds.length <= 20 && i.optionIds.every((id: string) => UUID.test(id)) && new Set(i.optionIds).size === i.optionIds.length)) && (!i.productId || !i.optionIds?.length) && (!i.addons?.length || (Array.isArray(i.optionIds) && i.optionIds.length > 0)))) return NextResponse.json({ error: "Your cart has an invalid item. Refresh and try again." }, { status: 400 });
  // The storefront configurator currently collects Rx values client-side but
  // does not persist an approved prescription into the ERP. Never create a
  // paid lens order that would skip the optometrist approval and lab workflow.
  if (items.some((item: any) => Boolean(item?.lensPackageId))) {
    return NextResponse.json({
      error: "Prescription lens checkout is not available online yet. An optometrist must verify and approve your prescription before lens production. Please place this order in store or book an appointment.",
    }, { status: 409 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Online checkout is not configured." }, { status: 503 });

  try {
    const orgId = await getOrgId(), db = serviceDb();
    const productIds = [...new Set(items.map((i: any) => i.productId).filter(Boolean))];
    const packageIds = [...new Set(items.map((i: any) => i.lensPackageId).filter(Boolean))];
    const optionIds = [...new Set(items.flatMap((i: any) => i.optionIds ?? []))];
    const [{ data: products, error: pe }, { data: packages, error: le }, { data: options, error: oe }, { data: gstSetting }] = await Promise.all([
      productIds.length ? db.from("products").select("id,org_id,kind,model,selling_price,tax_pct,price_mode,status").eq("org_id", orgId).eq("status", "active").in("id", productIds) : Promise.resolve({ data: [], error: null } as any),
      packageIds.length ? db.from("lens_packages").select("id,org_id,name,base_price,tax_pct,status").eq("org_id", orgId).eq("status", "active").in("id", packageIds) : Promise.resolve({ data: [], error: null } as any),
      optionIds.length ? db.from("lens_options").select("id,org_id,name,price,grp,status").eq("org_id", orgId).eq("status", "active").in("id", optionIds) : Promise.resolve({ data: [], error: null } as any),
      db.from("org_settings").select("value").eq("org_id", orgId).eq("key", "gst_enabled").maybeSingle(),
    ]);
    if (pe || le || oe) throw new Error("Could not verify current catalogue prices.");
    const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));
    const packageMap = new Map((packages ?? []).map((p: any) => [p.id, p]));
    const optionMap = new Map((options ?? []).map((o: any) => [o.id, o]));
    if (productMap.size !== productIds.length || packageMap.size !== packageIds.length || optionMap.size !== optionIds.length) return NextResponse.json({ error: "A cart item or lens option is no longer available. Refresh your cart." }, { status: 409 });
    const branchId = typeof body.branch_id === "string" && UUID.test(body.branch_id) ? body.branch_id : "";
    const { data: branch } = await db.from("branches").select("id,name").eq("org_id", orgId).eq("is_active", true).eq("id", branchId).maybeSingle();
    if (!branch) return NextResponse.json({ error: "Choose an active pickup branch." }, { status: 400 });
    const saleLines: any[] = [], grossLines: { unit:number; qty:number; tax:number; mode:"inclusive"|"exclusive" }[] = [];
    const gstEnabled = gstSetting?.value !== false && gstSetting?.value !== "false";
    let subtotal = 0;
    for (const item of items) {
      if (item.productId) {
        const p: any = productMap.get(item.productId);
        const unit = Number(p.selling_price);
        saleLines.push({ line_type: p.kind === "accessory" ? "accessory" : "product", product_id: p.id, description: `${p.model}`, qty: item.qty, discount_pct: 0 });
        const tax = gstEnabled ? Number(p.tax_pct) : 0, mode = p.price_mode === "exclusive" ? "exclusive" : "inclusive";
        grossLines.push({ unit, qty:item.qty, tax, mode }); subtotal += unit * item.qty * (mode === "exclusive" ? 1 + tax/100 : 1);
      }
      if (item.lensPackageId) {
        const pkg: any = packageMap.get(item.lensPackageId), ids: string[] = item.optionIds ?? [];
        const selected = ids.map((id) => optionMap.get(id) as any);
        if (selected.some((o: any) => !o)) return NextResponse.json({ error: "A selected lens option is unavailable. Refresh your cart." }, { status: 409 });
        const unit = Number(pkg.base_price) + selected.reduce((n: number, o: any) => n + Number(o.price), 0);
        saleLines.push({ line_type: "lens", lens_package_id: pkg.id, option_ids: ids, description: `${pkg.name} lenses`, qty: item.qty, discount_pct: 0 });
        const tax = gstEnabled ? Number(pkg.tax_pct) : 0;
        grossLines.push({ unit, qty:item.qty, tax, mode:"inclusive" }); subtotal += unit * item.qty;
      }
    }
    if (subtotal <= 0 || subtotal > 500000) return NextResponse.json({ error: "The cart total is outside the supported range." }, { status: 400 });
    let discount = 0;
    const couponCode = clean(body.coupon, 40).toUpperCase();
    if (couponCode) {
      const { data: coupon } = await db.from("coupons").select("id,code,type,value,min_order,max_uses,uses,valid_from,valid_until,is_active").eq("org_id", orgId).eq("code", couponCode).eq("is_active", true).maybeSingle();
      const now = new Date();
      if (!coupon || (coupon.valid_from && new Date(coupon.valid_from) > now) || (coupon.valid_until && new Date(coupon.valid_until) < now) || (coupon.max_uses != null && Number(coupon.uses) >= Number(coupon.max_uses)) || subtotal < Number(coupon.min_order ?? 0)) return NextResponse.json({ error: "The coupon is no longer valid for this cart." }, { status: 409 });
      discount = coupon.type === "percent" ? subtotal * Number(coupon.value) / 100 : Math.min(Number(coupon.value), subtotal);
      discount = Math.round(discount * 100) / 100;
    }
    const discountPct = subtotal > 0 ? discount / subtotal * 100 : 0;
    saleLines.forEach((line) => { line.discount_pct = discountPct; });
    const round2 = (n:number) => Math.round(n * 100) / 100;
    const netSubtotal = round2(grossLines.reduce((sum, line) => {
      if (line.mode === "exclusive") { const taxable=round2(line.qty*line.unit*(1-discountPct/100)); return sum+taxable+round2(taxable*line.tax/100); }
      return sum+round2(line.qty*line.unit*(1-discountPct/100));
    }, 0));
    const deliveryFee = body.delivery === "delivery" ? 99 : 0;
    if (deliveryFee) saleLines.push({ line_type: "service", description: "Delivery fee", unit_price: deliveryFee, tax_pct: 0, qty: 1, discount_pct: 0 });
    const saleTotal = Math.round((netSubtotal + deliveryFee) * 100) / 100;
    const amountMinor = Math.round((netSubtotal + deliveryFee) * 100);
    const address = body.delivery === "delivery" ? {
      name: clean(body.address?.name, 80), phone: clean(body.address?.phone, 20).replace(/\D/g, "").slice(-10), email: clean(body.address?.email, 120),
      line1: clean(body.address?.line1, 200), city: clean(body.address?.city, 60), state: clean(body.address?.state, 60), pincode: clean(body.address?.pincode, 10),
    } : null;
    if (address && (address.phone.length !== 10 || !address.line1 || !address.city || !address.pincode)) return NextResponse.json({ error: "Complete the delivery address before paying." }, { status: 400 });
    const contactName = clean(body.notes?.name, 80) || clean(address?.name, 80);
    const contactPhone = clean(body.notes?.phone, 20).replace(/\D/g, "").slice(-10) || clean(address?.phone, 20).replace(/\D/g, "").slice(-10);
    const contactEmailRaw = (clean(body.notes?.email, 120) || clean(address?.email, 120)).toLowerCase();
    const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmailRaw) ? contactEmailRaw : null;
    if (contactPhone.length !== 10) return NextResponse.json({ error: "Enter a valid 10-digit customer phone number." }, { status: 400 });
    const customer = { name: contactName || "Online Customer", phone: contactPhone, email: contactEmail };
    const quote = { lines: saleLines, subtotal: saleTotal, goods_subtotal: netSubtotal, gross_subtotal: Math.round(subtotal * 100) / 100, coupon_code: couponCode || null, discount, delivery_fee: deliveryFee, delivery: body.delivery === "delivery" ? "delivery" : "pickup", branch_id: branch.id, branch_name: branch.name, customer, address };
    const { data: saved, error: qe } = await db.from("checkout_quotes").insert({ org_id: orgId, quote, amount_minor: amountMinor }).select("id").single();
    if (qe || !saved) throw new Error("Could not save the secure checkout quote.");
    if (body.payMethod === "cash") return NextResponse.json({ quoteId: saved.id, amount: amountMinor, currency: "INR" });
    const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) { await db.from("checkout_quotes").update({ status: "failed" }).eq("id", saved.id); return NextResponse.json({ error: "Online payment is not available right now. Please choose Pay at store." }, { status: 503 }); }
    const notes = { name: customer.name, phone: customer.phone, email: customer.email ?? "", quote_id: saved.id };
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountMinor, currency: "INR", notes, payment_capture: 1 }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.id || Number(result.amount) !== amountMinor) {
      await db.from("checkout_quotes").update({ status: "failed" }).eq("id", saved.id);
      return NextResponse.json({ error: "Payment gateway could not create the quoted order." }, { status: 502 });
    }
    const { error: linkError } = await db.from("checkout_quotes").update({ razorpay_order_id: result.id }).eq("id", saved.id).eq("status", "created");
    if (linkError) return NextResponse.json({ error: "Could not securely link the payment order. Please retry." }, { status: 500 });
    return NextResponse.json({ orderId: result.id, quoteId: saved.id, amount: result.amount, currency: result.currency, keyId: key });
  } catch (error) {
    console.error("Checkout quote failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not calculate a secure checkout total. Please retry." }, { status: 503 });
  }
}
