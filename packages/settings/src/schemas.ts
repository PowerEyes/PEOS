import type { SettingDefinition } from "./types";

export interface ValidationResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validation mirrors public.validate_setting_value() in the Phase 1 migration.
 * String booleans/numbers remain valid because existing seed data stores some
 * JSONB values as strings; malformed values fail closed to the definition default.
 */
export function validateSettingValue(definition: SettingDefinition, rawValue: unknown): ValidationResult {
  if (rawValue === undefined || rawValue === null) {
    return { ok: false, error: "value is missing" };
  }

  switch (definition.valueType) {
    case "boolean": {
      if (typeof rawValue === "boolean") return { ok: true, value: rawValue };
      if (rawValue === "true") return { ok: true, value: true };
      if (rawValue === "false") return { ok: true, value: false };
      return { ok: false, error: "expected a boolean" };
    }
    case "number": {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        return { ok: true, value: rawValue };
      }
      if (typeof rawValue === "string" && /^-?\d+(\.\d+)?$/.test(rawValue)) {
        return { ok: true, value: Number(rawValue) };
      }
      return { ok: false, error: "expected a number" };
    }
    case "string":
    case "secret": {
      return typeof rawValue === "string"
        ? { ok: true, value: rawValue }
        : { ok: false, error: "expected a string" };
    }
    case "enum": {
      if (typeof rawValue !== "string") return { ok: false, error: "expected a string" };
      const allowed = definition.allowedValues ?? [];
      return allowed.includes(rawValue)
        ? { ok: true, value: rawValue }
        : { ok: false, error: `expected one of: ${allowed.join(", ") || "(none)"}` };
    }
    case "json": {
      if (!isPlainObject(rawValue) && !Array.isArray(rawValue)) {
        return { ok: false, error: "expected an object or array" };
      }
      if (definition.key === "numbering.code_prefixes") {
        const bad = Object.entries(rawValue).find(([, value]) => typeof value !== "string");
        if (bad) return { ok: false, error: `prefix ${bad[0]} must be a string` };
      }
      return { ok: true, value: rawValue };
    }
    default:
      return { ok: false, error: "unknown value type" };
  }
}
