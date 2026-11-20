"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
const num = z.number().nullable(); const bool = z.boolean();
const product = z.object({
  id: z.string().uuid().optional(), kind: z.enum(["frame", "sunglass", "contact_lens", "accessory"]),
  brand_id: z.string().uuid().nullable(), model: z.string().trim().min(1, "Enter the model name"), collection: z.string().nullable(),
  gender: z.enum(["men", "women", "unisex", "kids"]), status: z.enum(["active", "draft", "inactive"]), barcode: z.string().trim().nullable(),
  cost_price: num, mrp: num, selling_price: z.number({ invalid_type_error: "Enter the selling price", required_error: "Enter the selling price" }).min(0),
  tax_pct: z.number().min(0).max(28), power_eligible: bool, hsn: z.string().nullable(), price_mode: z.enum(["inclusive","exclusive"]), visible_on_website: bool, featured: bool, new_arrival: bool, bestseller: bool,
  short_desc: z.string().max(200).nullable(), description: z.string().max(2000).nullable(), images: z.array(z.string()).max(10), attrs: z.record(z.any()),
  on_display: z.boolean(), display_section: z.enum(["window", "counter", "wall", "shelf", "back_store"]),
  shelf_location: z.string().trim().max(120).nullable(), display_order: z.number().int().min(0).max(9999),
  opening: z.object({ branch_id: z.string().uuid(), qty: z.number().int().min(1) }).optional() });
type R = { error?: string; ok?: string; id?: string };
const fail = (m: string) =>
  /duplicate key/i.test(m) && /barcode/i.test(m) ? "That barcode is already used by another product." : dbError(m);

export async function saveProduct(input: unknown): Promise<R> {
  const p = product.safeParse(input); if (!p.success) return { error: p.error.issues[0].message };
  const { id, opening, ...row } = p.data;
  if (row.power_eligible && !["frame", "sunglass"].includes(row.kind)) return { error: "Only frames and sunglasses can take power lenses." };
  const sb = supabaseServer(); let pid = id, sku = "";
  if (id) { const { error } = await sb.from("products").update({ ...row, barcode: row.barcode || undefined }).eq("id", id); if (error) return { error: fail(error.message) }; }
  else { const { data, error } = await sb.from("products").insert(row).select("id, sku").single(); if (error) return { error: fail(error.message) }; pid = data.id; sku = data.sku;
    if (opening) { const m = await sb.from("stock_movements").insert({ branch_id: opening.branch_id, product_id: pid, delta: opening.qty, reason: "opening" }); if (m.error) return { error: fail(m.error.message) }; } }
  revalidatePath("/inventory"); return { ok: sku || "Saved", id: pid };
}
export async function adjustStock(i: { product_id: string; branch_id: string; delta: number; reason: string; note?: string }): Promise<R> {
  if (!Number.isInteger(i.delta)) return { error: "Enter a whole number, e.g. 5 or -3." };
  if (i.delta === 0) return { error: "Enter a quantity other than zero." };
  const { error } = await supabaseServer().from("stock_movements").insert(i); if (error) return { error: fail(error.message) };
  revalidatePath("/inventory"); return { ok: "Stock updated" };
}
export async function setReorder(product_id: string, branch_id: string, level: number): Promise<R> {
  const { error } = await supabaseServer().from("stock").upsert({ product_id, branch_id, reorder_level: Math.max(0, Math.floor(level)) }, { onConflict: "branch_id,product_id" });
  if (error) return { error: fail(error.message) }; revalidatePath("/inventory"); return { ok: "Saved" };
}
export async function createBrand(name: string): Promise<R> {
  const n = name.trim(); if (!n) return { error: "Enter a brand name" };
  const { data, error } = await supabaseServer().from("brands").insert({ name: n }).select("id").single();
  if (error) return { error: dbError(error.message.includes("duplicate") ? "That brand already exists." : error.message) };
  revalidatePath("/inventory"); return { ok: n, id: data.id };
}
const dispRow = z.object({
  id: z.string().uuid(), on_display: z.boolean(),
  display_section: z.enum(["window", "counter", "wall", "shelf", "back_store"]),
  shelf_location: z.string().trim().max(120).nullable(), display_order: z.number().int().min(0).max(9999) });
const dispList = z.array(dispRow).min(1).max(500);
export async function saveDisplay(input: unknown): Promise<R> {
  const p = dispList.safeParse(input); if (!p.success) return { error: p.error.issues[0].message };
  const sb = supabaseServer();
  for (const row of p.data) {
    const { error } = await sb.from("products").update(row).eq("id", row.id);
    if (error) return { error: fail(error.message) };
  }
  revalidatePath("/inventory"); return { ok: `${p.data.length} product${p.data.length > 1 ? "s" : ""} updated` };
}
const pkg = z.object({ id: z.string().uuid().optional(), code: z.string().trim().min(2, "Enter a package code"), name: z.string().trim().min(2, "Enter the package name"),
  design: z.enum(["single_vision", "progressive", "bifocal", "reading", "non_prescription"]), segment: z.string().nullable(), short_desc: z.string().max(150).nullable(),
  base_price: z.number({ invalid_type_error: "Enter the base price" }).min(0), mrp: num, tax_pct: z.number().min(0).max(28),
  features: z.array(z.string()), indexes: z.array(z.string()), coatings: z.array(z.string()), sph_min: num, sph_max: num, cyl_max: num,
  status: z.enum(["active", "draft", "inactive"]), display_order: z.number().int() });
export async function saveLensPackage(input: unknown): Promise<R> {
  const p = pkg.safeParse(input); if (!p.success) return { error: p.error.issues[0].message };
  const { id, ...row } = p.data; const sb = supabaseServer();
  const { error } = id ? await sb.from("lens_packages").update(row).eq("id", id) : await sb.from("lens_packages").insert(row);
  if (error) return { error: error.message.includes("duplicate") ? "That package code is already used." : dbError(error.message) };
  revalidatePath("/inventory"); return { ok: row.name };
}
const opt = z.object({ id: z.string().uuid().optional(), grp: z.enum(["index", "addon"]), code: z.string().trim().min(2, "Enter a code"), name: z.string().trim().min(2, "Enter a name"),
  description: z.string().max(150).nullable(), price: z.number({ invalid_type_error: "Enter the price" }).min(0), tax_pct: z.number().min(0).max(28), badge: z.string().max(20).nullable(),
  designs: z.array(z.string()), status: z.enum(["active", "draft", "inactive"]), display_order: z.number().int() });
export async function saveLensOption(input: unknown): Promise<R> {
  const p = opt.safeParse(input); if (!p.success) return { error: p.error.issues[0].message };
  const { id, ...row } = p.data; const sb = supabaseServer();
  const { error } = id ? await sb.from("lens_options").update(row).eq("id", id) : await sb.from("lens_options").insert(row);
  if (error) return { error: error.message.includes("duplicate") ? "That code is already used." : dbError(error.message) };
  revalidatePath("/inventory"); return { ok: row.name };
}
