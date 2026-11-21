import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/doclinks";
import { supabaseServer } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const maxDuration = 60;
const PROMPT = `This is a spectacle (eyeglass) prescription. Read it and reply with ONLY this JSON, no other text:
{"od":{"sph":0,"cyl":0,"axis":0,"add":0,"va_dist":"6/6","va_near":"N6"},"os":{"sph":0,"cyl":0,"axis":0,"add":0,"va_dist":"6/6","va_near":"N6"},"pd_far":0,"pd_near":0}
OD is the right eye and OS is the left eye. Use null for anything that is not visible. Never guess a value.`;
// Self-contained normaliser (the old import of @poweros/business-rules#normalizeRx broke this route when the package was missing).
const clamp = (v: any, lo: number, hi: number, st: number) => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[^\d.+-]/g, "")); if (!isFinite(n)) return null; const r = Math.round(n / st) * st; return r < lo || r > hi ? null : r; };
function eye(e: any, side: string, flags: string[]) {
  const f = (k: string, lo: number, hi: number, st: number) => { const v = clamp(e?.[k], lo, hi, st); if (v == null && e?.[k] != null && e?.[k] !== "") flags.push(`${side}.${k}`); return v; };
  const s = (k: string) => (typeof e?.[k] === "string" ? e[k].trim().slice(0, 10) : "");
  return { sph: f("sph", -20, 20, 0.25), cyl: f("cyl", -8, 8, 0.25), axis: f("axis", 0, 180, 1), add: f("add", 0.25, 4, 0.25), va_dist: s("va_dist"), va_near: s("va_near") };
}
export async function POST(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try { const { data: ok } = await serviceClient().rpc("rate_limit_hit", { p_key: `erp-ocr:${user.id}`, p_limit: 30, p_window_secs: 600 }); if (ok === false) return NextResponse.json({ error: "Too many scans. Wait a few minutes." }, { status: 429 }); } catch {}
  const token = process.env.HF_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "OCR is not set up yet. Add HF_TOKEN to the server environment and redeploy/restart." }, { status: 503 });
  let file: File | null = null;
  try { file = (await req.formData()).get("file") as File | null; } catch {}
  if (!file || file.size > 8_000_000) return NextResponse.json({ error: "Upload an image under 8 MB." }, { status: 400 });
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mime = file.type?.startsWith("image/") ? file.type : "image/jpeg";
  const models = [process.env.HF_OCR_MODEL, "Qwen/Qwen2.5-VL-7B-Instruct", "Qwen/Qwen2.5-VL-72B-Instruct", "google/gemma-3-27b-it"].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
  let text = "", lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({ model, max_tokens: 500, temperature: 0, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }, { type: "text", text: PROMPT }] }] }) });
      if (res.status === 401 || res.status === 403) return NextResponse.json({ error: "HF_TOKEN was rejected. Create a new token (Read, or Fine-grained with 'Make calls to Inference Providers' on) at huggingface.co/settings/tokens." }, { status: 502 });
      if (res.status === 402) return NextResponse.json({ error: "Hugging Face free credits are used up. Wait for the monthly reset or add credits." }, { status: 502 });
      if (!res.ok) { lastErr = `${model}: ${res.status} ${(await res.text()).slice(0, 160)}`; continue; }
      const c = (await res.json())?.choices?.[0]?.message?.content;
      text = Array.isArray(c) ? c.map((p: any) => p?.text ?? "").join("") : String(c ?? "");
      if (text) break;
    } catch (e: any) { lastErr = `${model}: ${e?.message ?? e}`; }
  }
  if (!text) { console.error("OCR failed:", lastErr); return NextResponse.json({ error: `The OCR service is unavailable (${lastErr.slice(0, 80)}). Fill the values manually.` }, { status: 502 }); }
  let raw: any = null; try { raw = JSON.parse(text.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/)?.[0] ?? ""); } catch {}
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Could not read this photo. Try a clearer one or fill manually." }, { status: 422 });
  const flags: string[] = [];
  const od = eye(raw.od, "od", flags), os = eye(raw.os, "os", flags);
  return NextResponse.json({ values: { od, os, pd_far: clamp(raw.pd_far, 20, 80, 0.5), pd_near: clamp(raw.pd_near, 20, 80, 0.5) }, flags });
}
