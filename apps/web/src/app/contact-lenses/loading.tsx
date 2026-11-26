import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@poweros/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="bg-gradient-to-r from-teal-900 to-teal-700 px-4 py-14 text-center">
        <Skeleton className="mx-auto h-10 w-64" />
        <Skeleton className="mx-auto mt-3 h-4 w-80" />
      </div>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <ProductGridSkeleton count={6} />
        <Skeleton className="h-40 w-full" />
      </div>
      <Footer />
    </div>);
}
