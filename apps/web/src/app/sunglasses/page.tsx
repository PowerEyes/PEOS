import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CatalogListing } from "@/components/CatalogListing";
export const revalidate = 60;
export const metadata = { title: "Sunglasses – Regular & Prescription" };
export default function Page({ searchParams }: { searchParams: Record<string, string> }) {
  return (<div className="min-h-screen bg-white"><Header /><Breadcrumb strip items={[{ label: "Sunglasses" }]} />
    <CatalogListing slug="sunglasses" kind="sunglass" sp={searchParams} tone="from-slate-900 to-slate-700" fallback={{ title: "Sunglasses", subtitle: "Style meets protection – regular & prescription sunglasses" }} /><Footer /></div>);
}
