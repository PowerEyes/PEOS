import { redirect } from "next/navigation";
import { getSiteSession } from "@/lib/auth";
import SubscribeForm from "./subscribe-form";

export const dynamic = "force-dynamic";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const session = await getSiteSession();
  if (!session) redirect("/auth/login?next=/subscribe");

  const allowed = ["starter", "growth", "enterprise"];
  const initialPlan = allowed.includes(searchParams.plan || "") ? searchParams.plan : "starter";

  return <SubscribeForm initialPlan={initialPlan} />;
}
