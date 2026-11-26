import { notFound } from "next/navigation";
import { ContentPage } from "@/components/ContentPage";
import { getPage } from "@/lib/pages";
export const revalidate = 60;
// Any page created in ERP > Website > Pages is served here (e.g. /lens-guide, /shipping). Real routes such as /about win over this.
// Only kind "page" is public: guides, hero and config rows are internal content blocks.
export async function generateMetadata({ params }: { params: { slug: string } }) { const p = await getPage(params.slug); return p?.kind === "page" ? { title: p.title, description: p.subtitle ?? undefined } : {}; }
export default async function Page({ params }: { params: { slug: string } }) {
  const p = await getPage(params.slug); if (!p || p.kind !== "page") notFound();
  return <ContentPage slug={params.slug} />;
}
