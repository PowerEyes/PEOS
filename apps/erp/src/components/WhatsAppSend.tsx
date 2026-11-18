"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/wa";
import { fillTemplate, pickTemplates, useTemplates } from "./templates-context";

const PANEL_W = 344;
const PANEL_H = 470;

// Unified WhatsApp sender: pick a template (ordered by stage), warm/short variant,
// edit freely, or write a custom message — then opens wa.me with the filled text.
// The panel portals to <body> with fixed positioning so modals / overflow:hidden
// containers (cards, drawers) can never clip it.
export function WhatsAppSend({ phone, keys, vars = {}, defaultKey, label = "Send on WhatsApp", className = "btn btn-ghost w-full text-emerald-700", onSent }: {
  phone: string;
  keys: string[];
  vars?: Record<string, string>;
  defaultKey?: string;
  label?: string;
  className?: string;
  onSent?: () => void;
}) {
  const { templates, storeName } = useTemplates();
  const list = pickTemplates(templates, keys);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [key, setKey] = useState(() => list.find((t) => t.key === defaultKey)?.key ?? list[0]?.key ?? "");
  const [variant, setVariant] = useState<"staff" | "auto">("staff");
  const [text, setText] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);

  const tpl = list.find((t) => t.key === key) ?? null;

  useEffect(() => {
    if (!open) return;
    setText(tpl
      ? fillTemplate(variant === "staff" ? tpl.body_staff : tpl.body_auto, { ...vars, Store: vars.Store || storeName })
      : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, variant]);

  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      let top = r.bottom + 6;
      if (top + PANEL_H > window.innerHeight - 8) top = Math.max(8, r.top - PANEL_H - 6);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8));
      setPos({ top, left });
    }
    setOpen(true);
  }

  return (<>
    <button ref={btnRef} type="button" onClick={toggle} className={className}>
      <MessageCircle size={16} />{label}
    </button>
    {open && createPortal(
      <>
        <div className="fixed inset-0 z-[99] bg-slate-900/10" onClick={() => setOpen(false)} aria-hidden />
        <div className="fixed z-[100] space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          style={{ top: pos.top, left: pos.left, width: PANEL_W }} role="dialog" aria-label="WhatsApp message">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">WhatsApp message</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          {list.length > 0 && (
            <select value={key} onChange={(e) => setKey(e.target.value)} className="field w-full text-sm">
              {list.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              <option value="">✍️ Custom message…</option>
            </select>
          )}
          {tpl && (
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs">
              <button type="button" onClick={() => setVariant("staff")}
                className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition ${variant === "staff" ? "bg-white shadow" : "text-slate-500"}`}>
                Warm (personal)
              </button>
              <button type="button" onClick={() => setVariant("auto")}
                className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition ${variant === "auto" ? "bg-white shadow" : "text-slate-500"}`}>
                Short (quick)
              </button>
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
            className="field w-full text-sm" placeholder="Type your message…" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost flex-1 text-sm">Cancel</button>
            <button type="button" disabled={!text.trim()}
              onClick={() => { window.open(waLink(digits, text), "_blank"); setOpen(false); onSent?.(); }}
              className="btn btn-primary flex-1 text-sm">
              Open WhatsApp
            </button>
          </div>
        </div>
      </>, document.body)}
  </>);
}
