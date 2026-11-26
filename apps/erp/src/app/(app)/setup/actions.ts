"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type R = { error?: string; ok?: string };
const KINDS = ["frame", "sunglass", "contact_lens", "accessory"], GENDERS = ["men", "women", "unisex", "kids"];
const MAX_ROWS = 500;

async function adminCtx() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;
  const { data: p } = await sb.from("profiles").select("role_key, org_id").eq("id", user.id).single();
  if (!["owner", "admin"].includes(p?.role_key ?? "") || !p?.org_id) return { error: "Only owners and admins can do this." } as const;
  return { sb, orgId: p.org_id as string };
}

export async function getSampleCatalogueCsv(): Promise<{ error?: string; csv?: string }> {
  const a = await adminCtx(); if ("error" in a) return { error: a.error };
  const { data, error } = await a.sb.from("catalogue_sample_templates").select("kind,brand,model,sku,gender,mrp,selling_price,tax_pct,cost_price").order("kind").order("sku");
  if (error) return { error: error.message };
  const cols = ["kind","brand","model","sku","gender","mrp","selling_price","tax_pct","cost_price"] as const;
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[,\"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return { csv: [cols.join(","), ...(data ?? []).map((row: any) => cols.map((col) => esc(row[col])).join(","))].join("\r\n") };
}

export async function saveSetupStep(step: number): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx(); if ("error" in a) return { error: a.error };
  if (!Number.isInteger(step) || step < 0 || step > 6) return { error: "Invalid setup step." };
  const { error } = await a.sb.from("org_settings").upsert({ org_id: a.orgId, key: "setup_wizard_step", value: step }, { onConflict: "org_id,key" });
  if (error) return { error: error.message };
  revalidatePath("/setup"); return { ok: "Setup progress saved." };
}

// Minimal RFC-4180 style parser (quotes, commas, CRLF).
function parseCsv(t: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

export async function importProducts(csv: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx(); if ("error" in a) return { error: a.error };
  if (csv.length > 400_000) return { error: "File too large. Import up to 500 rows at a time." };
  const rows = parseCsv(csv); if (rows.length < 2) return { error: "The file needs a header row and at least one product." };
  const head = rows[0].map(h => h.trim().toLowerCase()); const ix = (n: string) => head.indexOf(n);
  for (const need of ["kind", "model", "selling_price"]) if (ix(need) < 0) return { error: `Missing column: ${need}` };
  if (rows.length - 1 > MAX_ROWS) return { error: `Import up to ${MAX_ROWS} rows at a time.` };
  const errs: string[] = [], items: any[] = [], costs: (number | null)[] = [], seen = new Set<string>();
  const brandNames = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const g = (n: string) => (ix(n) >= 0 ? (r[ix(n)] ?? "").trim() : "");
    const n = i + 2, kind = g("kind").toLowerCase(), model = g("model"), sp = Number(g("selling_price"));
    const mrp = g("mrp") ? Number(g("mrp")) : sp, tax = g("tax_pct") ? Number(g("tax_pct")) : 5, cost = g("cost_price") ? Number(g("cost_price")) : null;
    const gender = (g("gender") || "unisex").toLowerCase(), sku = g("sku") || null;
    if (!KINDS.includes(kind)) return void errs.push(`Row ${n}: kind must be ${KINDS.join("/")}`);
    if (!model) return void errs.push(`Row ${n}: model is required`);
    if (!(sp >= 0) || !(mrp >= 0) || !(tax >= 0 && tax <= 40) || (cost !== null && !(cost >= 0))) return void errs.push(`Row ${n}: invalid price or tax`);
    if (!GENDERS.includes(gender)) return void errs.push(`Row ${n}: gender must be ${GENDERS.join("/")}`);
    if (sku) { if (seen.has(sku)) return void errs.push(`Row ${n}: duplicate sku ${sku}`); seen.add(sku); }
    const brand = g("brand"); if (brand) brandNames.add(brand);
    items.push({ kind, model, sku, barcode: g("barcode") || null, gender, mrp, selling_price: sp, tax_pct: tax, collection: g("collection") || null, status: "active", _brand: brand });
    costs.push(cost);
  });
  if (errs.length) return { error: errs.slice(0, 6).join("\n") + (errs.length > 6 ? `\n…and ${errs.length - 6} more` : "") };
  const brandId = new Map<string, string>();
  if (brandNames.size) {
    const { data: have } = await a.sb.from("brands").select("id,name");
    for (const b of have ?? []) brandId.set(String(b.name).toLowerCase(), b.id);
    const add = [...brandNames].filter(n => !brandId.has(n.toLowerCase())).map(name => ({ name }));
    if (add.length) { const { data: ins, error } = await a.sb.from("brands").insert(add).select("id,name"); if (error) return { error: error.message };
      for (const b of ins ?? []) brandId.set(String(b.name).toLowerCase(), b.id); }
  }
  const payload = items.map(({ _brand, ...x }) => ({ ...x, brand_id: _brand ? brandId.get(_brand.toLowerCase()) ?? null : null }));
  const { data, error } = await a.sb.from("products").insert(payload).select("id");
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "A SKU or barcode already exists. Nothing was imported." : error.message };
  const cr = (data ?? []).flatMap((p: any, i: number) => costs[i] === null ? [] : [{ product_id: p.id, cost_price: costs[i] as number }]);
  if (cr.length) await a.sb.from("product_costs").upsert(cr, { onConflict: "product_id" });
  revalidatePath("/setup"); revalidatePath("/inventory");
  return { ok: `Imported ${data?.length ?? 0} products. They are inactive on the website until you publish them.` };
}

export async function markLive(): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx(); if ("error" in a) return { error: a.error };
  const { error } = await a.sb.from("org_settings").upsert({ org_id: a.orgId, key: "go_live", value: new Date().toISOString() }, { onConflict: "org_id,key" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout"); return { ok: "You're live." };
}
