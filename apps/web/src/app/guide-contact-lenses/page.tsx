import { ContentPage } from "@/components/ContentPage";
import { getPage } from "@/lib/pages";
export const revalidate = 0;
export async function generateMetadata(){const p=await getPage("guide-contact-lenses");return {title:p?.title??"Contact Lens Guide",description:p?.subtitle??undefined};}
export default function Page(){return <ContentPage slug="guide-contact-lenses"/>;}
