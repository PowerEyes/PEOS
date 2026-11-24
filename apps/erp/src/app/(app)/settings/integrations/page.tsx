import { supabaseServer } from "@/lib/supabase/server";

export default async function IntegrationsSettingsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Integrations</h1>
      <p className="text-sm text-slate-500">Razorpay, messaging and external services</p>
      <div className="space-y-4">
        {[
          { name: "Razorpay", desc: "Payment gateway", status: "Connected" },
          { name: "WhatsApp Business", desc: "Messaging & notifications", status: "Not configured" },
          { name: "OCR Service", desc: "Prescription OCR", status: "Not configured" },
          { name: "Google Analytics", desc: "Website analytics", status: "Not configured" },
        ].map((i) => (
          <div key={i.name} className="card p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-navy-900">{i.name}</p>
              <p className="text-sm text-slate-500">{i.desc}</p>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${i.status === "Connected" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{i.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}