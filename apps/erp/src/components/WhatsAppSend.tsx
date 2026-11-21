"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/wa";
import { getDocLink, logDocSend } from "@/app/(app)/doc-link-actions";
import type { DocType } from "@/lib/doclinks";
import { fillTemplate, pickTemplates, useTemplates } from "./templates-context";

const PANEL_W = 344;
const PANEL_H = 520;
// Templates that are conversational and never carry a document.
const NO_DOC = new Set(["welcome", "welcome_back", "referral", "internal_followup", "order_cancelled"]);
type Link = { url: string; linkId: string; label: string; expiresAt: string; lastSentAt: string | null; sendCount: number };

// Unified WhatsApp sender: pick a template (ordered by stage), warm/short variant,
// edit freely, or write a custom message — then opens wa.me with the filled text.
// The panel portals to <body> with fixed positioning so modals / overflow:hidden
// containers (cards, drawers) can never clip it.
export function WhatsAppSend({ phone, keys, vars = {}, defaultKey, label = "Send on WhatsApp", className = "btn btn-ghost w-full text-emerald-700", onSent, doc }: {
  phone: string;
  keys: string[];
  vars?: Record<string, string>;
  defaultKey?: string;
  label?: string;
  className?: string;
  onSent?: () => void;
  // Record whose secure PDF link is generated server-side and added to the message.
  doc?: { type: DocType; id: string };
}) {
  const { templates, storeName } = useTemplates();
  const list = pickTemplates(templates, keys);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [key, setKey] = useState(() => list.find((t) => t.key === defaultKey)?.key ?? list[0]?.key ?? "");
  const [variant, setVariant] = useState<"staff" | "auto">("staff");
  const [text, setText] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [linkErr, setLinkErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipDoc, setSkipDoc] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wantsDoc = !!doc && !NO_DOC.has(key) && !skipDoc;

  useEffect(() => {
    if (!open || !doc) return;
    let live = true; setLoading(true); setLinkErr("");
    getDocLink(doc.type, doc.id).then((r) => {
      if (!live) return;
      if (r.ok) setLink(r); else { setLink(null); setLinkErr(r.error); }
    }).catch(() => live && setLinkErr("Could not reach the server")).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [open, doc?.type, doc?.id, attempt]);

  const tpl = list.find((t) => t.key === key) ?? null;

  useEffect(() => {
    if (!open) return;
    const url = wantsDoc ? link?.url : undefined;
    let t = tpl
      ? fillTemplate(variant === "staff" ? tpl.body_staff : tpl.body_auto, { ...vars, Store: vars.Store || storeName, ...(url ? { Link: url } : {}) })
      : "";
    // Templates without a [Link] placeholder keep their wording; the document link is appended.
    if (url && !t.includes(url)) t = `${t}${t ? "\n\n" : ""}📄 ${link!.label}: ${url}`;
    setText(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, variant, link?.url, wantsDoc]);

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
          {doc && !NO_DOC.has(key) && (
            <div className="space-y-1 text-xs">
              {loading && <p className="text-slate-500">📄 Preparing secure document link…</p>}
              {!loading && link && !skipDoc && <p className="text-emerald-700">📄 {link.label} PDF link added · valid till {new Date(link.expiresAt).toLocaleDateString("en-IN")} · <a className="underline" target="_blank" rel="noreferrer" href={`/api/doc-pdf?type=${doc!.type}&id=${doc!.id}`}>Preview PDF</a></p>}
              {!loading && link && !skipDoc && link.lastSentAt && (
                <p className="rounded bg-amber-50 px-2 py-1 text-amber-700">Already sent {link.sendCount}× — last {new Date(link.lastSentAt).toLocaleString("en-IN")}. Send again only if needed.</p>)}
              {linkErr && !skipDoc && (
                <p className="rounded bg-rose-50 px-2 py-1 text-rose-700">{linkErr}{" "}
                  <button type="button" className="font-semibold underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button>{" · "}
                  <button type="button" className="underline" onClick={() => setSkipDoc(true)}>Send without document</button></p>)}
              {skipDoc && <p className="text-slate-500">Sending without a document link. <button type="button" className="underline" onClick={() => setSkipDoc(false)}>Add it</button></p>}
            </div>)}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
            className="field w-full text-sm" placeholder="Type your message…" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost flex-1 text-sm">Cancel</button>
            <button type="button" disabled={!text.trim() || (wantsDoc && (loading || !link))}
              onClick={() => { window.open(waLink(digits, text), "_blank"); if (wantsDoc && link && text.includes(link.url)) void logDocSend(link.linkId, key, digits); setOpen(false); onSent?.(); }}
              className="btn btn-primary flex-1 text-sm">
              Open WhatsApp
            </button>
          </div>
        </div>
      </>, document.body)}
  </>);
}
