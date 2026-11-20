"use client";
import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RX_RANGE, fmt, quarter, type RxFieldKind } from "@poweros/business-rules";

/**
 * Smart prescription-power input (SPH / CYL / AXIS / ADD) — typing first,
 * dropdowns gone. Shared by the ERP and (later) the website.
 *
 * UX:
 *  • type anything ("1.25", "-1.2", "plano") — snaps to 0.25 D on commit,
 *    formats to "+1.25 / -1.25" (axis: integer 0–180)
 *  • ▲▼ steppers on every field (±0.25, axis ±1) — no keyboard needed
 *  • sign-flip button on the label row for SPH/CYL (values are usually minus)
 *  • ↑/↓ = ±0.25, Shift+↑/↓ = ±1.00 (axis ±1 / ±5), Enter = leave field
 *  • select-all on focus, so typing replaces the old value instantly
 *  • OCR gold highlight + rose warn border variants
 *
 * Ranges come from RX_RANGE in @poweros/business-rules — the same constants
 * normalizeRx uses — so anything the UI accepts is never rejected on save.
 */
export type RxInputProps = {
  kind: RxFieldKind;
  label?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** OCR-confirmed value: gold border/background, kept through focus. */
  highlight?: boolean;
  /** Live cross-field problem (e.g. cylinder without axis): rose border. */
  warn?: boolean;
};

const CFG: Record<RxFieldKind, { step: number; big: number; signed: boolean }> = {
  sph: { step: 0.25, big: 1, signed: true },
  cyl: { step: 0.25, big: 1, signed: true },
  axis: { step: 1, big: 5, signed: false },
  add: { step: 0.25, big: 1, signed: false },
};

/** What the box shows when not being typed into. */
export const fmtVal = (kind: RxFieldKind, n: number | null) =>
  n == null ? "" : kind === "axis" ? String(Math.round(n)) : fmt(n);

export const snap = (kind: RxFieldKind, n: number): number => {
  const [lo, hi] = RX_RANGE[kind];
  const v = kind === "axis" ? Math.round(n) : quarter(n);
  return Math.min(hi, Math.max(lo, v));
};

const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/** Lenient parse of the box: null = empty / incomplete / none. */
export const parse = (kind: RxFieldKind, s: string): number | null => {
  const t = s.trim();
  if (!t || t === "-" || t === "+") return null;
  if (kind !== "axis" && /^(plano|pl|ds|nil)$/i.test(t)) return kind === "add" ? null : 0;
  if (kind === "axis") return /^\d+$/.test(t) ? +t : null;
  if (!NUM_RE.test(t)) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  if (kind === "add" && n <= 0) return null; // 0 / negative ADD = none
  return n;
};

/** Keep only characters a power can contain (blocks pasted garbage). */
export const clean = (kind: RxFieldKind, s: string) => {
  const t = s.replace(/\u2212/g, "-").replace(kind === "axis" ? /[^\d]/g : /[^\d.+-]/g, "");
  return t.slice(0, 8);
};

/**
 * Decide what a box string commits: a number (already snapped), null (clear),
 * or undefined (keep the previous value — incomplete like "-" or garbage).
 * Used identically by the live onChange and the final onBlur commit.
 */
export const resolveRaw = (kind: RxFieldKind, s: string): number | null | undefined => {
  const t = s.trim();
  if (t === "") return null;
  const n = parse(kind, t);
  if (n != null) return snap(kind, n);
  if (NUM_RE.test(t)) return null; // e.g. "0" typed into ADD = none
  return undefined;
};

export function RxInput({ kind, label, value, onChange, highlight, warn }: RxInputProps) {
  const c = CFG[kind];
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  /** Live commit: snap as they type so the preview line always shows a legal Rx. */
  const commit = (s: string) => {
    const r = resolveRaw(kind, s);
    if (r !== undefined) onChange(r);
  };

  const handleRaw = (s: string) => {
    setRaw(s);
    commit(s);
  };

  const stepBy = (delta: number) => {
    if (kind === "add" && value == null && delta < 0) return; // nothing to take away
    const next = snap(kind, (value ?? 0) + delta);
    setRaw(fmtVal(kind, next));
    onChange(next);
  };

  const flip = () => {
    if (value == null || value === 0) return;
    const next = -value;
    setRaw(fmtVal(kind, next));
    onChange(next);
  };

  const display = focused && raw != null ? raw : fmtVal(kind, value);

  const inputCls = [
    "w-full rounded-xl border px-3 py-2 pr-8 text-sm outline-none transition focus:ring-2",
    highlight
      ? "border-gold-400 bg-amber-50 ring-2 ring-gold-400/40 focus:border-gold-400 focus:ring-gold-400/40"
      : warn
        ? "border-rose-300 bg-white focus:border-rose-400 focus:ring-rose-100"
        : "border-slate-200 bg-white focus:border-navy-700 focus:ring-navy-700/10",
  ].join(" ");

  return (
    <label className="block">
      {(label || c.signed) && (
        <span className="mb-1 flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium text-slate-500">{label}</span>
          {c.signed && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={label ? `Flip ${label} sign` : "Flip sign"}
              onMouseDown={(e) => e.preventDefault()} // keep focus in the input
              onClick={flip}
              className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs font-semibold leading-none text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-navy-700 active:scale-95 transition"
            >
              {value == null || value === 0 ? "±" : value < 0 ? "-" : "+"}
            </button>
          )}
        </span>
      )}
      <span className="relative block">
        <input
          ref={ref}
          value={display}
          inputMode={kind === "axis" ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          aria-label={label ?? kind}
          className={inputCls}
          onFocus={() => {
            setFocused(true);
            setRaw(null);
            requestAnimationFrame(() => ref.current?.select()); // type-over
          }}
          onChange={(e) => handleRaw(clean(kind, e.target.value))}
          onBlur={() => {
            setFocused(false);
            if (raw != null) commit(raw);
            setRaw(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              stepBy((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? c.big : c.step));
            } else if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-1 flex w-6 flex-col items-center justify-center gap-0.5">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label ?? kind}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => stepBy(c.step)}
            className="pointer-events-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-700 active:scale-90 transition"
          >
            <ChevronUp size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label ?? kind}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => stepBy(-c.step)}
            className="pointer-events-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-700 active:scale-90 transition"
          >
            <ChevronDown size={12} strokeWidth={2.5} />
          </button>
        </span>
      </span>
    </label>
  );
}
