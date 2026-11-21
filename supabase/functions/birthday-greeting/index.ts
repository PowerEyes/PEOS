
// Birthday Greeting — runs daily at 9 AM
// Finds customers with today's birthday, sends WhatsApp message with coupon

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsApp, logWA } from "../_shared/whatsapp.ts";
import { resolveTemplateName } from "../_shared/templates.ts";

import { tenant } from "../_shared/tenant.ts";
let ORG = "";

async function handle(req: Request): Promise<Response> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: run } = await sb.from("cron_runs")
    .insert({ job_name:"birthday-greeting", status:"running" })
    .select("id").single();
  const runId = run?.id;

  let sent = 0; let failed = 0;

  try {
    const { data: settings } = await sb.from("crm_settings")
      .select("birthday_enabled,birthday_coupon_pct").eq("org_id",ORG).single();

    if (!settings?.birthday_enabled) {
      await sb.from("cron_runs").update({ status:"completed", finished_at:new Date(), details:{skipped:"disabled"} }).eq("id",runId);
      return new Response(JSON.stringify({ skipped:"birthday_disabled" }), { status:200 });
    }

    const couponPct = settings.birthday_coupon_pct ?? 10;
    const tplName = await resolveTemplateName(sb, "birthday"); // settings-driven, once per run
    const today = new Date();
    const mm    = String(today.getMonth()+1).padStart(2,"0");
    const dd    = String(today.getDate()).padStart(2,"0");

    // Find customers whose birthday is today (match MM-DD portion of dob)
    const { data: customers } = await sb.from("customers")
      .select("id,full_name,phone,dob,referral_code,whatsapp_opt_in")
      .eq("org_id", ORG)
      .eq("whatsapp_opt_in", true)
      .like("dob", `%-${mm}-${dd}`)
      .not("phone","is",null);

    for (const c of (customers ?? [])) {
      if (!c.phone) continue;

      // Don't send twice on same day
      const { count } = await sb.from("whatsapp_log")
        .select("id",{ count:"exact", head:true })
        .eq("category","birthday")
        .eq("customer_id", c.id)
        .gte("sent_at", `${today.getFullYear()}-${mm}-${dd}T00:00:00`);
      if ((count ?? 0) > 0) continue;

      // Create a birthday coupon
      const couponCode = `BDAY${c.referral_code?.slice(-4) ?? Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const expiryDate = new Date(today); expiryDate.setDate(today.getDate() + 7);
      const expiryStr  = expiryDate.toLocaleDateString("en-IN",{day:"numeric",month:"short"});

      // Upsert the coupon
      await sb.from("coupons").upsert({
        org_id: ORG, code: couponCode,
        description: `Birthday discount for ${c.full_name}`,
        type: "percent", value: couponPct,
        min_order: 0, max_uses: 1, per_customer: 1,
        valid_from: today.toISOString().slice(0,10),
        valid_until: expiryDate.toISOString().slice(0,10),
        is_active: true,
      }, { onConflict:"org_id,code", ignoreDuplicates:false });

      const result = await sendWhatsApp(c.phone, tplName, [
        c.full_name,
        `${couponPct}%`,
        couponCode,
        expiryStr,
      ]);

      await logWA(sb, c.id, c.phone, tplName, "birthday", result, {
        coupon_code: couponCode, coupon_pct: couponPct,
        customer_dob: c.dob,
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
