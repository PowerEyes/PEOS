"use client";
import { useState } from "react";
import { savePolicies } from "./actions";
import type { Policies } from "@/lib/company-profile";

const FIELDS: Array<{ key: keyof Policies; label: string; hint: string; placeholder: string }> = [
  {
    key: "returns",
    label: "Returns & exchanges",
    hint: "Prescription glasses, frames and contact lenses — what can be returned, within how many days.",
    placeholder: "Frames may be exchanged within 7 days with the original receipt…",
  },
  {
    key: "warranty",
    label: "Warranty",
    hint: "Cover on lenses and frames, and what voids it.",
    placeholder: "One-year manufacturer warranty against coating defects…",
  },
  {
    key: "privacy",
    label: "Patient data privacy",
    hint: "How customer and prescription records are held and used — shown to patients on request.",
    placeholder: "Prescription details are stored securely and never shared without consent…",
  },
];

export function PoliciesForm({ initial }: { initial: Policies }) {
  const [values, setValues] = useState<Policies>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  async function save() {
    setBusy(true);
    setMsg({});
    setMsg(await savePolicies(values));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Company policy texts kept with the profile so every branch quotes the
        same rules. Each is capped at 4,000 characters.
      </p>

      <div className="card space-y-4 p-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium">{f.label}</span>
            <textarea
              className="field w-full"
              rows={5}
              maxLength={4000}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
            <span className="mt-1 block text-xs text-slate-400">{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save policies"}
        </button>
        {msg.ok && <span className="text-sm text-green-600">{msg.ok}</span>}
        {msg.error && <span className="text-sm text-red-600">{msg.error}</span>}
      </div>
    </div>
  );
}
