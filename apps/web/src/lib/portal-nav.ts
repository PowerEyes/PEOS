import type { LucideIcon } from "lucide-react";
import {
  Eye, User, FileText, CalendarDays, ShoppingBag, Heart, RotateCcw,
  Wrench, Shield, Gift, Bell, FolderOpen, MapPin, CreditCard,
} from "lucide-react";

export type PortalNavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Single source of truth for the customer-portal navigation.
 *
 * Rendered by the desktop sidebar (src/app/my/layout.tsx) AND by the Header's
 * mobile drawer when the Header is in portal mode — so the account menu is
 * reachable on mobile instead of the public shop menu.
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { href: "/my", label: "Dashboard", icon: Eye },
  { href: "/my/profile", label: "My Profile", icon: User },
  { href: "/my/vision-id", label: "Vision ID", icon: Eye },
  { href: "/my/family", label: "Family Members", icon: Heart },
  { href: "/my/prescriptions", label: "Prescriptions", icon: FileText },
  { href: "/my/appointments", label: "Eye Test Appointments", icon: CalendarDays },
  { href: "/my/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/my/payments", label: "My Payments", icon: CreditCard },
  { href: "/my/wishlist", label: "Wishlist", icon: Heart },
  { href: "/my/reorder", label: "Reorder", icon: RotateCcw },
  { href: "/my/repairs", label: "Repairs & Service", icon: Wrench },
  { href: "/my/warranty", label: "Warranty", icon: Shield },
  { href: "/my/loyalty", label: "Loyalty & Rewards", icon: Gift },
  { href: "/my/notifications", label: "Notifications", icon: Bell },
  { href: "/my/documents", label: "Documents", icon: FolderOpen },
  { href: "/my/addresses", label: "Address Book", icon: MapPin },
];
