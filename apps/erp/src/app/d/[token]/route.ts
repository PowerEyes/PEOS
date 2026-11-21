import { NextResponse } from "next/server";
import { DOCS, serviceClient, verifyToken } from "@/lib/doclinks";
import { buildDocPdf } from "@/lib/doc-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const page = (title: string, msg: string, status: number) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><body style="font-family:system-ui;text-align:center;padding:15vh 24px;color:#1e293b"><h2>${title}</h2><p>${msg}</p></body>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", ...NOINDEX } });

async function renderPdf(url: string): Promise<Buffer> {
  const puppeteer: any = (await import("puppeteer-core")).default;
  let executablePath = process.env.CHROME_EXECUTABLE_PATH; let args: string[] = ["--no-sandbox"];
  if (!executablePath) { const chromium: any = (await import("@sparticuz/chromium")).default; executablePath = await chromium.executablePath(); args = chromium.args; }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  try {
    const p = await browser.newPage();
    await p.goto(url, { waitUntil: "networkidle0", timeout: 25_000 });
    return Buffer.from(await p.pdf({ preferCSSPageSize: true, printBackground: true }));
  } finally { await browser.close().catch(() => {}); }
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const url = new URL(req.url);
  let v;
  try { v = await verifyToken(params.token); } catch { return page("Unavailable", "Documents are temporarily unavailable. Please contact the store.", 503); }
  if (!v.ok) {
    if (v.reason === "invalid") return page("Link not found", "This link is not valid. Please ask the store to resend it.", 404);
    return page("Link expired", "This document link is no longer active. Please ask the store to send a fresh link.", 410);
  }
  const l = v.link, cfg = DOCS[l.doc_type];
  // WhatsApp / social link-preview crawlers: no view count, no PDF render, no content.
  if (/WhatsApp|facebookexternalhit|Twitterbot|TelegramBot|Slackbot|bot|crawler/i.test(req.headers.get("user-agent") ?? ""))
    return new Response(`<!doctype html><meta charset="utf-8"><meta property="og:title" content="${cfg.label} — Power Eyes Opticals"><meta property="og:description" content="Tap to view your document securely."><meta name="robots" content="noindex">`, { headers: { "Content-Type": "text/html; charset=utf-8", ...NOINDEX } });

  const sb = serviceClient();
  await sb.from("document_links").update({ view_count: l.view_count + 1, last_viewed_at: new Date().toISOString() }).eq("id", l.id);

  const printUrl = `${url.origin}/print/${cfg.path}/${l.ref_id}?dt=${params.token}`;
  if (url.searchParams.get("fmt") === "html") return NextResponse.redirect(printUrl, { status: 302, headers: NOINDEX });

  const filename = `${cfg.label.replace(/[^A-Za-z]+/g, "-")}-${l.ref_id.slice(0, 8)}.pdf`;
  const send = (buf: ArrayBuffer | Buffer) => new Response(buf as any, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, ...NOINDEX } });
  try {
    // Reuse a PDF generated in the last 10 minutes; older ones are regenerated so edits/payments show.
    if (l.pdf_path && l.pdf_generated_at && Date.now() - new Date(l.pdf_generated_at).getTime() < 600_000) {
      const { data } = await sb.storage.from("documents").download(l.pdf_path);
      if (data) return send(await data.arrayBuffer());
    }
    // Primary engine: built-in server-side renderer (no browser needed). Optional high-fidelity engine
    // (DOC_PDF_ENGINE=chromium) renders the exact A5 print design and falls back to the built-in one.
    let buf: Buffer | null = null;
    if (process.env.DOC_PDF_ENGINE === "chromium") {
      try { buf = await renderPdf(`${process.env.DOC_RENDER_BASE ?? url.origin}/print/${cfg.path}/${l.ref_id}?dt=${params.token}`); }
      catch (e: any) { console.error("[doc-pdf] chromium failed, using built-in:", e?.message); }
    }
    if (!buf) {
      const built = await buildDocPdf(sb, l.doc_type, l.ref_id);
      if (!built) return NextResponse.redirect(printUrl, { status: 302, headers: NOINDEX });
      buf = built.pdf;
    }
    const path = `${l.org_id}/${l.doc_type}/${l.ref_id}/${l.id}.pdf`;
    const up = await sb.storage.from("documents").upload(path, buf, { contentType: "application/pdf", upsert: true });
    await sb.from("document_links").update(up.error ? { last_error: `upload: ${up.error.message}` } : { pdf_path: path, pdf_generated_at: new Date().toISOString(), last_error: null }).eq("id", l.id);
    return send(buf);
  } catch (e: any) {
    // Failed generation never blocks the customer: serve the same design as a printable page; next visit retries.
    console.error("[doc-pdf]", l.id, e?.message);
    await sb.from("document_links").update({ last_error: String(e?.message ?? e).slice(0, 300) }).eq("id", l.id);
    return NextResponse.redirect(printUrl, { status: 302, headers: NOINDEX });
  }
}
