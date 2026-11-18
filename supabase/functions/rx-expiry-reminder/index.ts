
// Prescription Expiry Reminder — runs daily at 9 AM via pg_cron
// Finds prescriptions expiring in 30 days, sends WhatsApp reminder once per prescription

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsApp, logWA } from "../_shared/whatsapp.ts";
import { resolveTemplateName } from "../_shared/templates.ts";

const ORG = "00000000-0000-0000-0000-000000000001";
const BOOKING_LINK = "https://powereyes.in/eye-test";

Deno.serve(async (req: Request) => {
  // Allow scheduled invocation (no bearer needed from pg_cron) or manual trigger with service role
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Log the cron run start
  const { data: run } = await sb.from("cron_runs")
    .insert({ job_name:"rx-expiry-reminder", status:"running" })
    .select("id").single();
  const runId = run?.id;

  let sent = 0; let failed = 0; const errors: string[] = [];

  try {
    // Get CRM settings
    const { data: settings } = await sb.from("crm_settings")
      .select("rx_reminder_enabled,rx_reminder_days_before")
      .eq("org_id", ORG).single();

    if (!settings?.rx_reminder_enabled) {
      await sb.from("cron_runs").update({ status:"completed", finished_at:new Date(), details:{ skipped:"disabled" } }).eq("id",runId);
      return new Response(JSON.stringify({ skipped:"rx_reminder_disabled" }), { status:200 });
    }

    const daysBefore = settings.rx_reminder_days_before ?? 30;
    const tplName = await resolveTemplateName(sb, "rx_expiry"); // settings-driven, once per run
    const today   = new Date();
    const target  = new Date(today); target.setDate(today.getDate() + daysBefore);
    const targetDate = target.toISOString().slice(0,10);

    // Find prescriptions expiring in exactly 'daysBefore' days
    // Also send for 7-day reminder if first reminder already sent
    const expiryWindows = [daysBefore, 7, 1];

    for (const daysLeft of expiryWindows) {
      const windowDate = new Date(today);
      windowDate.setDate(today.getDate() + daysLeft);
      const windowStr = windowDate.toISOString().slice(0,10);

      const { data: prescriptions } = await sb.from("prescriptions")
        .select("id,customer_id,valid_till,rx_code,customers(full_name,phone,email)")
        .eq("org_id", ORG)
        .gte("valid_till", windowStr + "T00:00:00")
        .lte("valid_till", windowStr + "T23:59:59")
        .not("valid_till", "is", null);

      for (const rx of (prescriptions ?? [])) {
        const c = rx.customers as any;
        if (!c?.phone) continue;

        // Check we haven't sent this exact reminder already
        const { count } = await sb.from("whatsapp_log")
          .select("id", { count:"exact", head:true })
          .eq("category", "rx_expiry")
          .eq("customer_id", rx.customer_id)
          .eq("metadata->days_left", String(daysLeft))
          .gte("sent_at", new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString());

        if ((count ?? 0) > 0) continue; // already sent today for this customer + window

        const expiryDisplay = new Date(rx.valid_till!)
          .toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });

        const result = await sendWhatsApp(c.phone, tplName, [
          c.full_name,
          String(daysLeft),
          expiryDisplay,
          BOOKING_LINK,
        ]);

        await logWA(sb, rx.customer_id, c.phone, tplName, "rx_expiry", result, {
          prescription_id: rx.id, rx_code: rx.rx_code,
          valid_till: rx.valid_till, days_left: daysLeft,
        });

        if (result.success) sent++; else { failed++; errors.push(`${c.phone}: ${result.error}`); }
      }
    }

    await sb.from("cron_runs").update({
      status:"completed", messages_sent:sent, messages_failed:failed,
      details:{ errors:errors.slice(0,10) }, finished_at:new Date(),
    }).eq("id", runId);

    return new Response(JSON.stringify({ ok:true, sent, failed }), { status:200 });

  } catch(e:any) {
    await sb.from("cron_runs").update({ status:"failed", error:e.message, finished_at:new Date() }).eq("id",runId);
    return new Response(JSON.stringify({ error:e.message }), { status:500 });
  }
});
