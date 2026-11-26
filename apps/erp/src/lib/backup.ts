import { gzipSync } from "node:zlib";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessTokenFrom, ensureFolder, uploadFile, deleteFile } from "@/lib/google-drive";
export const BACKUP_FOLDER = "PowerOS Backups";
export const RETENTION = 30;
const PAGE = 1000;

/** Builds a gzipped JSON snapshot of every org-scoped table for ONE organisation. Service role: callers must have authorised orgId. */
export async function buildSnapshot(orgId: string) {
  const db = supabaseAdmin();
  const { data: tables, error } = await db.rpc("backup_tables");
  if (error) throw new Error(`Could not list tables: ${error.message}`);
  const out: Record<string, unknown[]> = {}, counts: Record<string, number> = {};
  for (const t of tables as string[]) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = db.from(t).select("*").eq("org_id", orgId).range(from, from + PAGE - 1);
      let r = await q.order("id", { ascending: true });
      if (r.error) r = await db.from(t).select("*").eq("org_id", orgId).range(from, from + PAGE - 1);
      if (r.error) throw new Error(`Backup failed on ${t}: ${r.error.message}`);
      rows.push(...(r.data ?? []));
      if ((r.data ?? []).length < PAGE) break;
    }
    out[t] = rows; counts[t] = rows.length;
  }
  const doc = { format: "poweros-backup/1", org_id: orgId, created_at: new Date().toISOString(), tables: out };
  return { gz: gzipSync(Buffer.from(JSON.stringify(doc))), counts };
}
const stamp = () => new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);

/** Full backup to Google Drive for one organisation; always leaves a backup_runs row. */
export async function runDriveBackup(orgId: string, trigger: "cron" | "manual") {
  const db = supabaseAdmin();
  const { data: run } = await db.from("backup_runs").insert({ org_id: orgId, trigger }).select("id").single();
  const fail = async (msg: string) => { if (run) await db.from("backup_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: msg.slice(0, 500) }).eq("id", run.id); return { ok: false as const, error: msg }; };
  try {
    const { data: sec } = await db.from("integration_secrets").select("secret").eq("org_id", orgId).eq("provider", "google_drive").maybeSingle();
    const refresh = (sec?.secret as any)?.refresh_token as string | undefined;
    if (!refresh) return await fail("Google Drive is not connected.");
    const token = await accessTokenFrom(refresh);
    const folderId = await ensureFolder(token, BACKUP_FOLDER, (sec!.secret as any).folder_id);
    if (folderId !== (sec!.secret as any).folder_id) await db.from("integration_secrets").update({ secret: { ...(sec!.secret as object), folder_id: folderId } }).eq("org_id", orgId).eq("provider", "google_drive");
    const { gz, counts } = await buildSnapshot(orgId);
    const name = `poweros-backup-${stamp()}.json.gz`;
    const file = await uploadFile(token, folderId, name, gz, "application/gzip");
    if (run) await db.from("backup_runs").update({ status: "ok", finished_at: new Date().toISOString(), file_name: name, drive_file_id: file.id, size_bytes: gz.length, table_counts: counts }).eq("id", run.id);
    // Retention: keep the newest RETENTION successful backups.
    const { data: old } = await db.from("backup_runs").select("id,drive_file_id").eq("org_id", orgId).eq("status", "ok").not("drive_file_id", "is", null).order("started_at", { ascending: false }).range(RETENTION, RETENTION + 200);
    for (const o of old ?? []) { await deleteFile(token, o.drive_file_id!); await db.from("backup_runs").update({ drive_file_id: null }).eq("id", o.id); }
    return { ok: true as const, name, size: gz.length };
  } catch (e: any) { return await fail(e?.message ?? "Backup failed"); }
}
