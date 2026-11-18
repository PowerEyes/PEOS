export type Eye = { sph: number | null; cyl: number | null; axis: number | null; add: number | null; va_dist: string; va_near: string };
export type RxValues = { od: Eye; os: Eye; pd_far: number | null; pd_near: number | null };
export const emptyEye = (): Eye => ({ sph: null, cyl: null, axis: null, add: null, va_dist: "", va_near: "" });
export const emptyRx = (): RxValues => ({ od: emptyEye(), os: emptyEye(), pd_far: null, pd_near: null });

const range = (min: number, max: number, step: number) => { const o: number[] = []; for (let n = Math.round(min / step); n <= Math.round(max / step); n++) o.push(+(n * step).toFixed(2)); return o; };
export const SPH_OPTIONS = range(-20, 20, 0.25);
export const CYL_OPTIONS = range(-8, 8, 0.25);
export const ADD_OPTIONS = range(0.25, 4, 0.25);
export const VA_DIST = ["6/6","6/9","6/12","6/18","6/24","6/36","6/60"];
export const VA_NEAR = ["N5","N6","N8","N10","N12","N18"];
export const fmt = (n: number | null | undefined) => (n == null ? "" : `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(2)}`);
const quarter = (n: number) => Math.round(n * 4) / 4;
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
    e.sph = pick("sph",r.sph,-20,20,quarter); e.cyl = pick("cyl",r.cyl,-8,8,quarter);
    e.axis = pick("axis",r.axis,0,180,Math.round); e.add = pick("add",r.add,0.25,4,quarter);
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
