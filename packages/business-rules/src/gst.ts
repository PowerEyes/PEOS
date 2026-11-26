export const DEFAULT_HSN: Record<string, string> = {
  frame: "900311", sunglass: "900410", contact_lens: "900130", accessory: "900790",
  lens_single_vision: "900150", lens_progressive: "900150", lens_bifocal: "900150",
};
export const GST_RATES: Record<string, number> = { "900311": 18, "900319": 18, "900410": 18, "900130": 5, "900140": 5, "900150": 5, "900790": 18 };
export type PriceMode = "inclusive" | "exclusive";
export type SupplyType = "intrastate" | "interstate";
export type TaxBreak = { taxableValue: number; cgstPct: number; cgstAmt: number; sgstPct: number; sgstAmt: number; igstPct: number; igstAmt: number; total: number };
export function calcTax(price: number, qty: number, discPct: number, taxPct: number, mode: PriceMode, supply: SupplyType, gstOn: boolean): TaxBreak {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (!gstOn) { const tv = r2(qty * price * (1 - discPct / 100)); return { taxableValue: tv, cgstPct: 0, cgstAmt: 0, sgstPct: 0, sgstAmt: 0, igstPct: 0, igstAmt: 0, total: tv }; }
  let tot: number, taxable: number, taxAmt: number;
  if (mode === "exclusive") { taxable = r2(qty * price * (1 - discPct / 100)); taxAmt = r2(taxable * taxPct / 100); tot = taxable + taxAmt; }
  else { tot = r2(qty * price * (1 - discPct / 100)); taxable = taxPct > 0 ? r2(tot / (1 + taxPct / 100)) : tot; taxAmt = r2(tot - taxable); }
  const half = r2(taxAmt / 2);
  return supply === "intrastate"
    ? { taxableValue: taxable, cgstPct: taxPct / 2, cgstAmt: half, sgstPct: taxPct / 2, sgstAmt: taxAmt - half, igstPct: 0, igstAmt: 0, total: tot }
    : { taxableValue: taxable, cgstPct: 0, cgstAmt: 0, sgstPct: 0, sgstAmt: 0, igstPct: taxPct, igstAmt: taxAmt, total: tot };
}
export const fmtTax = (rate: number) => rate ? `${rate}%` : "Nil";
export const intraStateLabel = (pct: number) => pct > 0 ? `CGST ${pct / 2}% + SGST ${pct / 2}%` : "Nil";
export const gstSummary = (lines: any[]) => lines.reduce((a, l) => ({
  taxable: a.taxable + Number(l.taxable_value ?? 0), cgst: a.cgst + Number(l.cgst_amt ?? 0),
  sgst: a.sgst + Number(l.sgst_amt ?? 0), igst: a.igst + Number(l.igst_amt ?? 0) }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
