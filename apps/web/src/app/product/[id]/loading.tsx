import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductPageSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <ProductPageSkeleton />
      <Footer />
    </div>);
}
