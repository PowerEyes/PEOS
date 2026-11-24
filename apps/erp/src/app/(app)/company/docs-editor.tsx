"use client";
import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { DOC_KINDS, daysUntil, type CompanyDoc } from "@/lib/company-profile";
import { saveCompanyDocuments } from "./actions";

type Row = CompanyDoc & { key: string };

const KIND_LABEL: Record<string, string> = {
  license: "Licence",
  registration: "Registration",
  certification: "Certification",
  insurance: "Insurance",
  other: "Other",
};

const blank = (n: number): Row => ({
  key: `new-${n}-${Date.now()}`,
  title: "",
  kind: "other",
  number: "",
  issued_on: "",
  expires_on: "",
  notes: "",
});

export function DocsEditor({ docs }: { docs: CompanyDoc[] }) {
  const [rows, setRows] = useState<Row[]>(() => docs.map((d, i) => ({ ...d, key: `doc-${i}` })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  const set = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setMsg({});
    const payload = rows.map((r) => ({
      title: r.title,
      kind: r.kind,
      number: r.number,
      issued_on: r.issued_on,
      expires_on: r.expires_on,
      notes: r.notes,
    }));
    setMsg(await saveCompanyDocuments(payload));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Licences, registrations and certificates your company holds. Expiring
        documents are flagged 90 days ahead so renewals never slip.
      </p>

      {rows.length === 0 && (
        <p className="card px-4 py-8 text-center text-sm text-slate-400">
          No documents yet — add your shop licence or GST registration to start.
        </p>
      )}

      {rows.map((r) => {
        const d = daysUntil(r.expires_on);
        return (
          <div key={r.key} className="card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-slate-400" />
              <span className="flex-1 text-sm font-semibold text-navy-900">Document</span>
              {d !== null && d < 0 && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-700">Expired</span>
              )}
              {d !== null && d >= 0 && d <= 90 && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">Expires in {d}d</span>
              )}
              <button
                type="button"
                aria-label="Remove document"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Title *</span>
                <input
                  className="field w-full"
                  value={r.title}
                  maxLength={120}
                  placeholder="Shop establishment licence"
                  onChange={(e) => set(r.key, { title: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Type</span>
                <select
                  className="field w-full"
                  value={r.kind}
                  onChange={(e) => set(r.key, { kind: e.target.value as CompanyDoc["kind"] })}
                >
                  {DOC_KINDS.map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Certificate / file no.</span>
                <input
                  className="field w-full"
                  value={r.number}
                  maxLength={60}
                  placeholder="TN/012345678"
                  onChange={(e) => set(r.key, { number: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Issued</span>
                  <input
                    type="date"
                    className="field w-full"
                    value={r.issued_on}
                    onChange={(e) => set(r.key, { issued_on: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Expires</span>
                  <input
                    type="date"
                    className="field w-full"
                    value={r.expires_on}
                    onChange={(e) => set(r.key, { expires_on: e.target.value })}
                  />
                </label>
              </div>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Notes</span>
                <textarea
                  className="field w-full"
                  rows={2}
                  maxLength={500}
                  value={r.notes}
                  placeholder="Issuing authority, renewal window…"
                  onChange={(e) => set(r.key, { notes: e.target.value })}
                />
              </label>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn"
          onClick={() => setRows((rs) => [...rs, blank(rs.length + 1)])}
        >
          <Plus size={14} /> Add document
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save documents"}
        </button>
        {msg.ok && <span className="text-sm text-green-600">{msg.ok}</span>}
        {msg.error && <span className="text-sm text-red-600">{msg.error}</span>}
      </div>
    </div>
  );
}
