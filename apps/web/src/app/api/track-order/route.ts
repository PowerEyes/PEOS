
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Guest order tracker: order code + phone number are the knowledge factors.
 * Uses the service role because `customers` RLS hides rows from anon (the
 * previous anon-client version could never resolve the phone lookup) and the
 * success screen /track-order page both depend on this returning real data.
 * Only status + totals + line descriptions come back — no PII beyond what the
 * caller already supplied.
 */
import { rateLimited, tooMany } from "@/lib/ratelimit";

export async function GET(req: Request) {
  if (await rateLimited(req, "track-ip", 20, 600)) return tooMany();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const phone = searchParams.get("phone")?.trim().replace(/\D/g,"");

  if (!code || !phone) return NextResponse.json({ error:"Order number and phone number are required." }, { status:400 });
  if (phone.length < 10) return NextResponse.json({ error:"Enter a valid 10-digit phone number." }, { status:400 });

  // Per-order limiter stops distributed guessing of phone numbers for one order code.
  if (await rateLimited(req, "track-code", 8, 3600, code)) return tooMany();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Look up customer by phone
  const { data: customer } = await sb
    .from("customers").select("id").eq("phone", phone).limit(1).maybeSingle();

  if (!customer) return NextResponse.json({ error:"No account found with that phone number. Check the number or contact us on WhatsApp." }, { status:404 });

  // Look up order by code + customer
  const { data: order } = await sb
    .from("sales")
    .select("id,code,status,payment_status,grand_total,paid_total,needs_lab,created_at,sale_lines(description,qty,line_total,line_type)")
    .eq("code", code)
    .eq("customer_id", customer.id)
    .eq("kind","order")
    .maybeSingle();

  if (!order) return NextResponse.json({ error:`Order #${code} not found for this phone number. Please check and try again.` }, { status:404 });

  return NextResponse.json({
    code: order.code,
    status: order.status,
    payment_status: order.payment_status,
    grand_total: order.grand_total,
    paid_total: order.paid_total,
    needs_lab: order.needs_lab,
    created_at: order.created_at,
    lines: order.sale_lines,
  });
}
