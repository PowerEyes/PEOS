// Database-driven catalog facets: everything is derived from the rows themselves (brand, gender and every small-cardinality
// attribute in products.attrs), so a new attribute added in the ERP inventory form shows up as a filter automatically.
export type Facet = { key: string; label: string; options: { value: string; count: number }[] };
export type Sp = Record<string, string | undefined>;
const RESERVED = new Set(["min", "max", "sort", "stock", "q"]);
const SKIP_ATTR = /^(images?|image_path|notes?|description|sku|barcode|hsn|tax|weight|url)$/i;
export const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const val = (r: any, key: string) => (key === "brand" ? r.brand : key === "gender" ? r.gender : r.attrs?.[key]);
const label = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const list = (sp: Sp, k: string) => (sp[k] ?? "").split(",").map(norm).filter(Boolean);

export function buildFacets(rows: any[]): Facet[] {
  const keys = new Set<string>(["brand", "gender"]);
  rows.forEach((r) => Object.keys(r.attrs ?? {}).forEach((k) => !SKIP_ATTR.test(k) && !RESERVED.has(k) && keys.add(k)));
  const out: Facet[] = [];
  keys.forEach((k) => {
    const m = new Map<string, number>();
    rows.forEach((r) => { const v = val(r, k); if (v == null || v === "" || typeof v === "object" || typeof v === "boolean") return; const s = String(v).trim(); m.set(s, (m.get(s) ?? 0) + 1); });
    if (m.size >= 2 && m.size <= 16 || (m.size === 1 && k === "brand")) out.push({ key: k, label: k === "gender" ? "Frame for" : label(k), options: [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) });
  });
  return out;
}
export const priceBounds = (rows: any[]) => {
  const p = rows.map((r) => Number(r.selling_price)).filter((n) => n > 0);
  return p.length ? { min: Math.floor(Math.min(...p) / 100) * 100, max: Math.ceil(Math.max(...p) / 100) * 100 } : { min: 0, max: 10000 };
};
export function applyFilters(rows: any[], sp: Sp, facets: Facet[]) {
  let r = rows;
  for (const f of facets) { const want = list(sp, f.key); if (want.length) r = r.filter((x) => want.includes(norm(val(x, f.key)))); }
  if (Number(sp.min) > 0) r = r.filter((x) => Number(x.selling_price) >= Number(sp.min));
  if (Number(sp.max) > 0) r = r.filter((x) => Number(x.selling_price) <= Number(sp.max));
  if (sp.stock === "1") r = r.filter((x) => x.in_stock);
  const d = (x: any) => (x.mrp && x.mrp > x.selling_price ? (x.mrp - x.selling_price) / x.mrp : 0);
  const s = sp.sort;
  if (s === "price_asc") r = [...r].sort((a, b) => a.selling_price - b.selling_price);
  else if (s === "price_desc") r = [...r].sort((a, b) => b.selling_price - a.selling_price);
  else if (s === "discount") r = [...r].sort((a, b) => d(b) - d(a));
  else if (s === "new") r = [...r].sort((a, b) => Number(!!b.new_arrival) - Number(!!a.new_arrival));
  return r;
}
