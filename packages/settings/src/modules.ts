import type { ModuleDefinition } from "./types";

/**
 * Read-only in Phase 1. The same registry will later drive sidebar routes,
 * middleware, server-action guards and storefront navigation.
 */
export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  { key: "platform", label: "Platform & tenancy", area: "erp", route: "/platform", enforcementPhase: 3 },
  { key: "business", label: "Business profile", area: "erp", route: "/settings", section: "business", enforcementPhase: 2 },
  { key: "branches", label: "Branches", area: "erp", route: "/branches", section: "business", enforcementPhase: 2 },
  { key: "tax", label: "Tax & invoicing", area: "shared", route: "/settings", section: "tax", enforcementPhase: 2 },
  { key: "numbering", label: "Numbering", area: "shared", route: "/settings", section: "prefixes", enforcementPhase: 2 },
  { key: "customers", label: "Customers", area: "erp", route: "/customers", enforcementPhase: 2 },
  { key: "crm", label: "CRM automation", area: "erp", route: "/crm", section: "loyalty", enforcementPhase: 5 },
  { key: "appointments", label: "Appointments", area: "shared", route: "/appointments", enforcementPhase: 5 },
  { key: "prescriptions", label: "Prescriptions & exams", area: "shared", route: "/prescriptions", enforcementPhase: 5 },
  { key: "sales", label: "POS, quotations & orders", area: "shared", route: "/sales", enforcementPhase: 3 },
  { key: "inventory", label: "Inventory", area: "erp", route: "/inventory", enforcementPhase: 3 },
  { key: "purchases", label: "Purchases & suppliers", area: "erp", route: "/purchases", enforcementPhase: 5 },
  { key: "workshop", label: "Lab & workshop", area: "erp", route: "/workshop", enforcementPhase: 5 },
  { key: "repairs", label: "Repairs & warranty", area: "shared", route: "/repairs", enforcementPhase: 5 },
  { key: "finance", label: "Finance & GST", area: "erp", route: "/finance", enforcementPhase: 3 },
  { key: "staff", label: "Staff & permissions", area: "erp", route: "/staff", enforcementPhase: 3 },
  { key: "payroll", label: "Payroll & HR", area: "erp", route: "/payroll", enforcementPhase: 5 },
  { key: "website", label: "Website CMS", area: "shared", route: "/website", enforcementPhase: 4 },
  { key: "storefront", label: "Storefront commerce", area: "web", route: "/", enforcementPhase: 4 },
  { key: "integrations", label: "Integrations", area: "shared", route: "/settings", section: "integrations", ownerOnly: true, enforcementPhase: 5 },
  { key: "system", label: "System & reliability", area: "shared", route: "/settings", section: "history", ownerOnly: true, enforcementPhase: 5 },
];

export function findModule(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((module) => module.key === key);
}
