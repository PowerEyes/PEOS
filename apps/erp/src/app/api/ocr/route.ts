import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/doclinks";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeRx } from "@poweros/business-rules";
export const maxDuration = 60;
const PROMPT = `This is a spectacle (eyeglass) prescription. Read it and reply with ONLY this JSON, no other text:
{"od":{"sph":0,"cyl":0,"axis":0,"add":0,"va_dist":"6/6","va_near":"N6"},"os":{"sph":0,"cyl":0,"axis":0,"add":0,"va_dist":"6/6","va_near":"N6"},"pd_far":0,"pd_near":0}
OD is the right eye and OS is the left eye. Use null for anything that is not visible. Never guess a value.`;
export async function POST(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try { const { data: ok } = await serviceClient().rpc("rate_limit_hit", { p_key: `erp-ocr:${user.id}`, p_limit: 30, p_window_secs: 600 }); if (ok === false) return NextResponse.json({ error: "Too many scans. Wait a few minutes." }, { status: 429 }); } catch {}
  const token = process.env.HF_TOKEN;
  if (!token) return NextResponse.json({ error: "OCR is not set up yet. Add HF_TOKEN to .env.local." }, { status: 503 });
  const file = (await req.formData()).get("file") as File | null;
  if (!file || file.size > 8_000_000) return NextResponse.json({ error: "Upload an image under 8 MB." }, { status: 400 });
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.HF_OCR_MODEL || "Qwen/Qwen2.5-VL-7B-Instruct", max_tokens: 500, temperature: 0,
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${file.type || "image/jpeg"};base64,${b64}` } }, { type: "text", text: PROMPT }] }] }) });
  if (!res.ok) return NextResponse.json({ error: `The OCR service replied ${res.status}. Fill the values manually.` }, { status: 502 });
  const text: string = (await res.json())?.choices?.[0]?.message?.content ?? "";
  let raw: any = null; try { raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch {}
  if (!raw) return NextResponse.json({ error: "Could not read this photo. Try a clearer one or fill manually." }, { status: 422 });
  return NextResponse.json(normalizeRx(raw));
}
