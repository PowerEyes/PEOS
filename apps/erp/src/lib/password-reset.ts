import { createHmac, timingSafeEqual } from "crypto";

export const RESET_APP = "erp";
export const RESET_CALLBACK_PATH = "/auth/reset";
export const RECOVERY_COOKIE = "poweros_erp_recovery";
export const RECOVERY_WINDOW_SECONDS = 10 * 60;
export const APP_PROOF_WINDOW_SECONDS = 24 * 60 * 60;

export function passwordResetSecret(): string {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret) throw new Error("PASSWORD_RESET_SECRET is not configured");
  return secret;
}

function hmac(data: string): string {
  return createHmac("sha256", passwordResetSecret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Signed, short-lived proof that a recovery redirect was minted for this app. */
export function makeAppProof(app: string, expiresAt: number): string {
  return `${expiresAt}.${hmac(`${app}.${expiresAt}`)}`;
}

export type AppProofStatus = "valid" | "expired" | "invalid";

export function verifyAppProof(app: string, proof: string | null): AppProofStatus {
  if (!proof) return "invalid";
  const [rawExp, signature] = proof.split(".");
  if (!rawExp || !signature) return "invalid";
  const expiresAt = Number(rawExp);
  if (!Number.isFinite(expiresAt) || !safeEqual(signature, hmac(`${app}.${expiresAt}`))) {
    return "invalid";
  }
  return expiresAt < Date.now() ? "expired" : "valid";
}

/** Signed, short-lived cookie set only after a valid Supabase recovery exchange. */
export function makeRecoveryProof(expiresAt: number): string {
  return `${expiresAt}.${hmac(`recovery.${RESET_APP}.${expiresAt}`)}`;
}

export function verifyRecoveryProof(value: string | undefined): boolean {
  if (!value) return false;
  const [rawExp, signature] = value.split(".");
  if (!rawExp || !signature) return false;
  const expiresAt = Number(rawExp);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(signature, hmac(`recovery.${RESET_APP}.${expiresAt}`));
}

export function erpResetBase(req?: { nextUrl: { origin: string } }): string {
  const configured = process.env.NEXT_PUBLIC_ERP_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (configured || req?.nextUrl.origin || "http://localhost:3001").replace(/\/$/, "");
}
