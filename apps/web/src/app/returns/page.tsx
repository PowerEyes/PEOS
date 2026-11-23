import { ContentPage } from "@/components/ContentPage";
import { getPage } from "@/lib/pages";
export const revalidate = 60;
export async function generateMetadata() { const p = await getPage("returns"); return { title: `${p?.title ?? "returns"} – Power Eyes Opticals`, description: p?.subtitle ?? undefined }; }
export default function Page() { return <ContentPage slug="returns" />; }
