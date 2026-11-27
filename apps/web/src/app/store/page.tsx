import HomePageView from "@/components/HomePageView";

// `/store` is an alias of the storefront homepage. Both routes share one CMS
// renderer so a Website Studio edit can never drift between the two URLs.
export const revalidate = 0;

export default function Page({ searchParams }: { searchParams?: { preview?: string; k?: string } }) {
  return <HomePageView searchParams={searchParams} basePath="/store" />;
}
