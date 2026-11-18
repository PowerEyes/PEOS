export type Kind = "frame" | "sunglass" | "contact_lens" | "accessory";
export const KINDS: { key: Kind; label: string }[] = [
  { key: "frame", label: "Frames" }, { key: "sunglass", label: "Sunglasses" }, { key: "contact_lens", label: "Contact lenses" }, { key: "accessory", label: "Accessories" }];
export type FieldDef = { key: string; label: string; type: "text" | "number" | "select" | "multi"; options?: string[]; unit?: string };
const EYE: FieldDef[] = [
  { key: "shape", label: "Shape", type: "select", options: ["Round", "Square", "Rectangle", "Cat Eye", "Aviator", "Geometric", "Browline", "Oval"] },
  { key: "material", label: "Material", type: "select", options: ["Acetate", "Plastic", "Metal", "TR90", "Titanium", "Mixed"] },
  { key: "rim_type", label: "Rim type", type: "select", options: ["Full Rim", "Half Rim", "Rimless"] },
  { key: "color", label: "Frame colour", type: "text" }, { key: "finish", label: "Finish", type: "select", options: ["Glossy", "Matte", "Satin"] },
  { key: "size", label: "Size", type: "select", options: ["Small", "Medium", "Large"] }, { key: "weight_g", label: "Weight", type: "number", unit: "g" },
  { key: "lens_width", label: "Lens width", type: "number", unit: "mm" }, { key: "bridge", label: "Bridge", type: "number", unit: "mm" },
  { key: "temple", label: "Temple", type: "number", unit: "mm" }, { key: "lens_height", label: "Lens height", type: "number", unit: "mm" },
  { key: "frame_width", label: "Frame width", type: "number", unit: "mm" },
  { key: "face_shapes", label: "Suits face shapes", type: "multi", options: ["Round", "Oval", "Square", "Heart", "Oblong"] },
  { key: "max_power", label: "Max supported power", type: "number", unit: "D" }];
export const DETAIL_FIELDS: Record<Kind, FieldDef[]> = {
  frame: EYE,
  sunglass: [...EYE, { key: "lens_color", label: "Lens colour", type: "text" }, { key: "polarized", label: "Polarized", type: "select", options: ["Yes", "No"] }, { key: "uv", label: "UV protection", type: "text" }],
  contact_lens: [
    { key: "lens_type", label: "Lens type", type: "select", options: ["Daily Disposable", "Monthly", "Yearly", "Toric", "Coloured"] },
    { key: "pack_size", label: "Pack size", type: "number", unit: "lenses" }, { key: "material", label: "Material", type: "text" },
    { key: "bc", label: "Base curve", type: "number", unit: "mm" }, { key: "dia", label: "Diameter", type: "number", unit: "mm" },
    { key: "water_pct", label: "Water content", type: "number", unit: "%" }, { key: "sph_min", label: "Min power", type: "number" },
    { key: "sph_max", label: "Max power", type: "number" }, { key: "shelf_life_months", label: "Shelf life", type: "number", unit: "months" }],
  accessory: [{ key: "sub_category", label: "Type", type: "select", options: ["Cleaner", "Case", "Cloth", "Chain", "Other"] }, { key: "size", label: "Size / volume", type: "text" }],
};
/** The rule that drives product cards, lists and detail pages everywhere. */
export const ctaFor = (p: { power_eligible: boolean }) => (p.power_eligible ? "Choose Lens" : "Add to Bag");
export const stockState = (qty: number, reorder: number): "in" | "low" | "out" => (qty <= 0 ? "out" : reorder > 0 && qty <= reorder ? "low" : "in");
export const marginPct = (cost: number | null, sell: number | null) => (cost && sell ? Math.round(((sell - cost) / sell) * 100) : null);
export const discountPct = (mrp: number | null, sell: number | null) => (mrp && sell && mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : null);
export const inr = (n: number | null | undefined) => (n == null ? "" : `\u20B9${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
