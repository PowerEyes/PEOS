
// Abandoned Cart Recovery — runs every 4 hours via pg_cron
// Finds customers with cart items older than N hours where no order was placed
// Sends a single recovery WhatsApp message per customer per cart cycle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsApp, logWA } from "../_shared/whatsapp.ts";
import { resolveTemplateName } from "../_shared/templates.ts";

import { tenant } from "../_shared/tenant.ts";
let ORG = "";
const CART_LINK = "https://powereyes.in/cart";

async function handle(req: Request): Promise<Response> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: run } = await sb.from("cron_runs")
    .insert({ job_name:"abandoned-cart", status:"running" })
    .select("id").single();
  const runId = run?.id;

  let sent = 0; let failed = 0;

  try {
    const { data: settings } = await sb.from("crm_settings")
      .select("cart_recovery_enabled,cart_recovery_hours").eq("org_id",ORG).single();
    if (!settings?.cart_recovery_enabled) {
      await sb.from("cron_runs").update({ status:"completed", finished_at:new Date(), details:{skipped:"disabled"} }).eq("id",runId);
      return new Response(JSON.stringify({ skipped:"cart_recovery_disabled" }), { status:200 });
    }

    const hours = settings.cart_recovery_hours ?? 4;
    const tplName = await resolveTemplateName(sb, "cart_recovery"); // settings-driven, once per run
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find cart_items created more than 'hours' ago but less than 24h ago
    // that have not been notified yet
    // Group by customer to send one message per customer
    const { data: carts } = await sb.from("cart_items")
      .select("id,customer_id,product_name,total,notified_at,customers(full_name,phone,whatsapp_opt_in)")
      .eq("org_id", ORG)
      .lte("created_at", cutoff)      // older than threshold
      .gte("created_at", oneDayAgo)   // not too old
      .is("notified_at", null)        // not yet notified
      .order("customer_id")
      .order("total", { ascending:false });

    // Group by customer — send one message per customer
    const byCustomer = new Map<string, any>();
    for (const item of (carts ?? [])) {
      if (!byCustomer.has(item.customer_id)) {
        byCustomer.set(item.customer_id, { ...item, itemCount:1 });
      } else {
        byCustomer.get(item.customer_id).itemCount++;
      }
    }

    for (const [customerId, item] of byCustomer) {
      const c = item.customers as any;
      if (!c?.phone) continue;
      // Respect communication opt-out
      if (c.whatsapp_opt_in === false) continue;

      // Check customer hasn't placed an order in the last 24h (cart may be cleared)
      const { count: recentOrders } = await sb.from("sales")
        .select("id",{count:"exact",head:true})
        .eq("customer_id", customerId)
        .eq("kind","order")
        .gte("created_at", oneDayAgo);

      if ((recentOrders ?? 0) > 0) {
        // Customer already ordered — mark cart as notified to skip next time
        await sb.from("cart_items").update({ notified_at:new Date() }).eq("customer_id", customerId).is("notified_at", null);
        continue;
      }

      const itemName = item.itemCount > 1
        ? `${item.product_name} and ${item.itemCount-1} more item${item.itemCount>2?"s":""}`
        : item.product_name ?? "some eyewear";

      const result = await sendWhatsApp(c.phone, tplName, [
        c.full_name,
        itemName,
        CART_LINK,
      ]);

      // Mark all this customer's cart items as notified
      await sb.from("cart_items").update({ notified_at:new Date() }).eq("customer_id", customerId).is("notified_at", null);

      await logWA(sb, customerId, c.phone, tplName, "cart_recovery", result, {
        item_name: itemName, item_count: item.itemCount,
      });

      if (result.success) sent++; else failed++;
    }

    await sb.from("cron_runs").update({
      status:"completed", messages_sent:sent, messages_failed:failed, finished_at:new Date(),
    }).eq("id",runId);

    return new Response(JSON.stringify({ ok:true, sent, failed }), { status:200 });

  } catch(e:any) {
    await sb.from("cron_runs").update({ status:"failed", error:e.message, finished_at:new Date() }).eq("id",runId);
    return new Response(JSON.stringify({ error:e.message }), { status:500 });
  }
}

// Fan-out: run the job once per organisation so every tenant is served by the same schedule.
Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: orgs } = await sb.from("organizations").select("id");
  const results: unknown[] = [];
  for (const o of orgs ?? []) { ORG = o.id; tenant.org = o.id;
    try { const r = await handle(req.clone()); results.push({ org: o.id, status: r.status }); }
    catch (e) { console.error("[job]", o.id, e); results.push({ org: o.id, error: String(e) }); } }
  return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
});
