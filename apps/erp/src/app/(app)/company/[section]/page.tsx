import { notFound, redirect } from "next/navigation";

// Topics whose editor already lives in the Settings workspace (one
// implementation per concern). /company/<topic> keeps the plan's route map
// stable and forwards to it; docs/branding/policies are real pages under
// /company and are handled by their static routes before this one runs.
const FORWARD: Record<string, string> = {
  profile: "/settings?section=business",
  legal: "/settings?section=business",
  gst: "/settings?section=tax",
  contact: "/settings?section=website",
  address: "/settings?section=business",
  hours: "/settings?section=business",
  preferences: "/settings?section=business",
};

export default function CompanySectionPage({ params }: { params: { section: string } }) {
  const to = FORWARD[params.section];
  if (!to) notFound();
  redirect(to);
}
