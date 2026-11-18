import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@poweros/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-14 text-center">
        <Skeleton className="mx-auto h-4 w-28" />
        <Skeleton className="mx-auto mt-3 h-10 w-64" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><ProductGridSkeleton count={8} /></div>
      <Footer />
    </div>);
}
