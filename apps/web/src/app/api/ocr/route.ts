import { NextResponse } from "next/server";
export const maxDuration = 60;
const PROMPT = `This is a spectacle (eyeglass) prescription. Reply with ONLY this JSON, no other text:
{"od":{"sph":0,"cyl":0,"axis":0,"add":null},"os":{"sph":0,"cyl":0,"axis":0,"add":null},"pd_far":0,"pd_near":null}
OD is right eye, OS is left eye. Use null for anything not visible. Never guess.`;
import { rateLimited, tooMany } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (await rateLimited(req, "ocr", 10, 600)) return tooMany();
  const token = process.env.HF_TOKEN;
  if (!token) return NextResponse.json({ error: "OCR is not configured. Add HF_TOKEN to .env.local." }, { status: 503 });
  const file = (await req.formData()).get("file") as File | null;
  if (file && (!file.type.startsWith("image/") || file.size > 8_000_000)) return new Response(JSON.stringify({ error: "Upload an image under 8 MB." }), { status: 400 });
  if (!file || file.size > 8_000_000) return NextResponse.json({ error: "Upload an image under 8 MB." }, { status: 400 });
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.HF_OCR_MODEL || "Qwen/Qwen2.5-VL-7B-Instruct", max_tokens: 300, temperature: 0,
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${file.type||"image/jpeg"};base64,${b64}` } }, { type: "text", text: PROMPT }] }] }) });
  if (!res.ok) return NextResponse.json({ error: "OCR service unavailable. Fill the values manually." }, { status: 502 });
  const text: string = (await res.json())?.choices?.[0]?.message?.content ?? "";
  let raw: any = null; try { raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch {}
  if (!raw) return NextResponse.json({ error: "Could not read this photo. Try a clearer one or fill manually." }, { status: 422 });
  const clamp = (v: any, lo: number, hi: number, step: number) => { const n = Number(v); if (!isFinite(n)) return null; const rounded = Math.round(n / step) * step; return rounded < lo || rounded > hi ? null : rounded; };
  const eye = (e: any, side: string) => { const flags: string[] = []; const r = (k: string, lo: number, hi: number, st: number) => { const v = clamp(e?.[k], lo, hi, st); if (v == null && e?.[k] != null) flags.push(`${side}.${k}`); return v; };
    return { value: { sph: r("sph",-20,20,.25), cyl: r("cyl",-8,8,.25), axis: r("axis",0,180,1), add: e?.add != null ? r("add",.25,4,.25) : null, va_dist: "", va_near: "" }, flags }; };
  const od = eye(raw.od, "od"); const os = eye(raw.os, "os");
  return NextResponse.json({ values: { od: od.value, os: os.value, pd_far: clamp(raw.pd_far,20,80,.5), pd_near: clamp(raw.pd_near,20,80,.5) }, flags: [...od.flags, ...os.flags] });
}
