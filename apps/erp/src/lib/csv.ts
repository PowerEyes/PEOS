import { logExport } from "@/app/(app)/export-actions";

export function toCSV(rows: Record<string, any>[], columns?: string[]): string {
  if (!rows.length) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const esc  = (v: any) => {
    const s = String(v ?? "").replace(/"/g,'""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

export function downloadCSV(csv: string, filename: string) {
  void logExport(filename, Math.max(csv.split("\n").length - 1, 0)); // audit trail: who exported what, when
  const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" }); // BOM for Excel
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" });
}
