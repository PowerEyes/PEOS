import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CatalogListing } from "@/components/CatalogListing";
export const revalidate = 60;
export const metadata = { title: "Eyeglasses – Prescription Frames", description: "Shop eyeglasses, prescription frames and optical frames." };
export default function Page({ searchParams }: { searchParams: Record<string, string> }) {
  return (<div className="min-h-screen bg-white"><Header /><Breadcrumb strip items={[{ label: "Eyeglasses" }]} />
    <CatalogListing slug="eyeglasses" kind="frame" sp={searchParams} fallback={{ title: "Eyeglasses", subtitle: "Prescription frames for every face and lifestyle" }} /><Footer /></div>);
}
