import type { SettingsSnapshot } from "./types";

export interface PublicSettingEntry {
  key: string;
  module: string;
  value: unknown;
}

/**
 * Public projection used by web consumers. Deliberately excludes secrets even
 * if a catalog row is ever misconfigured as public.
 */
export function publicSettingEntries(snapshot: SettingsSnapshot): PublicSettingEntry[] {
  return snapshot.definitions
    .filter((definition) => definition.isPublic && !definition.isSecret)
    .map((definition) => ({
      key: definition.key,
      module: definition.module,
      value: snapshot.values[definition.key],
    }));
}

export function toPublicSettings(snapshot: SettingsSnapshot): Record<string, unknown> {
  return Object.fromEntries(publicSettingEntries(snapshot).map((entry) => [entry.key, entry.value]));
}
