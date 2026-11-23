"use client";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { inr } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";

type Ctx = { branches_visited: number; sale_count: number; lifetime_value: number; last_sale: { branch_id: string; branch: string; at: string; amount: number } | null };
/** Shows when a customer has history at another branch. Read-only: the database lets this branch view it but not edit it. */
export function CrossBranchBanner({ customerId, branchId }: { customerId: string; branchId: string }) {
  const [c, setC] = useState<Ctx | null>(null);
  useEffect(() => { let live = true; setC(null);
    supabaseBrowser().rpc("customer_branch_context", { p_customer: customerId }).then(({ data }) => { if (live && data) setC(data as Ctx); });
    return () => { live = false; }; }, [customerId]);
  if (!c || !c.sale_count || !c.last_sale) return null;
  const other = c.last_sale.branch_id !== branchId;
  if (!other && c.branches_visited < 2) return null;
  return (<div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" role="status">
    <Store size={18} className="mt-0.5 shrink-0" />
    <p>{other ? <>Last purchase at <b>{c.last_sale.branch}</b> on {new Date(c.last_sale.at).toLocaleDateString("en-IN")} ({inr(c.last_sale.amount)}). </> : null}
      {c.sale_count} order{c.sale_count === 1 ? "" : "s"} across {c.branches_visited} branch{c.branches_visited === 1 ? "" : "es"}, lifetime {inr(c.lifetime_value)}. Other branches' records are view-only.</p></div>);
}
