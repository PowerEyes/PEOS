import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartSkeleton />
      <Footer />
    </div>
  );
}