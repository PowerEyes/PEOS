import { NextResponse } from "next/server";
import { getPage } from "@/lib/pages";
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!/^guide-[a-z-]{2,40}$/.test(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = await getPage(slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ title: p.title, subtitle: p.subtitle, body: p.body }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
