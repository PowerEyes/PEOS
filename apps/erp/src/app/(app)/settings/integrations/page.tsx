import { redirect } from "next/navigation";
import Link from "next/link";
import { adminCtx } from "@/lib/admin-guard";
import { googleConfigured } from "@/lib/google-drive";
import { isRazorpayConfigured } from "@/lib/razorpay";
export const dynamic = "force-dynamic";
// Status only: reports whether each service is configured on this deployment. Secret values are never read into the page.
export default async function IntegrationsSettingsPage() {
  const a = await adminCtx(); if (!a) redirect("/");
  const { data: st } = await a.sb.rpc("integration_status", { p_provider: "google_drive" });
  const drive = (Array.isArray(st) ? st[0] : st) as any;
  const e = (k: string) => Boolean(process.env[k]?.trim());
  const items: { name: string; desc: string; on: boolean; detail: string; href?: string }[] = [
    { name: "Razorpay", desc: "Online payments and subscription billing", on: isRazorpayConfigured(), detail: isRazorpayConfigured() ? "Keys configured" : "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET" },
    { name: "Google Drive backup", desc: "Nightly company-data backup", on: Boolean(drive?.connected), detail: drive?.connected ? `Connected${drive.account_label ? ` · ${drive.account_label}` : ""}` : googleConfigured() ? "Not connected yet" : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET", href: "/settings/backup" },
    { name: "Prescription OCR", desc: "Reads uploaded prescriptions", on: e("OCR_SERVICE_URL") && e("OCR_SERVICE_TOKEN"), detail: e("OCR_SERVICE_URL") ? "Service configured" : "Set OCR_SERVICE_URL and OCR_SERVICE_TOKEN" },
    { name: "Scheduled jobs", desc: "Nightly backup trigger", on: e("CRON_SECRET"), detail: e("CRON_SECRET") ? "CRON_SECRET set" : "Set CRON_SECRET" },
  ];
  return (<div className="mx-auto max-w-3xl space-y-4"><div><h1 className="text-xl font-semibold">Integrations</h1><p className="text-sm text-slate-500">Connection status for external services.</p></div>
    <ul className="divide-y rounded-xl border bg-white">{items.map(i => <li key={i.name} className="flex items-center justify-between gap-3 p-4 text-sm"><div><p className="font-medium">{i.name}</p><p className="text-slate-500">{i.desc}</p><p className="text-xs text-slate-400">{i.detail}</p></div>
      <div className="flex items-center gap-3">{i.href && <Link href={i.href} className="text-brand-700 underline">Manage</Link>}<span className={`rounded-full px-2 py-0.5 text-xs ${i.on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{i.on ? "Active" : "Inactive"}</span></div></li>)}</ul></div>);
}
