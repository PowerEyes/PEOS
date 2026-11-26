
"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";

async function canManageCRM() {
  const { data, error } = await supabaseServer().rpc("has_perm", { p: "crm_manage" });
  return !error && data === true;
}

export async function updateCRMSettings(fd: FormData) {
  const gate = await subscriptionGate(); if (gate) return gate;
  if (!(await canManageCRM())) return { error: "You do not have permission to manage CRM automation." };
  const sb = supabaseServer();
  const bool = (k:string) => fd.get(k) === "true";
  const num  = (k:string) => Number(fd.get(k) || 0);
  const { error } = await sb.from("crm_settings").update({
    rx_reminder_enabled:     bool("rx_reminder_enabled"),
    rx_reminder_days_before: num("rx_reminder_days_before"),
    birthday_enabled:        bool("birthday_enabled"),
    birthday_coupon_pct:     num("birthday_coupon_pct"),
    order_updates_enabled:   bool("order_updates_enabled"),
    cart_recovery_enabled:   bool("cart_recovery_enabled"),
    cart_recovery_hours:     num("cart_recovery_hours"),
    wa_provider:             fd.get("wa_provider")?.toString() ?? "meta",
    updated_at:              new Date(),
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/crm");
  return { ok: true };
}

export async function triggerFunction(fnName: string) {
  const gate = await subscriptionGate(); if (gate) return gate;
  if (!(await canManageCRM())) return { error: "You do not have permission to run CRM automation." };
  { const { data: ok } = await supabaseServer().rpc("is_admin"); if (!ok) return { error: "Only owners and admins can do this." }; }
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fnName}`;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    const r = await fetch(url, { method:"POST", headers:{ "Authorization":`Bearer ${key}`, "Content-Type":"application/json" }, body:"{}" });
    const d = await r.json();
    revalidatePath("/crm");
    return { ok:r.ok, result:d };
  } catch(e:any) { return { error:e.message }; }
}

export async function sendTestMessage(phone: string, template: string) {
  const gate = await subscriptionGate(); if (gate) return gate;
  if (!(await canManageCRM())) return { error: "You do not have permission to send CRM messages." };
  { const { data: ok } = await supabaseServer().rpc("is_admin"); if (!ok) return { error: "Only owners and admins can do this." }; }
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/order-whatsapp`;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    const r = await fetch(url, {
      method:"POST",
      headers:{ "Authorization":`Bearer ${key}`, "Content-Type":"application/json" },
      body: JSON.stringify({ phone, template, customerName:"Test Customer", orderCode:"TEST-001", storeName:"Mogappair East" }),
    });
    const d = await r.json();
    return { ok:r.ok, result:d };
  } catch(e:any) { return { error:e.message }; }
}
