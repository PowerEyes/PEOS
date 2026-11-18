import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@poweros/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-3 h-4 w-48" />
        <div className="mt-8"><ProductGridSkeleton count={8} /></div>
      </div>
      <Footer />
    </div>);
}
