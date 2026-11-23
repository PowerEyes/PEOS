import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export interface SubscriptionStatus {
  is_active: boolean;
  is_trial: boolean;
  is_expired: boolean;
  status: string;
  plan_name: string | null;
}

export async function checkSubscription(tenantId: string): Promise<SubscriptionStatus> {
  const { data: sub } = await sb.from("subscriptions").select("status, trial_ends_at, current_period_end, plan:subscription_plans(name)").eq("tenant_id", tenantId).single();

  if (!sub) {
    return { is_active: false, is_trial: false, is_expired: true, status: "none", plan_name: null };
  }

  const now = new Date();
  const isTrial = sub.status === "trial";
  const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const trialExpired = isTrial && trialEnds ? trialEnds < now : false;
  const periodExpired = sub.status === "active" && periodEnd ? periodEnd < now : false;
  const isExpired = trialExpired || periodExpired || sub.status === "expired" || sub.status === "cancelled";

  return {
    is_active: sub.status === "active" && !periodExpired,
    is_trial: isTrial && !trialExpired,
    is_expired: isExpired,
    status: sub.status,
    plan_name: (sub.plan as any)?.name || null,
  };
}

export function isOperationAllowed(status: SubscriptionStatus, operation: "read" | "write" | "export"): boolean {
  if (status.is_active || status.is_trial) return true;
  // Expired: allow reads and exports, block writes
  if (status.is_expired) {
    return operation === "read" || operation === "export";
  }
  return false;
}