// Subscription lifecycle runner (plan phase 3) — trial expiry, grace windows,
// cancellation and expiry.
//
// The authoritative schedule is pg_cron calling public.run_subscription_lifecycle()
// directly (20261206000000). This function is the fallback for projects without
// pg_cron and the on-demand trigger for ops, so it simply calls the same SQL
// function rather than re-implementing the transitions.
//
// Manual invocation must present the service-role key: the transitions themselves
// are safe, but nothing should be able to poke a tenant's subscription state
// without proving it is ours.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "function is not configured" }, 500);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== serviceKey) return json({ error: "unauthorized" }, 401);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("run_subscription_lifecycle");
  if (error) {
    console.error("[subscription-lifecycle] failed:", error.message);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true, ...(data ?? {}) });
});
