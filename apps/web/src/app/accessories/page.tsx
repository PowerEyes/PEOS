import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CatalogListing } from "@/components/CatalogListing";
import type { Sp } from "@/lib/facets";

export const revalidate = 60;
export const metadata = { title: "Accessories – Care, Cases & Cleaning", description: "Cleaning kits, cases, chains, nose pads and other eyewear accessories." };
export default function AccessoriesPage({ searchParams }: { searchParams: Sp }) {
  return <div className="min-h-screen bg-white"><Header/><Breadcrumb strip items={[{label:"Accessories"}]}/><CatalogListing slug="accessories" kind="accessory" sp={searchParams} tone="from-amber-900 to-amber-700" fallback={{title:"Accessories",subtitle:"Cleaning kits, cases, chains and everyday eyewear care"}}/><Footer/></div>;
}
