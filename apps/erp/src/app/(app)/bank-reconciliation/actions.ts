"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };
const MAX_ROWS = 5000;
function splitCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); if (row.some(x => x.trim())) rows.push(row); row = []; cur = ""; }
    else cur += c; }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row); return rows;
}
function parseDate(s: string): string | null {
  const t = s.trim(); let m;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) return ok(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}
function ok(y: number, mo: number, d: number) { const dt = new Date(Date.UTC(y, mo - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null; }
const amt = (s: string | undefined) => { const n = Number(String(s ?? "").replace(/[₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1")); return Number.isFinite(n) ? Math.abs(n) : 0; };

export async function importStatement(csv: string, bankLabel: string): Promise<R> {
  if (!csv || csv.length > 3_000_000) return { error: "Choose a CSV file under 3 MB." };
  const rows = splitCsv(csv.replace(/^﻿/, ""));
  const hi = rows.findIndex(r => r.some(c => /date/i.test(c)) && r.some(c => /debit|withdraw|credit|deposit/i.test(c)));
  if (hi < 0) return { error: "Could not find the header row. Expect columns: Date, Description, Reference, Debit/Withdrawal, Credit/Deposit." };
  const h = rows[hi].map(c => c.trim().toLowerCase()), col = (re: RegExp) => h.findIndex(c => re.test(c));
  const [cd, cn, cr, cdb, ccr] = [col(/date/), col(/narration|description|particulars|details/), col(/ref|chq|cheque|utr/), col(/debit|withdraw/), col(/credit|deposit/)];
  if (cd < 0 || cdb < 0 || ccr < 0) return { error: "The statement needs Date, Debit and Credit columns." };
  const out: any[] = []; let skipped = 0;
  for (const r of rows.slice(hi + 1, hi + 1 + MAX_ROWS)) {
    const date = parseDate(r[cd] ?? ""), debit = amt(r[cdb]), credit = amt(r[ccr]);
    if (!date || (!debit && !credit) || (debit && credit)) { skipped++; continue; }
    out.push({ bank_label: bankLabel.trim().slice(0, 40) || "Bank", txn_date: date, description: (r[cn] ?? "").trim().slice(0, 300), reference: (r[cr] ?? "").trim().slice(0, 80), debit, credit });
  }
  if (!out.length) return { error: "No valid transactions found in that file." };
  const sb = supabaseServer();
  const { data, error } = await sb.from("bank_statement_lines").upsert(out, { onConflict: "org_id,bank_label,txn_date,reference,description,debit,credit", ignoreDuplicates: true }).select("id");
  if (error) return { error: dbError(error.message) };
  revalidatePath("/bank-reconciliation");
  const added = data?.length ?? 0;
  return { ok: `Imported ${added} new line${added === 1 ? "" : "s"}${out.length - added ? `, ${out.length - added} already imported` : ""}${skipped ? `, ${skipped} skipped` : ""}.` };
}
const near = (a: string, b: string, days = 5) => Math.abs(Date.parse(a) - Date.parse(b)) <= days * 86400000;
/** Non-cash cashbook entries with the same amount/direction near the bank date. */
export async function candidatesFor(lines: { txn_date: string; debit: number; credit: number }[]) {
  if (!lines.length) return [];
  const sb = supabaseServer();
  const dates = lines.map(l => l.txn_date).sort(), from = new Date(Date.parse(dates[0]) - 5 * 864e5).toISOString().slice(0, 10), to = new Date(Date.parse(dates[dates.length - 1]) + 5 * 864e5).toISOString().slice(0, 10);
  const [{ data: cb }, { data: used }] = await Promise.all([
    sb.from("cashbook").select("id,direction,amount,method,source,category,occurred_on").neq("method", "cash").gte("occurred_on", from).lte("occurred_on", to).limit(3000),
    sb.from("bank_statement_lines").select("matched_id").eq("status", "matched").not("matched_id", "is", null),
  ]);
  const taken = new Set((used ?? []).map((u: any) => u.matched_id));
  const free = (cb ?? []).filter((c: any) => !taken.has(c.id));
  return lines.map(l => free.filter((c: any) => c.direction === (l.credit ? "in" : "out") && Number(c.amount) === Number(l.credit || l.debit) && near(c.occurred_on, l.txn_date)));
}
export async function autoMatch(): Promise<R> {
  const sb = supabaseServer();
  const { data: lines, error } = await sb.from("bank_statement_lines").select("id,txn_date,debit,credit").eq("status", "unmatched").order("txn_date").limit(500);
  if (error) return { error: dbError(error.message) };
  const cands = await candidatesFor(lines ?? []); let n = 0; const claimed = new Set<string>();
  for (let i = 0; i < (lines ?? []).length; i++) {
    const free = cands[i].filter((c: any) => !claimed.has(c.id));
    if (free.length !== 1) continue; // only unambiguous matches are automatic
    const { error: e } = await sb.from("bank_statement_lines").update({ status: "matched", matched_kind: lines![i].credit ? "payment" : "expense", matched_id: free[0].id }).eq("id", lines![i].id).eq("status", "unmatched");
    if (!e) { claimed.add(free[0].id); n++; }
  }
  revalidatePath("/bank-reconciliation"); return { ok: n ? `Matched ${n} line${n === 1 ? "" : "s"} automatically.` : "No unambiguous matches found." };
}
export async function matchLine(id: string, cashbookId: string): Promise<R> {
  const sb = supabaseServer();
  const { data: l } = await sb.from("bank_statement_lines").select("credit").eq("id", id).maybeSingle();
  if (!l) return { error: "Line not found." };
  const { data: used } = await sb.from("bank_statement_lines").select("id").eq("matched_id", cashbookId).eq("status", "matched").limit(1);
  if (used?.length) return { error: "That entry is already matched to another bank line." };
  const { error } = await sb.from("bank_statement_lines").update({ status: "matched", matched_kind: Number(l.credit) ? "payment" : "expense", matched_id: cashbookId }).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/bank-reconciliation"); return { ok: "Matched." };
}
export async function setLine(id: string, to: "ignored" | "other" | "unmatched", note?: string): Promise<R> {
  const patch = to === "unmatched" ? { status: "unmatched", matched_kind: null, matched_id: null, note: null } : to === "ignored" ? { status: "ignored", matched_kind: null, matched_id: null, note: note?.slice(0, 200) || null } : { status: "matched", matched_kind: "other", matched_id: null, note: note?.trim().slice(0, 200) || "Reconciled manually" };
  const { error } = await supabaseServer().from("bank_statement_lines").update(patch).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/bank-reconciliation"); return { ok: "Updated." };
}
