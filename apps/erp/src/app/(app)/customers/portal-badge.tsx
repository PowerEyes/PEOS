
"use client";
import { Globe, Smartphone } from "lucide-react";

export function PortalBadge({ hasPortal, lastOrder }: { hasPortal: boolean; lastOrder?: string }) {
  if (!hasPortal) return null;
  return (
    <span title="This customer has a website account" className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
      <Globe size={10}/>Portal
    </span>);
}
