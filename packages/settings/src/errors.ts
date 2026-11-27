export type SettingErrorCode =
  | "UNKNOWN_SETTING"
  | "INVALID_VALUE"
  | "SECRET_VALUE"
  | "DISABLED_MODULE"
  | "FORBIDDEN";

export class SettingError extends Error {
  readonly code: SettingErrorCode;
  readonly key?: string;

  constructor(code: SettingErrorCode, message: string, key?: string) {
    super(message);
    this.name = "SettingError";
    this.code = code;
    this.key = key;
  }
}

export function settingErrorMessage(error: unknown): string {
  if (error instanceof SettingError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : "Unknown settings error";
}
