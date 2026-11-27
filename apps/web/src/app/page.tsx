import HomePageView from "@/components/HomePageView";

// The ERP writes straight to Supabase; every request must render fresh CMS data.
export const revalidate = 0;

export default function Page({ searchParams }: { searchParams?: { preview?: string; k?: string } }) {
  return <HomePageView searchParams={searchParams} basePath="/" />;
}
