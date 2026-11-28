"use server";
import { revalidatePath } from "next/cache";
import { adminCtx } from "@/lib/admin-guard";
import { runDriveBackup } from "@/lib/backup";
export async function backupNow(): Promise<{ error?: string; ok?: string }> {
  const a = await adminCtx(); if (!a) return { error: "Only the owner or an admin can run backups." };
  const r = await runDriveBackup(a.orgId, "manual");
  revalidatePath("/settings/backup");
  return r.ok ? { ok: `Backup saved to Google Drive: ${r.name}` } : { error: r.error };
}
export async function disconnectDrive(): Promise<{ error?: string; ok?: string }> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.rpc("disconnect_integration", { p_provider: "google_drive" });
  revalidatePath("/settings/backup");
  return error ? { error: "Could not disconnect." } : { ok: "Google Drive disconnected. Existing backups stay in your Drive." };
}
