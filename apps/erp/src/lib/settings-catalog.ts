import {
  BUILTIN_SETTING_DEFINITIONS,
  canonicalSettingKey,
  resolveSettings,
  type CatalogSettingDefinition,
  type SettingSourceKind,
  type SettingValueRow,
  type SettingsDataSource,
  type SettingsResolutionContext,
  type SettingsSnapshot,
} from "@poweros/settings";
import { getScopeCtx } from "./branch-scope";
import { supabaseServer } from "./supabase/server";

export type LegacyAppSettings = {
  gst: boolean;
  gstin: string;
  maxDiscount: number;
  quoteDays: number;
  labDays: number;
  invoiceFooter: string;
  defaultSupplyType: "intrastate" | "interstate";
  defaultStateOfSupply: string;
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
  codePrefixes: Record<string, string>;
};

export const DEFAULT_APP_SETTINGS: LegacyAppSettings = {
  gst: true,
  gstin: "",
  maxDiscount: 10,
  quoteDays: 14,
  labDays: 5,
  invoiceFooter: "",
  defaultSupplyType: "intrastate",
  defaultStateOfSupply: "Tamil Nadu",
  whatsappNumber: "",
  instagram: "",
  analyticsId: "",
  codePrefixes: {},
};

function catalogDefinition(row: any): CatalogSettingDefinition {
  return {
    key: row.key,
    legacyKey: row.legacy_key ?? null,
    module: row.module,
    section: row.section,
    label: row.label,
    description: row.description ?? null,
    scope: row.scope,
    valueType: row.value_type,
    defaultValue: row.default_value,
    jsonSchema: row.json_schema ?? undefined,
    allowedValues: Array.isArray(row.allowed_values) ? row.allowed_values : null,
    isPublic: Boolean(row.is_public),
    isSecret: Boolean(row.is_secret),
    requiresApproval: Boolean(row.requires_approval),
    affectsTransactions: Boolean(row.affects_transactions),
    snapshotPolicy: row.snapshot_policy ?? "none",
    writeRole: row.write_role ?? null,
    writePermission: row.write_permission ?? null,
    revalidatePaths: row.revalidate_paths ?? [],
    storageRef: row.storage_ref ?? null,
    sortOrder: row.sort_order ?? 0,
    version: row.version ?? 1,
    deprecated: Boolean(row.deprecated),
    updatedAt: row.updated_at ?? null,
  };
}

function addStorageRows(
  rows: SettingValueRow[],
  table: "organizations" | "branches" | "crm_settings" | "loyalty_rules",
  record: Record<string, unknown> | null | undefined,
  branchId?: string,
): void {
  if (!record) return;
  const prefix = `${table}.`;
  for (const definition of BUILTIN_SETTING_DEFINITIONS) {
    const storageRef = definition.storageRef;
    if (!storageRef || !storageRef.startsWith(prefix)) continue;
    const column = storageRef.slice(prefix.length);
    if (!(column in record)) continue;
    rows.push({
      key: definition.key,
      value: record[column],
      source: "storage",
      storageRef,
      branchId,
    });
  }
}

/** ERP implementation of the settings data-source contract. */
export function erpSettingsSource(client?: any): SettingsDataSource {
  const sb = client ?? supabaseServer();
  return {
    async listDefinitions() {
      const { data, error } = await sb
        .from("setting_definitions")
        .select(
          "key,legacy_key,module,section,label,description,scope,value_type,default_value,json_schema,allowed_values,is_public,is_secret,requires_approval,affects_transactions,snapshot_policy,write_role,write_permission,revalidate_paths,storage_ref,sort_order,version,deprecated,updated_at",
        );
      if (error || !data) return [];
      return data.map(catalogDefinition);
    },

    async listValues(context, allowedSources) {
      const rows: SettingValueRow[] = [];
      const orgId = context.orgId;
      if (!orgId) return rows;

      const tasks: Promise<void>[] = [];

      if (allowedSources.includes("org_settings")) {
        tasks.push(
          (async () => {
            const { data } = await sb.from("org_settings").select("key,value").eq("org_id", orgId);
            for (const row of data ?? []) {
              rows.push({
                key: canonicalSettingKey(String(row.key)),
                value: row.value,
                source: "org_settings",
              });
            }
          })(),
        );
      }

      if (allowedSources.includes("branch_settings") && context.branchId) {
        tasks.push(
          (async () => {
            const { data } = await sb
              .from("branch_settings")
              .select("key,value,branch_id")
              .eq("org_id", orgId)
              .eq("branch_id", context.branchId);
            for (const row of data ?? []) {
              rows.push({
                key: canonicalSettingKey(String(row.key)),
                value: row.value,
                source: "branch_settings",
                branchId: row.branch_id ?? context.branchId,
              });
            }
          })(),
        );
      }

      if (allowedSources.includes("user_preferences") && context.userId) {
        tasks.push(
          (async () => {
            const { data } = await sb
              .from("user_preferences")
              .select("key,value")
              .eq("org_id", orgId)
              .eq("user_id", context.userId);
            for (const row of data ?? []) {
              rows.push({
                key: canonicalSettingKey(String(row.key)),
                value: row.value,
                source: "user_preferences",
                userId: context.userId,
              });
            }
          })(),
        );
      }

      if (allowedSources.includes("storage")) {
        tasks.push(
          (async () => {
            const { data: org } = await sb
              .from("organizations")
              .select("*")
              .eq("id", orgId)
              .limit(1)
              .maybeSingle();
            addStorageRows(rows, "organizations", org as Record<string, unknown> | null);
          })(),
        );
        tasks.push(
          (async () => {
            const { data: crm } = await sb
              .from("crm_settings")
              .select("*")
              .eq("org_id", orgId)
              .limit(1)
              .maybeSingle();
            addStorageRows(rows, "crm_settings", crm as Record<string, unknown> | null);
          })(),
        );
        tasks.push(
          (async () => {
            const { data: loyalty } = await sb
              .from("loyalty_rules")
              .select("*")
              .eq("org_id", orgId)
              .limit(1)
              .maybeSingle();
            addStorageRows(rows, "loyalty_rules", loyalty as Record<string, unknown> | null);
          })(),
        );
        if (context.branchId) {
          tasks.push(
            (async () => {
              const { data: branch } = await sb
                .from("branches")
                .select("*")
                .eq("org_id", orgId)
                .eq("id", context.branchId)
                .maybeSingle();
              addStorageRows(rows, "branches", branch as Record<string, unknown> | null, context.branchId);
            })(),
          );
        }
      }

      // A missing Phase 1 table must not break the existing settings screen.
      await Promise.all(tasks.map((task) => task.catch(() => undefined)));
      return rows;
    },
  };
}

export async function getSettingsContext(): Promise<SettingsResolutionContext> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return {};

  const { data: profile } = await sb
    .from("profiles")
    .select("org_id,branch_id")
    .eq("id", user.id)
    .maybeSingle();
  const { scope } = await getScopeCtx();

  return {
    orgId: profile?.org_id ?? undefined,
    branchId: scope ?? profile?.branch_id ?? undefined,
    userId: user.id,
  };
}

export async function getSettingsSnapshot(input?: {
  allowedSources?: readonly SettingSourceKind[];
  context?: Partial<SettingsResolutionContext>;
  client?: any;
}): Promise<SettingsSnapshot> {
  const derived = input?.client ? {} : await getSettingsContext();
  const context: SettingsResolutionContext = { ...derived, ...input?.context };
  return resolveSettings({
    ...context,
    source: erpSettingsSource(input?.client),
    allowedSources: input?.allowedSources,
  });
}

const num = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return value === null || value === undefined || value === "" || Number.isNaN(parsed)
    ? fallback
    : parsed;
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * Phase 2 uses the resolver's validated values while preserving the legacy
 * AppSettings shape and coercions (notably WhatsApp digit stripping).
 */
export function legacyAppSettingsFrom(snapshot: SettingsSnapshot): LegacyAppSettings {
  const value = (key: string) => snapshot.values[key];
  return {
    gst: value("tax.gst_enabled") === true,
    gstin: str(value("tax.gstin")),
    maxDiscount: num(value("sales.max_discount_pct"), 10),
    quoteDays: num(value("sales.quote_valid_days"), 14),
    labDays: num(value("lab.lead_days"), 5),
    invoiceFooter: str(value("tax.invoice_footer")),
    defaultSupplyType: value("tax.default_supply_type") === "interstate" ? "interstate" : "intrastate",
    defaultStateOfSupply: str(value("tax.default_state_of_supply")) || "Tamil Nadu",
    whatsappNumber: str(value("website.whatsapp_number")).replace(/\D/g, ""),
    instagram: str(value("website.instagram")),
    analyticsId: str(value("website.analytics_id")),
    codePrefixes:
      value("numbering.code_prefixes") &&
      typeof value("numbering.code_prefixes") === "object" &&
      !Array.isArray(value("numbering.code_prefixes"))
        ? ({ ...(value("numbering.code_prefixes") as Record<string, string>) } as Record<string, string>)
        : {},
  };
}
