import { ContentPage } from "@/components/ContentPage";
import { getPage } from "@/lib/pages";
export const revalidate = 0;
export async function generateMetadata(){const p=await getPage("guide-sunglasses");return {title:p?.title??"Sunglasses Guide",description:p?.subtitle??undefined};}
export default function Page(){return <ContentPage slug="guide-sunglasses"/>;}
