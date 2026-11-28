import { NextResponse } from "next/server";
import { adminCtx } from "@/lib/admin-guard";
import { buildSnapshot } from "@/lib/backup";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET() {
  const a = await adminCtx();
  if (!a) return NextResponse.json({ error: "Owner or admin access required" }, { status: 403 });
  try {
    const { gz } = await buildSnapshot(a.orgId);
    return new NextResponse(gz, { headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="poweros-backup-${new Date().toISOString().slice(0, 10)}.json.gz"`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Backup could not be created." }, { status: 500 }); }
}
