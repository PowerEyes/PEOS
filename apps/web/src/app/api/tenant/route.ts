import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ orgId: await getOrgId() }, { headers: { "Cache-Control": "public, max-age=300" } }); }
  catch { return NextResponse.json({ error: "Unknown store" }, { status: 404 }); }
}
