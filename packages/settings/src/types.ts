export type SettingScope = "platform" | "org" | "branch" | "user";
export type SettingValueType = "boolean" | "number" | "string" | "enum" | "json" | "secret";
export type WriteRole = "owner" | "admin" | "manager";
export type SnapshotPolicy = "none" | "order" | "invoice" | "quote";
export type SettingSourceKind =
  | "default"
  | "org_settings"
  | "branch_settings"
  | "user_preferences"
  | "storage";

export interface SettingDefinition {
  key: string;
  legacyKey?: string | null;
  module: string;
  section: string;
  label: string;
  description?: string | null;
  scope: SettingScope;
  valueType: SettingValueType;
  defaultValue: unknown;
  jsonSchema?: Record<string, unknown>;
  allowedValues?: readonly string[] | null;
  isPublic: boolean;
  isSecret: boolean;
  requiresApproval: boolean;
  affectsTransactions: boolean;
  snapshotPolicy: SnapshotPolicy;
  writeRole?: WriteRole | null;
  writePermission?: string | null;
  revalidatePaths?: readonly string[];
  storageRef?: string | null;
  sortOrder?: number;
  version?: number;
  deprecated?: boolean;
}

export interface CatalogSettingDefinition extends SettingDefinition {
  updatedAt?: string | null;
}

export interface SettingsResolutionContext {
  orgId?: string;
  branchId?: string;
  userId?: string;
}

export interface SettingValueRow {
  key: string;
  value: unknown;
  source: Exclude<SettingSourceKind, "default">;
  storageRef?: string;
  branchId?: string;
  userId?: string;
}

export interface SettingsDataSource {
  /** Read the DB catalog. Returning [] makes the resolver use the built-in catalog. */
  listDefinitions(): Promise<CatalogSettingDefinition[]>;
  /** Read effective value rows. Each caller decides which sources it is allowed to see. */
  listValues(
    context: SettingsResolutionContext,
    allowedSources: readonly SettingSourceKind[],
  ): Promise<SettingValueRow[]>;
}

export interface SettingResolution {
  key: string;
  definition: SettingDefinition;
  rawValue: unknown;
  value: unknown;
  defaultValue: unknown;
  source: SettingSourceKind;
  isValid: boolean;
  isConfigured: boolean;
  error?: string;
}

export interface SettingsDiagnostic {
  key: string;
  message: string;
}

export interface SettingsSnapshot {
  context: SettingsResolutionContext;
  catalogLoaded: boolean;
  definitions: SettingDefinition[];
  /** Validated/fail-closed values. Never contains raw secret material. */
  values: Record<string, unknown>;
  /** Pre-validation non-secret values, used by compatibility adapters only. */
  rawValues: Record<string, unknown>;
  resolutions: Record<string, SettingResolution>;
  diagnostics: SettingsDiagnostic[];
}

export interface ModuleDefinition {
  key: string;
  label: string;
  area: "erp" | "web" | "shared";
  route?: string;
  section?: string;
  dependencies?: readonly string[];
  ownerOnly?: boolean;
  enforcementPhase: number;
}
