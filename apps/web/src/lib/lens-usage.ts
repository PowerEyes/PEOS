/** Choose-lens usage choices.
 *
 * The cards are editable in Website Studio (website_lens_usage). This file is
 * the shared storefront shape and a safe fallback for environments that have
 * not applied the migration yet.
 */

export type LensUsage = {
  code: string;
  label: string;
  description: string;
  icon: string;
  requires_rx: boolean;
  requires_add: boolean;
  default_design: string | null;
  display_order: number;
  is_active: boolean;
  ai: boolean;
};

export const FALLBACK_LENS_USAGE: LensUsage[] = [
  {
    code: "recommend",
    label: "Not sure? We'll recommend one",
    description: "Enter your Rx and we'll match it.",
    icon: "✨",
    requires_rx: true,
    requires_add: false,
    default_design: null,
    display_order: 1,
    is_active: true,
    ai: true,
  },
  {
    code: "single",
    label: "Single Vision",
    description: "Corrects for one distance (near or far). No ADD power needed.",
    icon: "👓",
    requires_rx: true,
    requires_add: false,
    default_design: "single_vision",
    display_order: 2,
    is_active: true,
    ai: false,
  },
  {
    code: "progressive",
    label: "Progressives (No Line)",
    description: "Seamless vision across all distances. ADD power required.",
    icon: "🔭",
    requires_rx: true,
    requires_add: true,
    default_design: "progressive",
    display_order: 3,
    is_active: true,
    ai: false,
  },
  {
    code: "reading",
    label: "Readers",
    description: "Near vision for close-up tasks. ADD power required.",
    icon: "📖",
    requires_rx: true,
    requires_add: true,
    default_design: "reading",
    display_order: 4,
    is_active: true,
    ai: false,
  },
  {
    code: "bifocal",
    label: "Bifocal (Visible Line)",
    description: "Near and distance with a visible line. ADD power required.",
    icon: "◑",
    requires_rx: true,
    requires_add: true,
    default_design: "bifocal",
    display_order: 5,
    is_active: true,
    ai: false,
  },
  {
    code: "non_rx",
    label: "Non-prescription",
    description: "Style and protection. No prescription needed.",
    icon: "🕶️",
    requires_rx: false,
    requires_add: false,
    default_design: "non_prescription",
    display_order: 6,
    is_active: true,
    ai: false,
  },
];

const ADD_REQUIRED_CODES = new Set(["progressive", "reading", "bifocal"]);

export function mapLensUsage(row: any): LensUsage | null {
  const code = String(row?.code ?? row?.key ?? "").trim();
  if (!code) return null;
  const requiresAdd = row?.requires_add == null ? ADD_REQUIRED_CODES.has(code) : Boolean(row.requires_add);
  return {
    code,
    label: String(row?.label ?? row?.title ?? code),
    description: String(row?.description ?? row?.subtitle ?? ""),
    icon: String(row?.icon ?? "👓"),
    requires_rx: row?.requires_rx == null ? code !== "non_rx" : Boolean(row.requires_rx),
    requires_add: requiresAdd,
    default_design: row?.default_design ? String(row.default_design) : null,
    display_order: Number(row?.display_order ?? 0),
    is_active: row?.is_active == null ? true : Boolean(row.is_active),
    ai: row?.ai == null ? code === "recommend" : Boolean(row.ai),
  };
}

export function usageByCode(usage: LensUsage[], code: string | null | undefined): LensUsage | undefined {
  if (!code) return undefined;
  return usage.find((u) => u.code === code);
}

/** ADD is shown (but optional) for "recommend" and hidden for single/non-Rx. */
export function shouldShowAdd(usage: LensUsage | null | undefined): boolean {
  if (!usage) return false;
  return usage.requires_add || usage.code === "recommend";
}
