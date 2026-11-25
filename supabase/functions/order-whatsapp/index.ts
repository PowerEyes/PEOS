
// Order Status WhatsApp Updates — HTTP POST triggered on order status change
// Called from ERP server actions after updating sale status
// Body: { orderId, status, customerId?, phone?, customerName?, orderCode?, storeName? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsApp, logWA } from "../_shared/whatsapp.ts";
import { resolveTemplateName } from "../_shared/templates.ts";

import { tenant } from "../_shared/tenant.ts";
let ORG = tenant.org;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status:405 });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status:400 }); }

  const { orderId, status } = body;
  if (typeof orderId !== "string" || !orderId || typeof status !== "string" || !status) {
    return new Response("orderId and status required", { status:400 });
  }
  const { data: so, error: saleLookupError } = await sb
    .from("sales").select("org_id").eq("id", orderId).maybeSingle();
  if (saleLookupError || !so?.org_id) return new Response("Order not found", { status:404 });
  ORG = so.org_id;
  tenant.org = so.org_id;

  // Check if order updates are enabled
  const { data: settings } = await sb.from("crm_settings")
    .select("order_updates_enabled").eq("org_id",ORG).single();
  if (!settings?.order_updates_enabled) return new Response(JSON.stringify({ skipped:"disabled" }), { status:200 });

  // Fetch order + customer if not provided
  let { phone, customerName, orderCode, customerId, storeName } = body;
  if (!phone || !orderCode) {
    const { data: sale } = await sb.from("sales")
      .select("code,customers(full_name,phone),branches(name)")
      .eq("id", orderId).single();
    if (!sale) return new Response("Order not found", { status:404 });
    orderCode    = sale.code;
    customerName = customerName || (sale.customers as any)?.full_name || "Customer";
    phone        = phone        || (sale.customers as any)?.phone;
    customerId   = customerId   || (sale.customers as any)?.id;
    storeName    = storeName    || (sale.branches  as any)?.name  || "Mogappair East";
  }

  if (!phone) return new Response(JSON.stringify({ skipped:"no_phone" }), { status:200 });

  // Map status → message_templates key + params (Meta name resolved from DB)
  const STATUS_MAP: Record<string,[string,string[]]> = {
    processing:  ["order_confirmed",  [customerName, orderCode]],
    draft:       ["order_confirmed",  [customerName, orderCode]],
    ready:       ["order_ready",      [customerName, orderCode, storeName]],
    delivered:   ["order_delivered",  [customerName, orderCode]],
    cancelled:   ["order_cancelled",  [customerName, orderCode, "For more info, please contact us."]],
  };

  const mapping = STATUS_MAP[status];
  if (!mapping) return new Response(JSON.stringify({ skipped:`no_template_for_${status}` }), { status:200 });

  const [dbKey, params] = mapping;
  const template = await resolveTemplateName(sb, dbKey);

  // Avoid duplicate: don't send same status update twice for same order
  const { count } = await sb.from("whatsapp_log")
    .select("id",{count:"exact",head:true})
    .eq("category","order_update")
    .eq("metadata->order_id", orderId)
    .eq("metadata->status", status);

  if ((count ?? 0) > 0) return new Response(JSON.stringify({ skipped:"already_sent" }), { status:200 });

  const result = await sendWhatsApp(phone, template, params);
  await logWA(sb, customerId ?? null, phone, template, "order_update", result, {
    order_id: orderId, order_code: orderCode, status,
  });

  return new Response(JSON.stringify({ ok:result.success, error:result.error }), {
    status: result.success ? 200 : 500,
  });
});
