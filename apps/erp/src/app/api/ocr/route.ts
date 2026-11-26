import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/doclinks";
import { supabaseServer } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { data: ok } = await serviceClient().rpc("rate_limit_hit", {
      p_key: `erp-ocr:${user.id}`,
      p_limit: 30,
      p_window_secs: 600,
    });
    if (ok === false)
      return NextResponse.json(
        { error: "Too many scans. Wait a few minutes." },
        { status: 429 },
      );
  } catch {}
  const token = process.env.OCR_SERVICE_TOKEN?.trim();
  const endpoint = process.env.OCR_SERVICE_URL?.trim();
  if (!token || !endpoint)
    return NextResponse.json(
      {
        error:
          "Self-hosted OCR is not configured. Enter values manually or contact an administrator.",
      },
      { status: 503 },
    );
  let file: File | null = null;
  try {
    file = (await req.formData()).get("file") as File | null;
  } catch {}
  if (!file || file.size > 8_000_000)
    return NextResponse.json(
      { error: "Upload an image under 8 MB." },
      { status: 400 },
    );
  if (!file.type.startsWith("image/"))
    return NextResponse.json(
      { error: "Upload a supported image file." },
      { status: 400 },
    );
  const form = new FormData();
  form.set("file", file, file.name || "prescription.jpg");
  let upstream: Response;
  try {
    upstream = await fetch(
      `${endpoint.replace(/\/$/, "")}/v1/ocr/prescription`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(55_000),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "The internal OCR service could not be reached. Enter values manually or contact an administrator.",
      },
      { status: 503 },
    );
  }
  if (!upstream.ok)
    return NextResponse.json(
      {
        error:
          upstream.status === 401
            ? "The internal OCR service rejected its configured credentials."
            : "OCR could not process this image. Enter values manually or try a clearer scan.",
      },
      {
        status:
          upstream.status === 401
            ? 502
            : upstream.status === 413
              ? 413
              : upstream.status >= 500
                ? 503
                : 422,
      },
    );
  const result = await upstream.json();
  const flags = [...(result.field_warnings ?? []), ...(result.warnings ?? [])];
  return NextResponse.json(
    { ...result, flags },
    { headers: { "Cache-Control": "no-store" } },
  );
}
