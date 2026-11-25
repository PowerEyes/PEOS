import { supabaseServer } from "@/lib/supabase/server";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";

export default async function IntegrationsSettingsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const whatsappConfigured = Boolean(process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID) || Boolean(process.env.WA_INTERAKT_API_KEY);
  const ocrConfigured = Boolean(process.env.OCR_SERVICE_URL && process.env.OCR_SERVICE_TOKEN);
  const integrations = [
    { name: "Razorpay", desc: "Payment gateway", configured: razorpayConfigured, detail: "Configuration presence checked; live payment health and webhook delivery are not verified here." },
    { name: "WhatsApp Business", desc: "Messaging and notifications", configured: whatsappConfigured, detail: "Provider credentials appear configured; a provider test message is required to verify delivery." },
    { name: "Self-hosted OCR", desc: "Prescription OCR", configured: ocrConfigured, detail: "Endpoint and token presence checked; service reachability is not verified on this page." },
    { name: "Google Analytics", desc: "Website analytics", configured: Boolean(process.env.NEXT_PUBLIC_GA_ID), detail: "Measurement ID presence checked; event delivery is not verified." },
  ];
  const configured = integrations.filter(i=>i.configured).length;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-navy-900">Integrations</h1><p className="text-sm text-slate-500">Configuration status for external services. Secret values are never displayed.</p></div>
      <ModuleKpiGrid items={[{label:"Available integrations",value:integrations.length,detail:"Services listed here"},{label:"Configured",value:configured,tone:configured?"success":"warning",detail:"Required environment values present"},{label:"Not configured",value:integrations.length-configured,tone:"warning",detail:"Configuration missing"},{label:"Live health checks",value:"Not checked",tone:"warning",detail:"Connectivity/delivery require dedicated test"}]} />
      <div className="space-y-3">{integrations.map((i)=> <section key={i.name} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-medium text-navy-900">{i.name}</p><p className="text-sm text-slate-500">{i.desc}</p><p className="mt-1 text-xs text-slate-500">{i.detail}</p></div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${i.configured?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-800"}`}>{i.configured?"Configured":"Not configured"}</span>
      </section>)}</div>
      <p className="text-xs text-slate-500">Environment-variable presence is a configuration signal only, not proof that an integration is healthy or production-ready.</p>
    </div>
  );
}
