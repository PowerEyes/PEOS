import { redirect } from "next/navigation";
import { getSiteSession } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSiteSession();
  if (!session) redirect("/auth/login?next=/onboarding");

  const org = session.organisations[0] || {};

  return (
    <OnboardingForm
      initial={{
        businessName: org.name || "",
        legalName: org.legal_name || "",
        businessEmail: org.business_email || session.user.email,
        businessPhone: org.business_phone || "",
      }}
    />
  );
}
