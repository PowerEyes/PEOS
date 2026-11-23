import { ContentPage } from "@/components/ContentPage";
import { getPage } from "@/lib/pages";
export const revalidate = 60;
export async function generateMetadata() { const p = await getPage("privacy"); return { title: `${p?.title ?? "privacy"} – Power Eyes Opticals`, description: p?.subtitle ?? undefined }; }
export default function Page() { return <ContentPage slug="privacy" />; }
