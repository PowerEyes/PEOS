import { BarcodeSvg } from "@/components/BarcodeSvg";
import { PrintButton } from "@/components/PrintButton";

// Tray / rack / shelf location labels — 60 × 40 mm.
// Codes arrive as LOC-<SECTION>-<SHELF>, e.g. LOC-WIN-A2, LOC-SHF-RACK-1.
const SEC: Record<string, string> = { WIN: "Window", CNT: "Counter", WAL: "Wall", SHF: "Shelf", BST: "Back store" };
const fit = (v: string, maxPx: number) => Math.max(0.5, Math.min(1.6, maxPx / (v.length * 11 + 35)));

function parse(code: string) {
  const raw = code.replace(/^LOC-/i, "");
  const i = raw.indexOf("-");
  const sec = i === -1 ? raw : raw.slice(0, i);
  const shelf = i === -1 ? "" : raw.slice(i + 1).replace(/-/g, " ");
  return { shelf, label: SEC[sec] ?? sec };
}

export default function Locations({ searchParams }: { searchParams: { codes?: string; copies?: string } }) {
  const codes = [...new Set((searchParams.codes ?? "").split(",").map((c) => c.trim()).filter(Boolean))];
  const copies = Math.min(50, Math.max(1, Number(searchParams.copies) || 1));
  const labels = codes.flatMap((code, i) => Array.from({ length: copies }, (_, j) => ({ code, k: `${i}-${j}` })));
  return (
    <div className="min-h-screen bg-slate-200 p-4 print:bg-white print:p-0">
      <style>{`@page{size:60mm 40mm;margin:0}@media print{html,body{background:#fff}.lbl{break-after:page;border:0!important}.lbl:last-child{break-after:auto}}`}</style>
      <div className="mb-4 print:hidden">
        {labels.length > 0 && <PrintButton label={`Print ${labels.length} location label${labels.length === 1 ? "" : "s"} (60 × 40 mm)`} />}
      </div>
      {labels.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center text-sm text-slate-500">
          No locations yet. Give products a shelf location in <b>Inventory → Display &amp; Shelf</b>, then print labels from there.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 print:block">{labels.map((l) => { const { shelf, label } = parse(l.code); const big = shelf || label;
          return (
            <div key={l.k} className="lbl flex h-[40mm] w-[60mm] flex-col items-center justify-center gap-1 overflow-hidden border border-slate-300 bg-white px-2 text-center leading-none print:border-0">
              <p className="text-[6pt] font-black tracking-[0.2em] text-navy-900">LOCATION</p>
              <p className="max-w-full truncate px-2 text-[16pt] font-black text-navy-900">{big}</p>
              {shelf && <p className="text-[8pt] font-bold uppercase tracking-[0.2em] text-gold-600">{label}</p>}
              <BarcodeSvg value={l.code} height={34} width={fit(l.code, 196)} fontSize={7} displayValue />
            </div>); })}</div>
      )}
    </div>);
}
