"use client";
import { useMemo, useState } from "react";
type P = { id: string; code: string; name: string; design: string | null; tier: string | null; status: string; base_price: number; min_sph: number | null; max_sph: number | null; min_cyl: number | null; max_cyl: number | null; min_add: number | null; max_add: number | null; available_indexes: any; included_coatings: any; min_age: number | null; max_age: number | null };
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const inRange = (v: number | null, lo: number | null, hi: number | null) => v === null || ((lo === null || v >= lo) && (hi === null || v <= hi));
export function LensPowerSearch({ packages }: { packages: P[] }) {
  const [f, setF] = useState({ sph: "", cyl: "", add: "", age: "" });
  const hits = useMemo(() => {
    const sph = num(f.sph), cyl = num(f.cyl), add = num(f.add), age = num(f.age);
    // cylinder is stored as a magnitude range; compare on |cyl|. ADD only matters for multifocal designs (a package with an ADD range).
    return packages.filter((p) => p.status === "active" && inRange(sph, p.min_sph, p.max_sph) && inRange(cyl === null ? null : Math.abs(cyl), p.min_cyl !== null ? Math.abs(p.min_cyl) : null, p.max_cyl !== null ? Math.abs(p.max_cyl) : null)
      && (add === null || (p.min_add === null && p.max_add === null) || inRange(add, p.min_add, p.max_add)) && (age === null || inRange(age, p.min_age, p.max_age)));
  }, [f, packages]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const fi = (k: keyof typeof f, label: string, step = "0.25") => <label className="text-xs font-medium text-slate-600">{label}<input type="number" step={step} value={f[k]} onChange={set(k)} className="field mt-1 w-full" /></label>;
  return (<>
    <div className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">{fi("sph", "Sphere (SPH)")}{fi("cyl", "Cylinder (CYL)")}{fi("add", "Near add (ADD)")}{fi("age", "Customer age", "1")}</div>
    <p className="text-sm text-slate-500">{hits.length} of {packages.filter((p) => p.status === "active").length} active packages match.</p>
    <div className="grid gap-3 sm:grid-cols-2">{hits.map((p) => (<div key={p.id} className="card space-y-1 p-3 text-sm"><div className="flex justify-between"><b>{p.name}</b><span>₹{Math.round(Number(p.base_price)).toLocaleString("en-IN")}</span></div>
      <p className="text-xs text-slate-500">{[p.code, p.design, p.tier].filter(Boolean).join(" · ")}</p>
      <p className="text-xs text-slate-500">SPH {p.min_sph ?? "–"} to {p.max_sph ?? "–"} · CYL up to {p.max_cyl ?? "–"}{p.max_add !== null ? ` · ADD ${p.min_add ?? 0} to ${p.max_add}` : ""}</p></div>))}</div>
    {!hits.length && <p className="card p-6 text-center text-sm text-slate-400">No active package covers this prescription.</p>}
  </>);
}
