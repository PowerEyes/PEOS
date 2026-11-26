import { ContentPage } from "@/components/ContentPage";
import { getPage } from "@/lib/pages";
export const revalidate = 60;
export async function generateMetadata() { const p = await getPage("faq"); return { title: `${p?.title ?? "faq"} `, description: p?.subtitle ?? undefined }; }
export default function Page() { return <ContentPage slug="faq" />; }
