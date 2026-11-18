import { supabaseServer } from "@/lib/supabase/server";
import { BarcodeSvg } from "@/components/BarcodeSvg";
import { PrintButton } from "@/components/PrintButton";
import { inr } from "@poweros/business-rules";

// Power Eyes label stock (mm) — thermal transfer printer, 300 DPI preferred.
const SIZES = {
  frame: { w: 100, h: 12 },        // frames / sunglasses: 100 × 12
  sunglass: { w: 100, h: 12 },
  accessory: { w: 50, h: 25 },     // accessories / boxes: 50 × 25
  contact_lens: { w: 40, h: 20 },  // contact lenses: 40 × 20
} as const;
type KindKey = keyof typeof SIZES;
const sizeOf = (p: any): KindKey => (p.kind in SIZES ? p.kind : "frame");

// JsBarcode's `width` is pixels per module; Code128 needs 11 modules per
// character plus 35 for start/checksum/stop — shrink the bars to fit the label.
const fit = (v: string, maxPx: number) => Math.max(0.5, Math.min(1.6, maxPx / (v.length * 11 + 35)));

function Label({ p }: { p: any }) {
  const kindKey = sizeOf(p);
  const code = String(p.barcode || p.sku || p.id);
  const sku = String(p.sku || code);
  const line = [p.brands?.name, p.model, p.attrs?.color].filter(Boolean).join(" · ");
  const cls = `lbl ${kindKey === "accessory" ? "p50" : kindKey === "contact_lens" ? "p40" : "p100"}`;
  const border = "overflow-hidden border border-slate-300 bg-white print:border-0";

  // Accessories (50 × 25) and contact lenses (40 × 20) — centred stack.
  if (kindKey === "accessory" || kindKey === "contact_lens") {
    const tight = kindKey === "contact_lens";
    return (
      <div className={`${cls} ${tight ? "h-[20mm] w-[40mm] gap-px px-1" : "h-[25mm] w-[50mm] gap-[2px] px-1.5"} flex flex-col items-center justify-center text-center leading-none ${border}`}>
        <p className="font-black tracking-[0.16em] text-navy-900" style={{ fontSize: tight ? "5.5pt" : "6pt" }}>POWER EYES</p>
        <p className="font-black text-navy-900" style={{ fontSize: tight ? "10pt" : "12pt" }}>{inr(p.selling_price)}</p>
        <p className="w-full truncate font-semibold text-slate-700" style={{ fontSize: tight ? "6pt" : "6.5pt" }}>{line}</p>
        <p className="font-bold text-navy-900" style={{ fontSize: tight ? "5pt" : "5.5pt" }}>{sku}</p>
        <BarcodeSvg value={code} height={tight ? 26 : 30} width={fit(code, tight ? 140 : 174)} fontSize={7} displayValue={false} />
      </div>);
  }
  // Frames / sunglasses (100 × 12) — slim horizontal layout.
  return (
    <div className={`${cls} h-[12mm] w-[100mm] flex items-center gap-2 px-2 py-1 leading-none ${border}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[5.5pt] font-black tracking-[0.18em] text-navy-900">POWER EYES</p>
        <p className="mt-[1.5px] text-[10pt] font-black text-navy-900">{inr(p.selling_price)}</p>
        <p className="mt-[1.5px] truncate text-[5.5pt] font-semibold text-slate-700">{line}</p>
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <BarcodeSvg value={code} height={24} width={fit(code, 190)} fontSize={7} displayValue={false} />
        <p className="mt-px text-[5pt] font-bold text-navy-900">{sku}</p>
      </div>
    </div>);
}

export default async function Labels({ searchParams }: { searchParams: { ids?: string; copies?: string } }) {
  const ids = (searchParams.ids ?? "").split(",").filter(Boolean);
  const copies = Math.min(50, Math.max(1, Number(searchParams.copies) || 1));
  const { data } = await supabaseServer().from("products")
    .select("id, kind, model, sku, barcode, selling_price, attrs, brands(name)")
    .in("id", ids);
  const labels = (data ?? []).flatMap((p: any) => Array.from({ length: copies }, (_, i) => ({ ...p, k: `${p.id}${i}` })));
  const kinds = [...new Set(labels.map((p: any) => sizeOf(p)))] as KindKey[];
  const one = kinds.length === 1 ? SIZES[kinds[0]] : null;
  const first = one ?? SIZES.frame;
  return (
    <div className="min-h-screen bg-slate-200 p-4 print:bg-white print:p-0">
      <style>{`
        @page { size: ${first.w}mm ${first.h}mm; margin: 0; }
        @page lbl100 { size: 100mm 12mm; margin: 0; }
        @page lbl50 { size: 50mm 25mm; margin: 0; }
        @page lbl40 { size: 40mm 20mm; margin: 0; }
        @media print {
          html, body { background: #fff; }
          .lbl { break-after: page; border: 0 !important; }
          .lbl:last-child { break-after: auto; }
          .p100 { page: lbl100; }
          .p50 { page: lbl50; }
          .p40 { page: lbl40; }
        }
      `}</style>
      <div className="mb-4 print:hidden">
        {labels.length > 0 && (
          <PrintButton label={`Print ${labels.length} label${labels.length === 1 ? "" : "s"}${one ? ` (${one.w} × ${one.h} mm)` : " (mixed sizes)"}`} />
        )}
      </div>
      {labels.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center text-sm text-slate-500">
          No products selected. Open a product and press <b>Label</b>, or tick <b>Select &amp; print</b> in Inventory.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 print:block">{labels.map((p: any) => <Label key={p.k} p={p} />)}</div>
      )}
    </div>);
}
