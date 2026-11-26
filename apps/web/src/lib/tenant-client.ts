let p: Promise<string> | null = null;
// Browser-side: the organisation behind this storefront's domain (cached per page load).
export function getTenantOrg(): Promise<string> {
  return (p ??= fetch("/api/tenant").then((r) => (r.ok ? r.json() : Promise.reject(new Error("store"))))
    .then((j) => j.orgId as string).catch((e) => { p = null; throw e; }));
}
