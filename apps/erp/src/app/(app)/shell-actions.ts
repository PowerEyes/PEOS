"use server";
// Everything here runs as the signed-in user (RLS applies) and is additionally gated by the same route rules as the menu,
// so a badge or search hit never reveals data from a screen the person cannot open.
import { supabaseServer } from "@/lib/supabase/server";
import { getScopeCtx } from "@/lib/branch-scope";
import { routeAllowed } from "@/lib/rbac";

export type Attention = { key: string; label: string; count: number; href: string; tone: "warn" | "bad" };
export type ShellCounts = { badges: Record<string, number>; items: Attention[]; approvals: { label: string; count: number; href: string }[] };
export type Hit = { group: string; label: string; hint?: string; href: string };

async function who() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [{ data: p }, { data: perms }] = await Promise.all([sb.from("profiles").select("role_key").eq("id", user.id).maybeSingle(), sb.rpc("my_permissions")]);
  if (!p) return null;
  const role = p.role_key as string, pm = (perms as string[]) ?? [];
  return { sb, role, can: (path: string) => routeAllowed(role, path, pm) };
}

export async function getShellCounts(): Promise<ShellCounts> {
  const w = await who(); const empty: ShellCounts = { badges: {}, items: [], approvals: [] };
  if (!w) return empty;
  const { sb, can } = w, { scope, only } = await getScopeCtx(), today = new Date().toISOString().slice(0, 10);
  const head = (t: string, f: (q: any) => any) => f(sb.from(t).select("id", { count: "exact", head: true })).then((r: any) => r.count ?? 0);
  const [transfers, audits, repairs, ready, mismatch, lowRows] = await Promise.all([
    can("/transfers/approvals") ? head("branch_transfers", (q) => q.eq("status", "requested")).then(async (n: number) => {
      if (!scope) return n; const { count } = await sb.from("branch_transfers").select("id", { count: "exact", head: true }).eq("status", "requested").eq("from_branch", scope); return count ?? 0; }) : 0,
    can("/stock-audits") ? head("stock_audit_sessions", (q) => only(q.eq("status", "submitted"))) : 0,
    can("/repairs") ? head("repairs", (q) => only(q.in("status", ["pending", "in_progress"]).lt("due_date", today))) : 0,
    can("/web-orders") ? (async () => {
      const { data: pays } = await sb.from("online_payments").select("sale_id").not("sale_id", "is", null).order("created_at", { ascending: false }).limit(200);
      const ids = [...new Set((pays ?? []).map((x: any) => x.sale_id))]; if (!ids.length) return 0;
      return head("sales", (q) => only(q.in("id", ids).eq("status", "ready"))); })() : 0,
    can("/web-orders") ? head("sales", (q) => only(q.ilike("notes", "%PAYMENT MISMATCH%"))) : 0,
    can("/inventory") ? sb.from("stock").select("branch_id,qty,reorder_level").gt("reorder_level", 0).limit(3000).then((r: any) => r.data ?? []) : [],
  ]);
  const low = (lowRows as any[]).filter((k) => k.qty <= k.reorder_level && (!scope || k.branch_id === scope)).length;
  const items: Attention[] = ([
    { key: "mismatch", label: "Online payment mismatches", count: mismatch, href: "/web-orders", tone: "bad" },
    { key: "ready", label: "Website orders ready to hand over", count: ready, href: "/web-orders", tone: "warn" },
    { key: "repairs", label: "Overdue repairs", count: repairs, href: "/repairs", tone: "bad" },
    { key: "low", label: "Items at or below reorder level", count: low, href: "/inbox", tone: "warn" },
  ] as Attention[]).filter((i) => i.count > 0);
  const approvals = [{ label: "Stock transfers to approve", count: transfers, href: "/transfers/approvals" }, { label: "Stock counts to approve", count: audits, href: "/stock-audits" }].filter((a) => a.count > 0);
  return { badges: { "web-orders": ready + mismatch, "transfer-approvals": transfers, "stock-audits": audits, repairs, inventory: low, inbox: mismatch + repairs + low }, items, approvals };
}

export async function globalSearch(raw: string): Promise<Hit[]> {
  const w = await who(); const s = raw.trim().replace(/[%,()*\\]/g, " ").slice(0, 60);
  if (!w || s.length < 2) return [];
  const { sb, can } = w, { only } = await getScopeCtx(), like = `%${s}%`;
  const run = async (ok: boolean, f: () => PromiseLike<{ data: any[] | null }>, map: (r: any) => Hit) => (ok ? ((await f()).data ?? []).map(map) : []);
  const res = await Promise.all([
    run(can("/customers"), () => sb.from("customers").select("id,full_name,phone,vision_id").or(`full_name.ilike.${like},phone.ilike.${like},vision_id.ilike.${like}`).limit(5),
      (r) => ({ group: "Customers", label: r.full_name, hint: [r.vision_id, r.phone].filter(Boolean).join(" · "), href: `/customers?open=${r.id}` })),
    run(can("/inventory"), () => sb.from("products").select("id,model,sku,barcode,brands(name)").or(`model.ilike.${like},sku.ilike.${like},barcode.ilike.${like}`).limit(5),
      (r) => ({ group: "Products", label: `${r.brands?.name ?? ""} ${r.model}`.trim(), hint: r.sku ?? r.barcode ?? "", href: `/inventory?q=${encodeURIComponent(r.sku ?? r.model)}` })),
    run(can("/prescriptions"), () => sb.from("prescriptions").select("id,rx_code,customer_id,customers(full_name)").ilike("rx_code", like).limit(4),
      (r) => ({ group: "Prescriptions", label: r.rx_code, hint: r.customers?.full_name ?? "", href: r.customer_id ? `/customers?open=${r.customer_id}` : "/prescriptions" })),
    run(can("/sales"), () => only(sb.from("sales").select("id,code,kind,grand_total,customers(full_name)").ilike("code", like).limit(5)) as any,
      (r) => ({ group: r.kind === "quotation" ? "Quotations" : "Orders & invoices", label: r.code, hint: r.customers?.full_name ?? "", href: `/sales?q=${encodeURIComponent(r.code)}` })),
    run(can("/purchase-invoices"), () => only(sb.from("purchase_invoices").select("id,invoice_no,supplier_name").or(`invoice_no.ilike.${like},supplier_name.ilike.${like}`).limit(4)) as any,
      (r) => ({ group: "Purchase invoices", label: r.invoice_no, hint: r.supplier_name ?? "", href: "/purchase-invoices" })),
    run(can("/staff"), () => sb.from("profiles").select("id,full_name,role_key").ilike("full_name", like).limit(4),
      (r) => ({ group: "Employees", label: r.full_name, hint: String(r.role_key).replace(/_/g, " "), href: "/staff" })),
  ]);
  return res.flat();
}
