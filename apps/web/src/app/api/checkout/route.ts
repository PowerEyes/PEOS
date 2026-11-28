import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { getOrgId, serviceDb } from "@/lib/tenant";
import { normalizeCartItems } from "@/lib/cart-normalize";
import { FALLBACK_LENS_USAGE, usageByCode, type LensUsage } from "@/lib/lens-usage";
import { prescriptionIsComplete, toRxSnapshot, type RxSnapshot } from "@/lib/prescription";
import { applyDiscountCap, getMaxDiscountPct } from "@/lib/discounts";

const clean = (v: unknown, n: number) => typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function usageFor(code: string | null, line: { requires_rx: boolean; requires_add: boolean }): LensUsage | undefined {
  const base = usageByCode(FALLBACK_LENS_USAGE, code);
  if (!base) return undefined;
  return { ...base, requires_rx: line.requires_rx, requires_add: line.requires_add };
}

export async function POST(req: Request) {
  if (await rateLimited(req, "rzp-order", 15, 600)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Your cart is empty or invalid." }, { status: 400 });
  }

  // The configurator used to store one combined frame+lens item, which the old
  // XOR validator rejected. Normalise it into real quote lines instead.
  const { lines, error: itemError } = normalizeCartItems(body.items);
  if (itemError) return NextResponse.json({ error: itemError }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Online checkout is not configured." }, { status: 503 });
  }

  try {
    const orgId = await getOrgId(), db = serviceDb();
    const productIds = [...new Set(lines.filter((l) => l.productId).map((l) => l.productId!))];
    const packageIds = [...new Set(lines.filter((l) => l.lensPackageId).map((l) => l.lensPackageId!))];
    const optionIds = [...new Set(lines.flatMap((l) => l.optionIds))];

    const [{ data: products, error: pe }, { data: packages, error: le }, { data: options, error: oe }, { data: gstSetting }] = await Promise.all([
      productIds.length ? db.from("products").select("id,org_id,kind,model,selling_price,tax_pct,price_mode,status").eq("org_id", orgId).eq("status", "active").in("id", productIds) : Promise.resolve({ data: [], error: null } as any),
      packageIds.length ? db.from("lens_packages").select("id,org_id,name,base_price,tax_pct,status").eq("org_id", orgId).eq("status", "active").in("id", packageIds) : Promise.resolve({ data: [], error: null } as any),
      optionIds.length ? db.from("lens_options").select("id,org_id,name,price,grp,status").eq("org_id", orgId).eq("status", "active").in("id", optionIds) : Promise.resolve({ data: [], error: null } as any),
      db.from("org_settings").select("key,value").eq("org_id", orgId).in("key", ["tax.gst_enabled", "gst_enabled"]),
    ]);
    if (pe || le || oe) throw new Error("Could not verify current catalogue prices.");
    const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));
    const packageMap = new Map((packages ?? []).map((p: any) => [p.id, p]));
    const optionMap = new Map((options ?? []).map((o: any) => [o.id, o]));
    if (productMap.size !== productIds.length || packageMap.size !== packageIds.length || optionMap.size !== optionIds.length) {
      return NextResponse.json({ error: "A cart item or lens option is no longer available. Refresh your cart." }, { status: 409 });
    }

    const branchId = typeof body.branch_id === "string" && UUID.test(body.branch_id) ? body.branch_id : "";
    const { data: branch } = await db.from("branches").select("id,name").eq("org_id", orgId).eq("is_active", true).eq("id", branchId).maybeSingle();
    if (!branch) return NextResponse.json({ error: "Choose an active pickup branch." }, { status: 400 });

    const saleLines: any[] = [];
    const grossLines: { unit: number; qty: number; tax: number; mode: "inclusive" | "exclusive" }[] = [];
    const gstRows = (gstSetting ?? []) as { key?: string; value?: unknown }[];
    const gstRow = gstRows.find((r) => r.key === "tax.gst_enabled") ?? gstRows[0];
    const gstEnabled = gstRow?.value !== false && gstRow?.value !== "false";
    let subtotal = 0;
    let prescriptionSnapshot: RxSnapshot | null = null;
    let prescriptionRequired = false;

    for (const line of lines) {
      if (line.kind === "product") {
        const p: any = productMap.get(line.productId!);
        const unit = Number(p.selling_price);
        saleLines.push({
          line_type: p.kind === "accessory" ? "accessory" : "product",
          product_id: p.id, description: `${p.model}`, qty: line.qty, discount_pct: 0,
        });
        const tax = gstEnabled ? Number(p.tax_pct) : 0;
        const mode = p.price_mode === "exclusive" ? "exclusive" : "inclusive";
        grossLines.push({ unit, qty: line.qty, tax, mode });
        subtotal += unit * line.qty * (mode === "exclusive" ? 1 + tax / 100 : 1);
        continue;
      }

      const pkg: any = packageMap.get(line.lensPackageId!);
      const selected = line.optionIds.map((id) => optionMap.get(id) as any);
      if (selected.some((o: any) => !o)) {
        return NextResponse.json({ error: "A selected lens option is unavailable. Refresh your cart." }, { status: 409 });
      }
      const usage = usageFor(line.usage, line);
      if (line.requires_rx) {
        prescriptionRequired = true;
        if (!prescriptionIsComplete(usage, line.rx)) {
          return NextResponse.json({
            error: usage?.requires_add
              ? "Add ADD power for both eyes before continuing."
              : "Complete the prescription details before continuing.",
          }, { status: 400 });
        }
        if (!prescriptionSnapshot) prescriptionSnapshot = toRxSnapshot(line.rx, usage);
      }

      const unit = Number(pkg.base_price) + selected.reduce((sum: number, o: any) => sum + Number(o.price), 0);
      saleLines.push({
        line_type: "lens",
        lens_package_id: pkg.id,
        option_ids: line.optionIds,
        description: `${pkg.name} lenses`,
        qty: line.qty,
        discount_pct: 0,
        usage: line.usage,
        requires_rx: line.requires_rx,
        requires_add: line.requires_add,
      });
      const tax = gstEnabled ? Number(pkg.tax_pct) : 0;
      grossLines.push({ unit, qty: line.qty, tax, mode: "inclusive" });
      subtotal += unit * line.qty;
    }

    if (subtotal <= 0 || subtotal > 500000) {
      return NextResponse.json({ error: "The cart total is outside the supported range." }, { status: 400 });
    }

    const couponCode = clean(body.coupon, 40).toUpperCase();
    let couponId: string | null = null;
    let discount = 0;
    let discountCapped = false;
    const capPct = await getMaxDiscountPct(db, orgId);
    if (couponCode) {
      const { data: coupon } = await db.from("coupons")
        .select("id,code,type,value,min_order,max_uses,uses,per_customer,valid_from,valid_until,is_active")
        .eq("org_id", orgId).eq("code", couponCode).eq("is_active", true).maybeSingle();
      const now = new Date();
      if (!coupon || (coupon.valid_from && new Date(coupon.valid_from) > now) ||
          (coupon.valid_until && new Date(coupon.valid_until) < now) ||
          (coupon.max_uses != null && Number(coupon.uses) >= Number(coupon.max_uses)) ||
          subtotal < Number(coupon.min_order ?? 0)) {
        return NextResponse.json({ error: "The coupon is no longer valid for this cart." }, { status: 409 });
      }

      const { data: { user } } = await supabaseServer().auth.getUser();
      let customerId: string | null = null;
      if (user) {
        const { data: customer } = await db.from("customers")
          .select("id").eq("org_id", orgId).eq("auth_user_id", user.id).maybeSingle();
        customerId = customer?.id ?? null;
      }
      if (customerId && Number(coupon.per_customer ?? 0) > 0) {
        const { count } = await db.from("coupon_uses")
          .select("id", { count: "exact", head: true })
          .eq("coupon_id", coupon.id).eq("customer_id", customerId);
        if ((count ?? 0) >= Number(coupon.per_customer)) {
          return NextResponse.json({ error: "You've already used this coupon." }, { status: 409 });
        }
      }

      const requested = coupon.type === "percent"
        ? (subtotal * Number(coupon.value)) / 100
        : Math.min(Number(coupon.value), subtotal);
      const capped = applyDiscountCap(subtotal, requested, capPct);
      discount = capped.discount;
      discountCapped = capped.capped;
      couponId = coupon.id;
    }

    const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
    saleLines.forEach((line) => { line.discount_pct = discountPct; });
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const netSubtotal = round2(grossLines.reduce((sum, line) => {
      if (line.mode === "exclusive") {
        const taxable = round2(line.qty * line.unit * (1 - discountPct / 100));
        return sum + taxable + round2((taxable * line.tax) / 100);
      }
      return sum + round2(line.qty * line.unit * (1 - discountPct / 100));
    }, 0));

    const deliveryFee = body.delivery === "delivery" ? 99 : 0;
    if (deliveryFee) saleLines.push({ line_type: "service", description: "Delivery fee", unit_price: deliveryFee, tax_pct: 0, qty: 1, discount_pct: 0 });
    const saleTotal = round2(netSubtotal + deliveryFee);
    const amountMinor = Math.round(saleTotal * 100);
    const address = body.delivery === "delivery" ? {
      name: clean(body.address?.name, 80),
      phone: clean(body.address?.phone, 20).replace(/\D/g, "").slice(-10),
      email: clean(body.address?.email, 120),
      line1: clean(body.address?.line1, 200),
      city: clean(body.address?.city, 60),
      state: clean(body.address?.state, 60),
      pincode: clean(body.address?.pincode, 10),
    } : null;
    // Pickup quotes have no postal address, but the phone is still what
    // identifies the customer and what /api/track-order looks orders up by —
    // so the contact is always saved on the quote. Without it order-confirm
    // had nothing to read and every pickup order failed with
    // "A valid 10-digit customer phone is required."
    const customer = {
      name: clean(body.address?.name || body.notes?.name, 80),
      phone: clean(body.address?.phone || body.notes?.phone, 20).replace(/\D/g, "").slice(-10),
      email: clean(body.address?.email || body.notes?.email, 120),
    };
    if (customer.phone.length !== 10) {
      return NextResponse.json({ error: "Enter a valid 10-digit customer phone number." }, { status: 400 });
    }
    if (address && (!address.line1 || !address.city || !address.pincode)) {
      return NextResponse.json({ error: "Complete the delivery address before paying." }, { status: 400 });
    }

    const quote = {
      lines: saleLines,
      subtotal: saleTotal,
      goods_subtotal: netSubtotal,
      gross_subtotal: round2(subtotal),
      coupon_code: couponCode || null,
      coupon_id: couponId,
      discount,
      discount_cap_pct: capPct,
      discount_capped: discountCapped,
      prescription_required: prescriptionRequired,
      prescription_snapshot: prescriptionSnapshot,
      delivery_fee: deliveryFee,
      delivery: body.delivery === "delivery" ? "delivery" : "pickup",
      branch_id: branch.id,
      branch_name: branch.name,
      customer,
      address,
    };
    const { data: saved, error: qe } = await db.from("checkout_quotes")
      .insert({ org_id: orgId, quote, amount_minor: amountMinor })
      .select("id").single();
    if (qe || !saved) throw new Error("Could not save the secure checkout quote.");

    if (body.payMethod === "cash") {
      return NextResponse.json({ quoteId: saved.id, amount: amountMinor, currency: "INR" });
    }

    const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) {
      await db.from("checkout_quotes").update({ status: "failed" }).eq("id", saved.id);
      return NextResponse.json({ error: "Online payment is not available right now. Please choose Pay at store." }, { status: 503 });
    }
    const notes = { name: clean(body.notes?.name, 80), phone: clean(body.notes?.phone, 15).replace(/\D/g, ""), email: clean(body.notes?.email, 120), quote_id: saved.id };
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountMinor, currency: "INR", notes, payment_capture: 1 }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.id || Number(result.amount) !== amountMinor) {
      await db.from("checkout_quotes").update({ status: "failed" }).eq("id", saved.id);
      return NextResponse.json({ error: "Payment gateway could not create the quoted order." }, { status: 502 });
    }
    const { error: linkError } = await db.from("checkout_quotes")
      .update({ razorpay_order_id: result.id }).eq("id", saved.id).eq("status", "created");
    if (linkError) return NextResponse.json({ error: "Could not securely link the payment order. Please retry." }, { status: 500 });
    return NextResponse.json({ orderId: result.id, quoteId: saved.id, amount: result.amount, currency: result.currency, keyId: key });
  } catch (error) {
    console.error("Checkout quote failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not calculate a secure checkout total. Please retry." }, { status: 503 });
  }
}
