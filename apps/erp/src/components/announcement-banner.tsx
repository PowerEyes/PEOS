"use client";
import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

const KEY = "po_announcements_dismissed";

type Item = { id: string; title: string; body: string };

/** Platform announcements aimed at this company's subscription status.
 *  Dismissal is per browser (localStorage) — the banner simply returns on a
 *  new device or after the announcement is replaced. */
export function AnnouncementBanner({ items }: { items: Item[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setHidden(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* corrupt value: show again */ }
    setReady(true);
  }, []);
  if (!ready || items.length === 0) return null;
  const visible = items.filter((a) => !hidden.includes(a.id));
  if (visible.length === 0) return null;
  const dismiss = (id: string) => {
    const next = [...hidden, id].slice(-50);
    setHidden(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };
  return (
    <div className="space-y-2 pb-3">
      {visible.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Megaphone size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{a.title}</p>
            <p className="mt-0.5 whitespace-pre-line text-amber-800">{a.body}</p>
          </div>
          <button onClick={() => dismiss(a.id)} aria-label="Dismiss announcement" className="rounded p-1 text-amber-700 hover:bg-amber-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
