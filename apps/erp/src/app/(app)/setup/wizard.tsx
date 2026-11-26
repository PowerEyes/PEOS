"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { AppSettings } from "@/lib/settings";
import { BusinessSection } from "@/app/(app)/settings/section-business";
import { TaxSection } from "@/app/(app)/settings/section-tax";
import { SalesSection } from "@/app/(app)/settings/section-sales";
import { WebsiteSection } from "@/app/(app)/settings/section-website";
import { ProductImport } from "./import";
import { GoLive } from "./golive";
import { saveSetupStep } from "./actions";

const TITLES = [
  "Business & branches",
  "Tax & invoicing",
  "Catalogue",
  "Team access",
  "Website contact",
  "Sales rules",
  "Review & go live",
];
export function SetupWizard({
  step: initial,
  settings,
  orgName,
  organization,
  branches,
  role,
  stats,
  ready,
}: {
  step: number;
  settings: AppSettings;
  orgName: string;
  organization: any;
  branches: any[];
  role: string;
  stats: { products: number; staff: number; whatsapp: boolean };
  ready: boolean;
}) {
  const [step, setStep] = useState(Math.min(6, Math.max(0, initial))),
    [busy, start] = useTransition(),
    [error, setError] = useState("");
  const canEdit = ["owner", "admin"].includes(role);
  function go(next: number) {
    setError("");
    start(async () => {
      const r = await saveSetupStep(next);
      if (r.error) setError(r.error);
      else setStep(next);
    });
  }
  const complete = [
    !!orgName && branches.length > 0,
    !!settings.gstin || !settings.gst,
    stats.products > 0,
    stats.staff > 1,
    stats.whatsapp,
    true,
    ready,
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">PowerOS setup</h1>
        <p className="text-sm text-slate-500">
          Configure each part in sequence. Your progress is saved to the
          organisation.
        </p>
      </header>
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Step {step + 1} of {TITLES.length}
          </span>
          <span>
            {complete.filter(Boolean).length} of {TITLES.length} ready
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${((step + 1) / TITLES.length) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
          {TITLES.map((t, i) => (
            <button
              key={t}
              onClick={() => go(i)}
              className={`rounded-lg px-2 py-2 text-left text-[11px] ${step === i ? "bg-navy-800 text-white" : "bg-slate-50 text-slate-600"}`}
            >
              <span className="mr-1">{complete[i] ? "✓" : "○"}</span>
              {t}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <section className="card space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">{TITLES[step]}</h2>
        {step === 0 && (
          <>
            <p className="text-sm text-slate-500">
              Add your organisation name and keep branch addresses and phone
              numbers current. These details appear on invoices and the store
              locator.
            </p>
            <BusinessSection
              orgName={orgName}
              organization={organization}
              branches={branches}
              canEdit={canEdit}
            />
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-sm text-slate-500">
              Set GST registration and invoice details before recording
              purchases or filing reports.
            </p>
            <TaxSection settings={settings} canEdit={canEdit} />
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-sm text-slate-500">
              Import your own CSV or load the sample catalogue stored in the
              PowerOS database. Sample rows are for testing; review prices and
              costs before using them.
            </p>
            <ProductImport />
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-sm text-slate-500">
              Invite staff and managers, assign their home branches, then set
              permissions for sensitive workflows.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn btn-primary" href="/staff">
                Invite team and configure permissions
              </Link>
              <Link className="btn btn-ghost" href="/audit">
                Review access audit log
              </Link>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <p className="text-sm text-slate-500">
              Set the contact number used by website and order help links. Leave
              it blank until you verify the business number.
            </p>
            <WebsiteSection settings={settings} canEdit={canEdit} />
          </>
        )}
        {step === 5 && (
          <>
            <p className="text-sm text-slate-500">
              Review discount thresholds, quotation validity and lab lead times
              before staff start placing orders.
            </p>
            <SalesSection settings={settings} canEdit={canEdit} />
          </>
        )}
        {step === 6 && (
          <>
            <div className="space-y-2">
              {TITLES.slice(0, 6).map((t, i) => (
                <div
                  key={t}
                  className="flex items-center justify-between border-b py-2 text-sm"
                >
                  <span>{t}</span>
                  <span
                    className={
                      complete[i] ? "text-emerald-700" : "text-amber-700"
                    }
                  >
                    {complete[i] ? "Ready" : "Needs attention"}
                  </span>
                </div>
              ))}
            </div>
            <GoLive ready={complete.slice(0, 6).every(Boolean)} />
          </>
        )}
      </section>
      <div className="flex justify-between">
        <button
          disabled={step === 0 || busy}
          onClick={() => go(step - 1)}
          className="btn btn-ghost"
        >
          Back
        </button>
        {step < TITLES.length - 1 && (
          <button
            disabled={busy}
            onClick={() => go(step + 1)}
            className="btn btn-primary"
          >
            {busy ? "Saving…" : "Save and continue"}
          </button>
        )}
      </div>
    </div>
  );
}
