import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET() {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: profile } = await sb
    .from("profiles")
    .select("role_key")
    .eq("id", user.id)
    .single();
  if (!["owner", "admin"].includes(profile?.role_key ?? ""))
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );

  const ocrUrl = process.env.OCR_SERVICE_URL?.trim();
  const ocrToken = process.env.OCR_SERVICE_TOKEN?.trim();
  let ocr: { configured: boolean; reachable: boolean | null } = {
    configured: Boolean(ocrUrl && ocrToken),
    reachable: null,
  };
  if (ocrUrl && ocrToken) {
    try {
      const response = await fetch(`${ocrUrl.replace(/\/$/, "")}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      ocr.reachable =
        response.ok && (await response.json()).engine === "paddleocr-local";
    } catch {
      ocr.reachable = false;
    }
  }

  let razorpay: { configured: boolean | null; mode: string } = {
    configured: null,
    mode: "unknown",
  };
  const webUrl = process.env.NEXT_PUBLIC_WEB_URL?.trim();
  const healthToken = process.env.INTEGRATION_HEALTH_TOKEN?.trim();
  if (webUrl && healthToken) {
    try {
      const response = await fetch(
        `${webUrl.replace(/\/$/, "")}/api/internal/integration-health`,
        {
          headers: { Authorization: `Bearer ${healthToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        },
      );
      if (response.ok) razorpay = (await response.json()).razorpay;
    } catch {}
  }
  return NextResponse.json(
    {
      ocr,
      razorpay,
      whatsapp: {
        configured: null,
        reachable: null,
        note: "Validate using the CRM test-message workflow.",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
