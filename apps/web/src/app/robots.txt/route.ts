export async function GET() {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? "https://www.powereyes.in";
  const txt = `User-agent: *\nAllow: /\nDisallow: /my/\nDisallow: /checkout\nDisallow: /cart\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(txt, { headers: { "Content-Type": "text/plain" } });
}
