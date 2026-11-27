import {
  DEFAULT_APP_SETTINGS,
  getSettingsSnapshot,
  legacyAppSettingsFrom,
  type LegacyAppSettings,
} from "./settings-catalog";

// Compatibility adapter. org_settings is a key/value table (org_id, key, value
// jsonb) — every read/write must go through keys, never wide-row columns.
// The catalog resolver now owns key mapping; this module keeps the old
// AppSettings contract unchanged for all existing callers.
export type AppSettings = LegacyAppSettings;

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  codePrefixes: {},
};

export async function getSettings(): Promise<AppSettings> {
  try {
    // Phase 2: read through the resolver so org, branch, user and legacy storage
    // sources are applied consistently. Legacy keys remain valid via aliases.
    const snapshot = await getSettingsSnapshot();
    return legacyAppSettingsFrom(snapshot);
  } catch {
    return { ...DEFAULT_SETTINGS, codePrefixes: {} };
  }
}
