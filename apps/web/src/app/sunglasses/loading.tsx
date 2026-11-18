import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ListingSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@poweros/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-10 text-center">
        <Skeleton className="mx-auto h-10 w-56" />
        <Skeleton className="mx-auto mt-3 h-4 w-80" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><ListingSkeleton /></div>
      <Footer />
    </div>);
}
