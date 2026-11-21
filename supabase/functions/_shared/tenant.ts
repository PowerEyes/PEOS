// Per-run tenant context for edge functions (jobs run sequentially, one organisation at a time).
export const tenant = { org: Deno.env.get("DEFAULT_ORG_ID") ?? "00000000-0000-0000-0000-000000000001" };
