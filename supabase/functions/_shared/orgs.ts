// Multi-tenant cron fan-out: a function called without ?org=<id> re-invokes itself once per organisation.
export async function fanOut(req: Request, sb: any): Promise<Response> {
  const { data: orgs } = await sb.from("organizations").select("id");
  const results: Record<string, number> = {};
  for (const o of orgs ?? []) {
    const u = new URL(req.url); u.searchParams.set("org", o.id);
    const r = await fetch(u, { method: req.method, headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` } });
    results[o.id] = r.status;
  }
  return new Response(JSON.stringify({ orgs: results }), { status: 200 });
}
