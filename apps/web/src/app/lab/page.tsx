import { EnterprisePage } from "@/components/EnterprisePage";
import { getPage } from "@/lib/pages";
export const revalidate = 60;
export async function generateMetadata() { const p = await getPage("lab"); return { title: `${p?.title ?? "lab"} `, description: p?.subtitle ?? undefined }; }
export default function Page() { return <EnterprisePage slug="lab" />; }
