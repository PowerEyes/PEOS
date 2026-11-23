"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { MessageSquare, Plus, Archive, RotateCcw } from "lucide-react";
import {
  archiveTemplate,
  createTemplate,
  saveTemplate,
} from "@/app/(app)/settings-actions";
import { L, SectionCard, Switch } from "./ui";

const SAMPLE: Record<string, string> = {
  Name: "Ananya",
  Item: "your Titan frame",
  Store: "Mogappair East",
  Code: "ORD-0042",
  Amount: "₹4,500",
  "Valid Till": "25 Nov 2026",
  Balance: "₹1,200",
  "Rx Code": "RX-0042",
  Link: "https://powereyes.in/my/prescriptions",
  Type: "eye test",
  Date: "25 Nov 2026",
  Time: "4:30 PM",
  Detail: "lens coating options",
  "Next Action": "Call today",
  "Existing Customer Name": "Ravi",
  Discount: "10%",
  Coupon: "FAMILY15",
  Expiry: "30 Nov 2026",
  "Cart Link": "https://powereyes.in/cart",
  Product: "monthly contact lenses",
  Months: "6",
  Days: "30",
  "Expiry Date": "25 Dec 2026",
};
const fillPreview = (t: string) =>
  t.replace(/\[([^\]]+)\]/g, (m, k) => SAMPLE[k] ?? m);

const CATEGORY_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  order: "Order journey",
  repair: "Repair journey",
  after_sales: "After-sales",
  feedback: "Feedback",
  relationship: "Customer relationship",
  staff: "Staff (internal)",
  documents: "Documents",
  appointments: "Appointments",
  sales: "Sales",
  finance: "Finance",
  automation: "Automations",
  general: "General",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL);

export function TemplatesSection({
  templates,
  canEdit,
}: {
  templates: any[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selId, setSelId] = useState<string | null>(templates[0]?.id ?? null);
  const sel = templates.find((t) => t.id === selId) ?? null;
  const [name, setName] = useState("");
  const [meta, setMeta] = useState("");
  const [auto, setAuto] = useState("");
  const [staff, setStaff] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newVariables, setNewVariables] = useState("");
  const [newAuto, setNewAuto] = useState("");
  const [newStaff, setNewStaff] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const selKey = sel?.id;
  useEffect(() => {
    if (!sel) return;
    setName(sel.name);
    setMeta(sel.meta_template ?? "");
    setAuto(sel.body_auto);
    setStaff(sel.body_staff);
    setActive(sel.is_active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  async function save() {
    if (!sel) return;
    setBusy(true);
    const r = await saveTemplate({
      id: sel.id,
      name,
      bodyAuto: auto,
      bodyStaff: staff,
      isActive: active,
      metaTemplate: meta,
    });
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  async function create() {
    setBusy(true);
    const r = await createTemplate({
      name: newName,
      category: newCategory,
      variables: newVariables,
      bodyAuto: newAuto,
      bodyStaff: newStaff,
    });
    setBusy(false);
    if (r.error) toast(r.error, "err");
    else {
      toast(r.ok!);
      setCreating(false);
      setNewName("");
      setNewAuto("");
      setNewStaff("");
      router.refresh();
    }
  }
  async function archive() {
    if (!sel) return;
    setBusy(true);
    const r = await archiveTemplate(sel.id, sel.is_active);
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }
  const preview = fillPreview(staff);
  const sampleUrl = testPhone.trim()
    ? `https://wa.me/${testPhone.replace(/\D/g, "")}?text=${encodeURIComponent(preview)}`
    : "";

  const groups: Array<[string, any[]]> = [];
  for (const t of templates) {
    const g = groups.find(([c]) => c === t.category);
    if (g) g[1].push(t);
    else groups.push([t.category, [t]]);
  }

  return (
    <SectionCard
      title="Message Templates"
      icon={MessageSquare}
      footer={
        <p className="text-xs text-slate-400">
          Used by every WhatsApp button in the ERP and by the website
          automations.{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">[Name]</code>-style
          tokens are filled automatically from the customer and order details.
        </p>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canEdit && (
          <button
            onClick={() => setCreating(!creating)}
            className="btn btn-ghost inline-flex items-center gap-2"
          >
            <Plus size={15} />
            {creating ? "Cancel" : "New template"}
          </button>
        )}
        {creating && (
          <span className="text-xs text-slate-500">
            Create an ERP template with validated tokens.
          </span>
        )}
      </div>
      {creating && (
        <div className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Template name">
              <input
                className="field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
            </L>
            <L t="Category">
              <select
                className="field"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </L>
          </div>
          <L
            t="Allowed tokens (comma separated)"
            hint="Use the exact names in square brackets in message bodies."
          >
            <input
              className="field"
              value={newVariables}
              onChange={(e) => setNewVariables(e.target.value)}
              placeholder="Name, Store, Amount"
            />
          </L>
          <L t="Staff message">
            <textarea
              className="field"
              rows={4}
              value={newStaff}
              onChange={(e) => setNewStaff(e.target.value)}
              placeholder="Hi [Name], …"
            />
          </L>
          <L t="Automation message">
            <textarea
              className="field"
              rows={3}
              value={newAuto}
              onChange={(e) => setNewAuto(e.target.value)}
              placeholder="Hello [Name], …"
            />
          </L>
          <button disabled={busy} onClick={create} className="btn btn-gold">
            {busy ? "Creating…" : "Create template"}
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
          {groups.map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {CATEGORY_LABEL[cat] ?? cat}
              </p>
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelId(t.id)}
                  className={`mb-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${selId === t.id ? "bg-navy-800 text-white" : "hover:bg-slate-50"}`}
                >
                  <span className="truncate">{t.name}</span>
                  {!t.is_active && (
                    <span
                      className={`text-[10px] ${selId === t.id ? "text-white/60" : "text-slate-400"}`}
                    >
                      off
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {!sel ? (
            <p className="text-sm text-slate-500">Select a template to edit.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <L t="Template name">
                  <input
                    className="field"
                    value={name}
                    disabled={!canEdit}
                    onChange={(e) => setName(e.target.value)}
                  />
                </L>
                <div className="flex items-end pb-1">
                  <Switch
                    on={active}
                    set={canEdit ? setActive : () => {}}
                    label="Active"
                    hint={
                      active
                        ? "Available on WhatsApp buttons"
                        : "Hidden from WhatsApp buttons"
                    }
                  />
                </div>
              </div>
              <L t="Meta template name (advanced — approved WhatsApp API template used by automations)">
                <input
                  className="field font-mono text-[13px]"
                  value={meta}
                  disabled={!canEdit}
                  onChange={(e) => setMeta(e.target.value)}
                  placeholder="e.g. power_eyes_order_ready — leave blank if none"
                />
              </L>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-600">
                  Available tokens
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(sel.variables ?? []).map((v: string) => (
                    <span
                      key={v}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      [{v}]
                    </span>
                  ))}
                  {(sel.variables ?? []).length === 0 && (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </div>
              </div>
              <L t="Warm version — sent personally by staff">
                <textarea
                  className="field font-mono text-[13px] leading-relaxed"
                  rows={9}
                  value={staff}
                  disabled={!canEdit}
                  onChange={(e) => setStaff(e.target.value)}
                />
              </L>
              <L t="Short version — automations & quick sends">
                <textarea
                  className="field font-mono text-[13px] leading-relaxed"
                  rows={5}
                  value={auto}
                  disabled={!canEdit}
                  onChange={(e) => setAuto(e.target.value)}
                />
              </L>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Preview — warm version (sample data)
                </p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {fillPreview(staff)}
                </p>
              </div>
              <L
                t="Test recipient number"
                hint="Enter a WhatsApp number with country code. This opens a prefilled draft; it does not send automatically."
              >
                <input
                  className="field"
                  inputMode="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="919840496404"
                />
              </L>
              {sampleUrl && (
                <a
                  href={sampleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost inline-flex"
                >
                  Open WhatsApp test draft
                </a>
              )}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={save}
                    className="btn btn-gold"
                  >
                    {busy ? "Saving…" : "Save template"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={archive}
                    className="btn btn-ghost inline-flex items-center gap-2"
                  >
                    {sel.is_active ? (
                      <Archive size={14} />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    {sel.is_active ? "Archive" : "Restore"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
