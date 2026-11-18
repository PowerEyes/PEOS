import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Per-page chrome for account pages.
 *
 * The site header and the account sidebar are rendered once by the parent route
 * layout (src/app/my/layout.tsx) for every /my/* route. This component therefore
 * only adds the breadcrumb above the page content — it must never render its own
 * header/nav/sidebar, or the whole site shell appears twice on the page.
 */

const SECTION_LABEL: Record<string, string> = {
  "/my": "Overview",
  "/my/appointments": "Eye Test Appointments",
  "/my/addresses": "My Addresses",
  "/my/documents": "Documents",
  "/my/eyewear": "My Eyewear",
  "/my/notifications": "Notifications",
  "/my/orders": "My Orders",
  "/my/payments": "My Payments",
  "/my/profile": "My Profile",
  "/my/reorder": "Reorder",
  "/my/repairs": "Repairs & Service",
  "/my/warranty": "Warranty",
};

export function PortalLayout({ children, activePath }: { children: React.ReactNode; activePath: string }) {
  const label =
    SECTION_LABEL[activePath] ?? activePath.split("/").filter(Boolean).pop()?.replace(/-/g, " ");
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-xs text-slate-500">
        <Link href="/" className="hover:underline hover:text-navy-800 transition">Home</Link>
        <ChevronRight size={11} />
        <Link href="/my" className="hover:underline hover:text-navy-800 transition">My Account</Link>
        {label && (
          <>
            <ChevronRight size={11} />
            <span className="font-medium text-navy-800">{label}</span>
          </>
        )}
      </nav>
      {children}
    </>
  );
}
