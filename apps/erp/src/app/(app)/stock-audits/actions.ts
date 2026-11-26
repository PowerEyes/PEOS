"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const branchInput = z.string().uuid();
async function context(branchId?: string) {
  const sb = supabaseServer(), { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Sign in to manage stock counts." } as const;
  const { data: ok } = await sb.rpc("has_perm", { p: "stock_audit" });
  if (!ok) return { error: "You do not have permission to manage cycle counts." } as const;
  if (branchId) { const { data: can } = await sb.rpc("can_access_branch", { b: branchId }); if (!can) return { error: "You do not have access to that branch." } as const; }
  return { sb, user } as const;
}

export async function startStockAudit(input: { branch_id: string; title: string; product_ids: string[] }): Promise<{ error?: string; id?: string }> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const p = z.object({ branch_id: branchInput, title: z.string().trim().min(2).max(120), product_ids: z.array(z.string().uuid()).min(1).max(2000) }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid count." };
  const ids = [...new Set(p.data.product_ids)];
  const c = await context(p.data.branch_id); if ("error" in c) return c;
  const { data: id, error } = await c.sb.rpc("start_stock_audit", { p_branch: p.data.branch_id, p_title: p.data.title, p_products: ids });
  if (error || !id) return { error: error?.message ?? "Could not start count." };
  revalidatePath("/stock-audits"); return { id };
}

export async function saveCountLine(id: string, counted: number): Promise<{ error?: string; ok?: boolean }> {
  const gate = await subscriptionGate(); if (gate) return gate;
  if (!z.string().uuid().safeParse(id).success || !Number.isInteger(counted) || counted < 0 || counted > 1000000) return { error: "Enter a whole counted quantity of 0 or more." };
  const c = await context(); if ("error" in c) return c;
  const { data: line, error } = await c.sb.from("stock_audit_lines").update({ counted_qty: counted, counted_by: c.user.id, counted_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
  if (error || !line) return { error: error?.message ?? "Count line is unavailable or locked." };
  revalidatePath("/stock-audits"); return { ok: true };
}

export async function submitStockAudit(id: string): Promise<{ error?: string; ok?: boolean }> {
  const gate = await subscriptionGate(); if (gate) return gate;
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid count." };
  const c = await context(); if ("error" in c) return c;
  const { data: s, error: readError } = await c.sb.from("stock_audit_sessions").select("id,status,started_by,branch_id").eq("id", id).maybeSingle();
  if (readError || !s || s.started_by !== c.user.id || s.status !== "counting") return { error: "This count is not open for submission." };
  const { data: lines } = await c.sb.from("stock_audit_lines").select("counted_qty").eq("session_id", id);
  if (!lines?.length || lines.some((l: any) => l.counted_qty == null)) return { error: "Enter a counted quantity for every product before submitting." };
  const { error } = await c.sb.from("stock_audit_sessions").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", id).eq("status", "counting");
  if (error) return { error: error.message };
  revalidatePath("/stock-audits"); return { ok: true };
}

export async function approveStockAudit(id: string): Promise<{ error?: string; ok?: boolean }> {
  const gate = await subscriptionGate(); if (gate) return gate;
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid count." };
  const c = await context(); if ("error" in c) return c;
  const { error } = await c.sb.rpc("approve_stock_audit", { p_session: id });
  if (error) return { error: error.message };
  revalidatePath("/stock-audits"); revalidatePath("/inventory"); revalidatePath("/inbox"); return { ok: true };
}
