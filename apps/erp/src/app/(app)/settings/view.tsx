"use client";
import { useState } from "react";
import { Building2, Receipt, Sliders, Star, MessageCircle, Plug, Hash, MessageSquare, Shield } from "lucide-react";
import type { AppSettings } from "@/lib/settings";
import { BusinessSection } from "./section-business";
import { TaxSection } from "./section-tax";
import { SalesSection } from "./section-sales";
import { LoyaltySection } from "./section-loyalty";
import { WebsiteSection } from "./section-website";
import { IntegrationsSection } from "./section-integrations";
import { PrefixesSection } from "./section-prefixes";
import { TemplatesSection } from "./section-templates";

const SECTIONS = [
  { key: "business", label: "Business & Branches", icon: Building2, desc: "Name, stores, contact details" },
  { key: "tax", label: "Tax & Invoicing", icon: Receipt, desc: "GST, GSTIN, invoice footer" },
  { key: "sales", label: "Sales & Lab", icon: Sliders, desc: "Discounts, quotes, lead times" },
  { key: "loyalty", label: "Loyalty", icon: Star, desc: "Earn & redeem rates" },
  { key: "website", label: "Website & Contact", icon: MessageCircle, desc: "WhatsApp number, Instagram" },
  { key: "integrations", label: "Analytics & Integrations", icon: Plug, desc: "GA ID, automations, payments" },
  { key: "prefixes", label: "Code Prefixes", icon: Hash, desc: "CUS-, REP-, ORD-…" },
  { key: "templates", label: "Message Templates", icon: MessageSquare, desc: "WhatsApp message copy" },
] as const;

export function SettingsPage({ settings, orgName, branches, loyalty, templates, role }: {
  settings: AppSettings; orgName: string; branches: any[]; loyalty: any; templates: any[]; role: string;
}) {
  const [active, setActive] = useState<string>("business");
  const canEdit = ["owner", "admin"].includes(role);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-slate-500">Business configuration and preferences</p>
      </div>
      {!canEdit && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Shield size={16} className="mr-1 inline" /> Only owners and admins can change settings — you can review everything below.
        </div>)}
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="card flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible p-2 h-fit">
          {SECTIONS.map((sec) => (
            <button key={sec.key} onClick={() => setActive(sec.key)}
              className={`flex items-center lg:items-start gap-2 lg:gap-3 shrink-0 whitespace-nowrap lg:whitespace-normal rounded-xl px-3 py-2 lg:py-2.5 text-left transition ${active === sec.key ? "bg-navy-800 text-white" : "hover:bg-slate-50 text-slate-700"}`}>
              <sec.icon size={16} className="shrink-0 lg:mt-0.5" />
              <span className="min-w-0">
                <span className="block text-xs sm:text-sm font-medium">{sec.label}</span>
                <span className={`hidden lg:block truncate text-xs ${active === sec.key ? "text-white/60" : "text-slate-400"}`}>{sec.desc}</span>
              </span>
            </button>))}
        </nav>
        <div className="min-w-0 space-y-6">
          {active === "business" && <BusinessSection orgName={orgName} branches={branches} canEdit={canEdit} />}
          {active === "tax" && <TaxSection settings={settings} canEdit={canEdit} />}
          {active === "sales" && <SalesSection settings={settings} canEdit={canEdit} />}
          {active === "loyalty" && <LoyaltySection loyalty={loyalty} canEdit={canEdit} />}
          {active === "website" && <WebsiteSection settings={settings} canEdit={canEdit} />}
          {active === "integrations" && <IntegrationsSection settings={settings} canEdit={canEdit} />}
          {active === "prefixes" && <PrefixesSection settings={settings} canEdit={canEdit} />}
          {active === "templates" && <TemplatesSection templates={templates} canEdit={canEdit} />}
        </div>
      </div>
    </div>);
}
