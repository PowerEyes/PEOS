import { canonicalSettingKey, moduleSettingKey } from "./keys";
import { BUILTIN_SETTING_DEFINITIONS } from "./defaults";
import { SettingError } from "./errors";
import { validateSettingValue } from "./schemas";
import type {
  CatalogSettingDefinition,
  SettingDefinition,
  SettingSourceKind,
  SettingValueRow,
  SettingsDataSource,
  SettingResolution,
  SettingsDiagnostic,
  SettingsResolutionContext,
  SettingsSnapshot,
} from "./types";

export const ALL_SETTING_SOURCES: readonly SettingSourceKind[] = [
  "org_settings",
  "branch_settings",
  "user_preferences",
  "storage",
];

export interface ResolveSettingsInput extends SettingsResolutionContext {
  source: SettingsDataSource;
  allowedSources?: readonly SettingSourceKind[];
}

function catalogRowToDefinition(row: CatalogSettingDefinition): SettingDefinition {
  const definition: SettingDefinition = { ...row };
  return definition;
}

function sourceRank(
  row: SettingValueRow,
  context: SettingsResolutionContext,
): number {
  switch (row.source) {
    case "user_preferences":
      return context.userId && row.userId === context.userId ? 5 : -1;
    case "branch_settings":
      return context.branchId && row.branchId === context.branchId ? 4 : -1;
    case "storage":
      if (row.branchId) {
        return context.branchId && row.branchId === context.branchId ? 3 : -1;
      }
      return 2;
    case "org_settings":
      return 1;
    default:
      return -1;
  }
}

/**
 * Builds one fail-closed snapshot. `rawValues` is retained only so the ERP can
 * keep its legacy, permissive coercion during Phase 1; secrets are never copied
 * into it.
 */
export async function resolveSettings(input: ResolveSettingsInput): Promise<SettingsSnapshot> {
  const allowedSources = input.allowedSources ?? ALL_SETTING_SOURCES;
  const context: SettingsResolutionContext = {
    orgId: input.orgId,
    branchId: input.branchId,
    userId: input.userId,
  };

  const [catalogRows, valueRows] = await Promise.all([
    input.source.listDefinitions().catch((): CatalogSettingDefinition[] => []),
    input.source.listValues(context, allowedSources).catch((): SettingValueRow[] => []),
  ]);

  const definitions = new Map<string, SettingDefinition>();
  for (const definition of BUILTIN_SETTING_DEFINITIONS) {
    definitions.set(definition.key, definition);
  }
  for (const row of catalogRows) {
    definitions.set(row.key, catalogRowToDefinition(row));
  }

  const rowsByKey = new Map<string, SettingValueRow[]>();
  for (const row of valueRows) {
    const key = canonicalSettingKey(row.key);
    const list = rowsByKey.get(key) ?? [];
    list.push(row);
    rowsByKey.set(key, list);
  }

  const values: Record<string, unknown> = {};
  const rawValues: Record<string, unknown> = {};
  const resolutions: Record<string, SettingResolution> = {};
  const diagnostics: SettingsDiagnostic[] = [];

  for (const [key, definition] of definitions) {
    let selected: SettingValueRow | undefined;
    let bestRank = -1;
    for (const row of rowsByKey.get(key) ?? []) {
      if (!allowedSources.includes(row.source)) continue;
      const rank = sourceRank(row, context);
      if (rank > bestRank) {
        bestRank = rank;
        selected = row;
      }
    }

    const rawValue = selected ? selected.value : definition.defaultValue;
    const validation = validateSettingValue(definition, rawValue);
    const source = selected?.source ?? "default";

    if (definition.isSecret) {
      const isConfigured = Boolean(selected) && rawValue !== "" && rawValue !== null;
      values[key] = undefined;
      resolutions[key] = {
        key,
        definition,
        rawValue: "[redacted]",
        value: isConfigured ? "[configured]" : "[not configured]",
        defaultValue: "[redacted]",
        source,
        isValid: true,
        isConfigured,
      };
      continue;
    }

    rawValues[key] = rawValue;
    if (validation.ok) {
      const value = validation.value;
      values[key] = value;
      resolutions[key] = {
        key,
        definition,
        rawValue,
        value,
        defaultValue: definition.defaultValue,
        source,
        isValid: true,
        isConfigured: Boolean(selected),
      };
    } else {
      values[key] = definition.defaultValue;
      resolutions[key] = {
        key,
        definition,
        rawValue,
        value: definition.defaultValue,
        defaultValue: definition.defaultValue,
        source,
        isValid: false,
        isConfigured: Boolean(selected),
        error: validation.error,
      };
      diagnostics.push({ key, message: validation.error ?? "invalid value" });
    }
  }

  return {
    context,
    catalogLoaded: catalogRows.length > 0,
    definitions: [...definitions.values()].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.key.localeCompare(b.key),
    ),
    values,
    rawValues,
    resolutions,
    diagnostics,
  };
}

export function getEffectiveSetting(
  snapshot: SettingsSnapshot,
  key: string,
): SettingResolution {
  const resolution = snapshot.resolutions[key];
  if (!resolution) throw new SettingError("UNKNOWN_SETTING", `Unknown setting: ${key}`, key);
  return resolution;
}

export function getEffectiveValue(snapshot: SettingsSnapshot, key: string): unknown {
  return getEffectiveSetting(snapshot, key).value;
}

export function assertModuleEnabled(snapshot: SettingsSnapshot, moduleKey: string): void {
  const key = moduleSettingKey(moduleKey);
  const resolution = snapshot.resolutions[key];
  if (resolution && resolution.value === false) {
    throw new SettingError("DISABLED_MODULE", `Module is disabled: ${moduleKey}`, key);
  }
}

export function canWriteSetting(
  definition: SettingDefinition,
  role: string,
  permissions: readonly string[] = [],
): boolean {
  const roleRank: Record<string, number> = { owner: 3, admin: 2, manager: 1, branch_manager: 1 };
  const requiredRank = definition.writeRole ? roleRank[definition.writeRole] ?? 99 : 0;
  if ((roleRank[role] ?? 0) < requiredRank) return false;
  return !definition.writePermission || permissions.includes(definition.writePermission);
}
