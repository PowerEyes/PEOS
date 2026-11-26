"use client";
import { useState } from "react";
import { saveBranding } from "./actions";
import type { Branding } from "@/lib/company-profile";

export function BrandingForm({ orgName, initial }: { orgName: string; initial: Branding }) {
  const [logo, setLogo] = useState(initial.logo_url);
  const [primary, setPrimary] = useState(initial.primary);
  const [accent, setAccent] = useState(initial.accent);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  async function save() {
    setBusy(true);
    setMsg({});
    setMsg(await saveBranding({ logo_url: logo, primary, accent }));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Identity used on invoices, exports and the public website. Colours
        default to the PowerOS navy and gold until you set your own.
      </p>

      <div className="card space-y-4 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Logo URL</span>
          <input
            className="field w-full"
            value={logo}
            maxLength={300}
            placeholder="https://cdn.example.com/logo.png or /logo.png"
            onChange={(e) => setLogo(e.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Absolute https URL or a path on your own site.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Primary colour</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
              />
              <input
                className="field w-full font-mono"
                value={primary}
                maxLength={7}
                onChange={(e) => setPrimary(e.target.value)}
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Accent colour</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
              />
              <input
                className="field w-full font-mono"
                value={accent}
                maxLength={7}
                onChange={(e) => setAccent(e.target.value)}
              />
            </span>
          </label>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Preview</span>
          <div className="rounded-xl p-4" style={{ background: primary }}>
            <p className="truncate font-display text-lg font-semibold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
              {orgName || "Your company"}
            </p>
            <span
              className="mt-2 inline-block rounded px-3 py-1 text-xs font-semibold text-white"
              style={{ background: accent }}
            >
              Invoice · Receipt
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save branding"}
        </button>
        {msg.ok && <span className="text-sm text-green-600">{msg.ok}</span>}
        {msg.error && <span className="text-sm text-red-600">{msg.error}</span>}
      </div>
    </div>
  );
}
