import { NextResponse } from "next/server";
import { rateLimited, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Public storefront proxy to the same private PaddleOCR service used by ERP.
// It never forwards client-supplied endpoints or exposes the service token.
export async function POST(req: Request) {
  if (await rateLimited(req, "ocr", 10, 600)) return tooMany();
  const endpoint = process.env.OCR_SERVICE_URL?.trim();
  const token = process.env.OCR_SERVICE_TOKEN?.trim();
  if (!endpoint || !token)
    return NextResponse.json(
      { error: "Self-hosted OCR is not configured." },
      { status: 503 },
    );
  let file: File | null = null;
  try {
    file = (await req.formData()).get("file") as File | null;
  } catch {}
  if (!file || !file.type.startsWith("image/") || file.size > 8_000_000)
    return NextResponse.json(
      { error: "Upload an image under 8 MB." },
      { status: 400 },
    );
  const form = new FormData();
  form.set("file", file, file.name || "prescription.jpg");
  try {
    const res = await fetch(
      `${endpoint.replace(/\/$/, "")}/v1/ocr/prescription`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(55_000),
        cache: "no-store",
      },
    );
    if (!res.ok)
      return NextResponse.json(
        {
          error:
            "OCR could not process the image. Please enter values manually.",
        },
        { status: res.status === 413 ? 413 : res.status >= 500 ? 503 : 422 },
      );
    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "The internal OCR service is unavailable." },
      { status: 503 },
    );
  }
}
