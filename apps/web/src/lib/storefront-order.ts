type StorefrontPayment = {
  method: "razorpay" | "cash";
  amount: number;
  paymentId?: string | null;
  orderId?: string | null;
  signature?: string | null;
};

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "";

export async function finalizeStorefrontQuote(
  db: any,
  quoteRow: any,
  payment: StorefrontPayment,
  userId?: string | null,
) {
  if (!quoteRow?.id || !quoteRow?.org_id || !quoteRow?.quote) throw new Error("Checkout quote is invalid.");
  const quote = quoteRow.quote;
  if (!Array.isArray(quote.lines) || quote.lines.length < 1 || !quote.branch_id) throw new Error("Saved checkout lines are invalid.");

  if (quote.lines.some((line: any) => line?.line_type === "lens")) {
    throw new Error("Prescription lens orders require an optometrist-approved prescription and cannot be finalized through the public checkout flow yet.");
  }

  if (quoteRow.status === "consumed" && quoteRow.sale_id) {
    const { data: existing, error } = await db.from("sales").select("id,code").eq("id", quoteRow.sale_id).maybeSingle();
    if (error || !existing) throw new Error("The completed order could not be retrieved.");
    return { id: existing.id, code: existing.code, alreadyCompleted: true };
  }

  if (payment.method === "razorpay") {
    if (!payment.paymentId || !payment.orderId || quoteRow.razorpay_order_id !== payment.orderId) {
      throw new Error("Payment does not belong to this checkout quote.");
    }
    if (Math.round(Number(payment.amount) * 100) !== Number(quoteRow.amount_minor)) {
      throw new Error("Captured payment amount does not match the saved checkout quote.");
    }
    const { data: priorPayment, error: priorPaymentError } = await db.from("online_payments")
      .select("sale_id,razorpay_order_id").eq("razorpay_payment_id", payment.paymentId).maybeSingle();
    if (priorPaymentError) throw new Error("Could not check payment replay state.");
    if (priorPayment?.razorpay_order_id && priorPayment.razorpay_order_id !== payment.orderId) {
      throw new Error("Payment ID is already associated with another gateway order.");
    }
    if (priorPayment?.sale_id) {
      const { data: existingSale, error: existingSaleError } = await db.from("sales")
        .select("id,code").eq("id", priorPayment.sale_id).maybeSingle();
      if (existingSaleError || !existingSale) throw new Error("The previously settled sale could not be retrieved.");
      await db.from("checkout_quotes").update({
        status: "consumed", consumed_at: new Date().toISOString(), sale_id: existingSale.id,
      }).eq("id", quoteRow.id).neq("status", "consumed");
      return { id: existingSale.id, code: existingSale.code, alreadyCompleted: true };
    }
  }

  const address = quote.address ?? {};
  const contact = quote.customer ?? {};
  const phone = cleanText(contact.phone || address.phone, 20).replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) throw new Error("A valid 10-digit customer phone is required.");
  const emailCandidate = cleanText(contact.email || address.email, 120).toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate) ? emailCandidate : null;
  const fullName = cleanText(contact.name || address.name, 80) || "Online Customer";

  let customerId: string | null = null;
  if (userId) {
    const { data } = await db.from("customers").select("id").eq("auth_user_id", userId).eq("org_id", quoteRow.org_id).maybeSingle();
    if (data?.id) customerId = data.id;
  }
  if (!customerId && email) {
    const { data } = await db.from("customers").select("id").eq("org_id", quoteRow.org_id).ilike("email", email).limit(1).maybeSingle();
    if (data?.id) customerId = data.id;
  }
  if (!customerId) {
    const { data } = await db.from("customers").select("id").eq("org_id", quoteRow.org_id).eq("phone", phone).limit(1).maybeSingle();
    if (data?.id) customerId = data.id;
  }
  if (!customerId) {
    const { data, error } = await db.from("customers").insert({
      org_id: quoteRow.org_id,
      full_name: fullName,
      phone,
      email,
      city: cleanText(address.city, 60) || null,
      state: cleanText(address.state, 60) || null,
      pincode: cleanText(address.pincode, 10) || null,
    }).select("id").single();
    if (error || !data?.id) throw new Error("Could not create the customer record.");
    customerId = data.id;
  }

  const notes = `Online order.${quote.coupon_code ? ` Coupon ${cleanText(quote.coupon_code, 40)} applied.` : ""} ${quote.delivery === "pickup" ? `Pickup: ${cleanText(quote.branch_name, 100)}` : `Deliver to ${cleanText(address.line1, 200)}, ${cleanText(address.city, 60)} ${cleanText(address.pincode, 10)}`}.${payment.orderId ? ` Payment order: ${cleanText(payment.orderId, 80)}.` : ""}`;
  const salePayment = {
    amount: payment.method === "razorpay" ? payment.amount : 0,
    method: payment.method,
    reference: payment.paymentId ?? null,
  };
  const { data: sale, error: saleError } = await db.rpc("place_sale", {
    p: {
      org_id: quoteRow.org_id,
      idempotency_key: quoteRow.id,
      kind: "order",
      channel: "storefront",
      customer_id: customerId,
      branch_id: quote.branch_id,
      lines: quote.lines,
      notes,
      payment: salePayment,
    },
  });
  if (saleError || !sale?.id) throw new Error(saleError?.message || "Order creation did not return an order.");

  if (payment.method === "razorpay" && payment.paymentId) {
    const paymentRow = {
      org_id: quoteRow.org_id,
      sale_id: sale.id,
      customer_id: customerId,
      razorpay_order_id: payment.orderId,
      razorpay_payment_id: payment.paymentId,
      razorpay_signature: payment.signature ?? null,
      amount: payment.amount,
      status: "paid",
    };
    const { error: paymentInsertError } = await db.from("online_payments").insert(paymentRow);
    if (paymentInsertError) {
      // A concurrent webhook/browser callback may have inserted this exact payment.
      // Re-read by the unique payment ID and only attach it to the same gateway order.
      const { data: racedPayment, error: rereadError } = await db.from("online_payments")
        .select("sale_id,razorpay_order_id").eq("razorpay_payment_id", payment.paymentId).maybeSingle();
      if (rereadError || !racedPayment || racedPayment.razorpay_order_id !== payment.orderId ||
          (racedPayment.sale_id && racedPayment.sale_id !== sale.id)) {
        throw new Error("Order created; payment recording needs reconciliation.");
      }
      if (!racedPayment.sale_id) {
        const { error: attachError } = await db.from("online_payments")
          .update({ sale_id: sale.id, status: "paid", razorpay_signature: payment.signature ?? null })
          .eq("razorpay_payment_id", payment.paymentId).eq("razorpay_order_id", payment.orderId);
        if (attachError) throw new Error("Order created; payment recording needs reconciliation.");
      }
    }
  }

  const { error: consumeError } = await db.from("checkout_quotes")
    .update({ status: "consumed", consumed_at: new Date().toISOString(), sale_id: sale.id })
    .eq("id", quoteRow.id).neq("status", "consumed");
  if (consumeError) throw new Error("Order created; checkout quote finalization needs reconciliation.");

  return { id: sale.id, code: sale.code, customerId, alreadyCompleted: false };
}
