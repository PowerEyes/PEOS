
// Shared WhatsApp Business API client
// Supports Meta Cloud API (official) and Interakt (popular in India)
// Set WA_PROVIDER=meta|interakt in Edge Function secrets

import { tenant } from "./tenant.ts";

export type WAResult = { success: boolean; messageId?: string; error?: string };

// ── Meta Cloud API ────────────────────────────────────────────────────────────
async function sendMetaTemplate(
  phone: string,
  templateName: string,
  params: string[],
  phoneNumberId: string,
  accessToken: string,
): Promise<WAResult> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/\D/g, "").replace(/^0/, "91"),
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: params.length > 0 ? [{
        type: "body",
        parameters: params.map(p => ({ type: "text", text: p })),
      }] : [],
    },
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || data.error) return { success:false, error: data.error?.message ?? JSON.stringify(data) };
    return { success:true, messageId: data.messages?.[0]?.id };
  } catch(e:any) { return { success:false, error:e.message }; }
}

// ── Interakt API (popular in India — interakt.co) ─────────────────────────────
async function sendInteraktTemplate(
  phone: string,
  templateName: string,
  params: string[],
  apiKey: string,
): Promise<WAResult> {
  const url = "https://api.interakt.ai/v1/public/message/";
  const body = {
    countryCode: "+91",
    phoneNumber: phone.replace(/\D/g,"").slice(-10),
    callbackData: "PowerEyes",
    type: "Template",
    template: {
      name: templateName,
      languageCode: "en",
      bodyValues: params,
    },
  };
  try {
    const r = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Basic ${apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || !data.result) return { success:false, error:JSON.stringify(data) };
    return { success:true, messageId: data.id };
  } catch(e:any) { return { success:false, error:e.message }; }
}

// ── Main send function — picks provider from env ──────────────────────────────
export async function sendWhatsApp(
  phone: string,
  templateName: string,
  params: string[],
): Promise<WAResult> {
  const provider   = Deno.env.get("WA_PROVIDER")  ?? "meta";
  const accessToken= Deno.env.get("WA_ACCESS_TOKEN") ?? "";
  const phoneNumId = Deno.env.get("WA_PHONE_NUMBER_ID") ?? "";
  const interaktKey= Deno.env.get("WA_INTERAKT_API_KEY") ?? "";

  if (!phone || phone.replace(/\D/g,"").length < 10) {
    return { success:false, error:"Invalid phone number" };
  }
  if (provider === "interakt" && interaktKey) {
    return sendInteraktTemplate(phone, templateName, params, interaktKey);
  }
  if (accessToken && phoneNumId) {
    return sendMetaTemplate(phone, templateName, params, phoneNumId, accessToken);
  }
  // Fallback: log only (useful for testing without credentials)
  console.log(`[WA-MOCK] To:${phone} Template:${templateName} Params:${params.join("|")}`);
  return { success:true, messageId:`mock-${Date.now()}` };
}

// ── Log the result to whatsapp_log table ──────────────────────────────────────
export async function logWA(
  sb: any,
  customerId: string | null,
  phone: string,
  template: string,
  category: string,
  result: WAResult,
  metadata: Record<string, any> = {},
) {
  await sb.from("whatsapp_log").insert({
    org_id: tenant.org,
    customer_id: customerId,
    phone,
    template,
    category,
    status: result.success ? "sent" : "failed",
    wa_message_id: result.messageId ?? null,
    error: result.error ?? null,
    metadata,
  });
}
