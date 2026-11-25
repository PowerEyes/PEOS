// Edge-function tenant context.
// Scheduled jobs must set this for each organization before querying or logging.
// Request-driven jobs must resolve it from the authoritative business record.
// Never fall back to a fixed organization ID in a multi-tenant deployment.
export const tenant: { org: string | null } = {
  org: Deno.env.get("DEFAULT_ORG_ID")?.trim() || null,
};
