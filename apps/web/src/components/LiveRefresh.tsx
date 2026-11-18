"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-runs the server component fetch every `seconds` so status changes made by
// staff (ERP) appear without a manual refresh. Pauses while the tab is hidden.
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    const onVis = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [seconds, router]);
  return null;
}
