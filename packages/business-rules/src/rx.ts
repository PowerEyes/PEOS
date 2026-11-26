export type Eye = { sph: number | null; cyl: number | null; axis: number | null; add: number | null; va_dist: string; va_near: string };
export type RxValues = { od: Eye; os: Eye; pd_far: number | null; pd_near: number | null };
export const emptyEye = (): Eye => ({ sph: null, cyl: null, axis: null, add: null, va_dist: "", va_near: "" });
export const emptyRx = (): RxValues => ({ od: emptyEye(), os: emptyEye(), pd_far: null, pd_near: null });

/** Valid input range per prescription field. Single source of truth: the
 *  RxInput UI clamps to these and normalizeRx rejects anything outside them,
 *  so a value the UI accepts is never flagged on save. */
export const RX_RANGE = { sph: [-20, 20], cyl: [-8, 8], axis: [0, 180], add: [0.25, 4] } as const;
export type RxFieldKind = keyof typeof RX_RANGE;

const range = (min: number, max: number, step: number) => { const o: number[] = []; for (let n = Math.round(min / step); n <= Math.round(max / step); n++) o.push(+(n * step).toFixed(2)); return o; };
export const SPH_OPTIONS = range(-20, 20, 0.25);
export const CYL_OPTIONS = range(-8, 8, 0.25);
export const ADD_OPTIONS = range(0.25, 4, 0.25);
export const VA_DIST = ["6/6","6/9","6/12","6/18","6/24","6/36","6/60"];
export const VA_NEAR = ["N5","N6","N8","N10","N12","N18"];
export const fmt = (n: number | null | undefined) => (n == null ? "" : `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(2)}`);
/** Snap a power to the nearest 0.25 D step (exported for the RxInput UI). */
export const quarter = (n: number) => Math.round(n * 4) / 4;
export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace("\u2212", "-");
  if (["plano","pl","ds","nil","0"].includes(s)) return 0;
  const n = parseFloat(s.replace(/[^0-9+\-.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
const inRange = (n: number | null, lo: number, hi: number) => (n != null && n >= lo && n <= hi ? n : null);
export function normalizeRx(raw: any): { values: RxValues; flags: string[] } {
  const flags: string[] = [];
  const eye = (r: any, side: string): Eye => {
    const e = emptyEye(); r = r ?? {};
    const pick = (k: keyof Eye, v: number | null, lo: number, hi: number, round: (n: number) => number) => {
      const n = toNum(v); if (n == null) return null;
      const ok = inRange(round(n), lo, hi); if (ok == null) flags.push(`${side}.${k}`); return ok; };
    e.sph = pick("sph",r.sph,RX_RANGE.sph[0],RX_RANGE.sph[1],quarter); e.cyl = pick("cyl",r.cyl,RX_RANGE.cyl[0],RX_RANGE.cyl[1],quarter);
    e.axis = pick("axis",r.axis,RX_RANGE.axis[0],RX_RANGE.axis[1],Math.round); e.add = pick("add",r.add,RX_RANGE.add[0],RX_RANGE.add[1],quarter);
    const va = (s: unknown, list: string[]) => { const t = String(s ?? "").trim().toUpperCase().replace(/\s/g,""); return list.includes(t) ? t : ""; };
    e.va_dist = va(r.va_dist, VA_DIST); e.va_near = va(r.va_near, VA_NEAR);
    return e; };
  const pd = (v: unknown, k: string) => { const n = toNum(v); if (n == null) return null; const ok = inRange(n, 20, 80); if (ok == null) flags.push(k); return ok; };
  return { values: { od: eye(raw?.od ?? raw?.right,"od"), os: eye(raw?.os ?? raw?.left,"os"), pd_far: pd(raw?.pd_far ?? raw?.pd,"pd_far"), pd_near: pd(raw?.pd_near,"pd_near") }, flags };
}
export function validateRx(v: RxValues): string[] {
  const w: string[] = [];
  const any = [v.od, v.os].some((e) => e.sph != null || e.cyl != null || e.add != null);
  if (!any) w.push("Enter at least one lens value.");
  (["od","os"] as const).forEach((s) => { const e = v[s], L = s === "od" ? "Right eye" : "Left eye";
    if (e.cyl && e.axis == null) w.push(`${L}: add an axis because a cylinder is set.`);
    if (!e.cyl && e.axis) w.push(`${L}: axis is set but the cylinder is empty.`); });
  if (v.od.sph != null && v.os.sph != null && Math.abs(v.od.sph - v.os.sph) > 3)
    w.push("The two eyes differ by more than 3.00 D. Please re-check.");
  return w;
}
export function rxStatus(validTill: string | null): "active" | "expiring" | "expired" {
  if (!validTill) return "active";
  const d = (new Date(validTill).getTime() - Date.now()) / 86400000;
  return d < 0 ? "expired" : d < 30 ? "expiring" : "active";
}

// ── Ranges the database enforces, checked here so the message is ours ───────
// Every axis field in the product is a free number input (only two of the five
// writers clamp), so 90.5 and 185 both reach PostgREST. `numeric(4,2)` also
// overflows past ±99.99 — and that overflow fires while the row is being
// coerced, before any trigger can reword it.
const MAX_MAG = 99.99;   // prescriptions.{od,os}_{sph,cyl,add} → numeric(4,2)
const MAX_PD = 999.9;    // prescriptions.{pd_far,pd_near}      → numeric(4,1)

/** Axis is stored as whole degrees in 0–180; PostgREST passes `90.5` to an
 *  `int` column as text and Postgres rejects it with
 *  `invalid input syntax for type integer`. Round, then bound. */
export function fixAxis(a: number | null): number | null {
  if (a == null || !Number.isFinite(a)) return null;
  return Math.max(0, Math.min(180, Math.round(a)));
}

/** First problem with these values, or null when every one of them will be
 *  accepted. Call before building the row so the user is told what to correct. */
export function rxRangeError(v: RxValues): string | null {
  const eyes = [["Right eye (OD)", v.od], ["Left eye (OS)", v.os]] as const;
  for (const [label, e] of eyes) {
    for (const k of ["sph", "cyl", "add"] as const) {
      const n = e[k];
      if (n != null && Math.abs(n) > MAX_MAG)
        return `${label} ${k.toUpperCase()} must be between -99.99 and 99.99.`;
    }
    if (e.axis != null && (e.axis < 0 || e.axis > 180))
      return `${label} axis must be between 0 and 180.`;
  }
  for (const [label, n] of [["Distance PD", v.pd_far], ["Near PD", v.pd_near]] as const)
    if (n != null && Math.abs(n) > MAX_PD)
      return `${label} must be between -999.9 and 999.9.`;
  return null;
}
