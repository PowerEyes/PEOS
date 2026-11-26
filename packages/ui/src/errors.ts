// Typed error class for Supabase/PowerOSC errors.
// Wraps raw errors with code, message, and recovery instructions.

export type PowerOSErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "STOCK_INSUFFICIENT"
  | "PAYMENT_EXCEEDS_BALANCE"
  | "DISCOUNT_EXCEEDS_LIMIT"
  | "PRESCRIPTION_REQUIRED"
  | "BRANCH_MISMATCH"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface PowerOSErrorInfo {
  code: PowerOSErrorCode;
  message: string;
  recovery: string;
}

export class PowerOSError extends Error {
  code: PowerOSErrorCode;
  recovery: string;

  constructor(info: PowerOSErrorInfo) {
    super(info.message);
    this.name = "PowerOSError";
    this.code = info.code;
    this.recovery = info.recovery;
  }

  toJSON() {
    return { code: this.code, message: this.message, recovery: this.recovery };
  }
}

// Map common Supabase/Postgres errors to PowerOSError
export function wrapSupabaseError(err: unknown): PowerOSError {
  if (err instanceof PowerOSError) return err;

  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code || "";

  // Postgres error codes
  if (code === "23505") {
    return new PowerOSError({
      code: "VALIDATION_FAILED",
      message: "A record with this value already exists.",
      recovery: "Use a different value or update the existing record.",
    });
  }
  if (code === "23503") {
    return new PowerOSError({
      code: "VALIDATION_FAILED",
      message: "Referenced record does not exist.",
      recovery: "Ensure the related record exists before creating this one.",
    });
  }
  if (code === "42501" || msg.includes("permission denied") || msg.includes("RLS")) {
    return new PowerOSError({
      code: "PERMISSION_DENIED",
      message: "You don't have permission to perform this action.",
      recovery: "Contact your administrator or check your role permissions.",
    });
  }
  if (msg.includes("JWT") || msg.includes("not authenticated") || msg.includes("session")) {
    return new PowerOSError({
      code: "AUTH_REQUIRED",
      message: "Your session has expired.",
      recovery: "Please log in again.",
    });
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
    return new PowerOSError({
      code: "NETWORK_ERROR",
      message: "Could not connect to the server.",
      recovery: "Check your internet connection and try again.",
    });
  }

  return new PowerOSError({
    code: "UNKNOWN",
    message: msg || "An unexpected error occurred.",
    recovery: "Try again. If the problem persists, contact support.",
  });
}

// Helper for use in server actions
export function handleActionError(err: unknown): { error: PowerOSErrorInfo } {
  const wrapped = wrapSupabaseError(err);
  // Log structured error (in production, send to Sentry)
  console.error(JSON.stringify({
    level: "error",
    code: wrapped.code,
    message: wrapped.message,
    timestamp: new Date().toISOString(),
    stack: wrapped.stack,
  }));
  return { error: wrapped.toJSON() };
}