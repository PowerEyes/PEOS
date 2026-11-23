"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@poweros/ui";
import { Activity, Plug, RefreshCw } from "lucide-react";
import { saveAnalytics } from "@/app/(app)/settings-actions";
import type { AppSettings } from "@/lib/settings";
import { L, SectionCard } from "./ui";

export function IntegrationsSection({
  settings,
  canEdit,
}: {
  settings: AppSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [ga, setGa] = useState(settings.analyticsId);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  async function checkHealth() {
    setChecking(true);
    try {
      const r = await fetch("/api/settings/integration-health", {
        cache: "no-store",
      });
      const j = await r.json();
      setHealth(r.ok ? j : { error: j.error ?? "Status check failed" });
    } catch {
      setHealth({ error: "Status check failed" });
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void checkHealth();
  }, []);

  async function save() {
    setBusy(true);
    const r = await saveAnalytics(ga);
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Website analytics"
        icon={Activity}
        footer={
          canEdit ? (
            <button disabled={busy} onClick={save} className="btn btn-gold">
              {busy ? "Saving…" : "Save analytics"}
            </button>
          ) : (
            <p className="text-xs text-slate-400">
              Only owners and admins can change these settings.
            </p>
          )
        }
      >
        <L
          t="Analytics ID"
          hint="Google Analytics measurement ID (G-XXXXXXXXXX) or a Plausible domain. Loaded on every page of the public website once saved."
        >
          <input
            className="field"
            value={ga}
            disabled={!canEdit}
            onChange={(e) => setGa(e.target.value)}
            placeholder="G-XXXXXXXXXX"
          />
        </L>
      </SectionCard>

      <SectionCard title="Integrations" icon={Plug}>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Configuration status only; secret values are never displayed.
            </p>
            <button
              onClick={checkHealth}
              disabled={checking}
              className="btn btn-ghost inline-flex items-center gap-2"
            >
              <RefreshCw size={14} />
              {checking ? "Checking…" : "Refresh status"}
            </button>
          </div>
          {health?.error && (
            <p role="status" className="text-xs text-amber-700">
              {health.error}
            </p>
          )}
          <Status
            label="Self-hosted PaddleOCR"
            configured={health?.ocr?.configured}
            reachable={health?.ocr?.reachable}
          />
          <Status
            label="Razorpay"
            configured={health?.razorpay?.configured}
            detail={health?.razorpay?.mode}
          />
          <Status
            label="WhatsApp automation"
            configured={health?.whatsapp?.configured}
            reachable={health?.whatsapp?.reachable}
            detail="Run a CRM test message to verify."
          />
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="font-medium text-slate-700">WhatsApp automations</p>
            <p className="mt-1 text-slate-500">
              Birthday, prescription-expiry, cart-recovery and order-update
              messages read their text from <b>Message Templates</b> below.
              After changing templates, redeploy the functions so they pick the
              new copy:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                supabase functions deploy
              </code>
            </p>
            <Link
              href="/crm"
              className="btn btn-ghost mt-3 inline-flex text-sm"
            >
              Open CRM automations
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="font-medium text-slate-700">Payments & coupons</p>
            <p className="mt-1 text-slate-500">
              Razorpay credentials belong only in the storefront server
              environment or secret manager:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                RAZORPAY_KEY_ID
              </code>{" "}
              and{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                RAZORPAY_KEY_SECRET
              </code>
              . Never expose the secret to browser code. Discount coupons are
              managed under{" "}
              <Link
                href="/website/coupons"
                className="font-medium text-navy-700 hover:underline"
              >
                Website → Coupons
              </Link>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="font-medium text-slate-700">
              Self-hosted prescription OCR
            </p>
            <p className="mt-1 text-slate-500">
              Runs locally on your private network using PaddleOCR. Configure{" "}
              <code>OCR_SERVICE_URL</code> and <code>OCR_SERVICE_TOKEN</code> on
              ERP and storefront servers. Install model files before starting
              the service.
            </p>
            <Link
              href="/settings?section=history"
              className="btn btn-ghost mt-3 inline-flex"
            >
              View configuration history
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Status({
  label,
  configured,
  reachable,
  detail,
}: {
  label: string;
  configured?: boolean | null;
  reachable?: boolean | null;
  detail?: string;
}) {
  const text =
    configured === null || configured === undefined
      ? "Not verified"
      : !configured
        ? "Not configured"
        : reachable === false
          ? "Configured · unavailable"
          : "Configured";
  const tone =
    configured === false
      ? "text-amber-700 bg-amber-50"
      : reachable === false
        ? "text-red-700 bg-red-50"
        : configured
          ? "text-emerald-700 bg-emerald-50"
          : "text-slate-600 bg-slate-100";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3">
      <span className="font-medium text-slate-700">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs ${tone}`}>{text}</span>
      {detail && (
        <span className="w-full text-xs text-slate-500">{detail}</span>
      )}
    </div>
  );
}
