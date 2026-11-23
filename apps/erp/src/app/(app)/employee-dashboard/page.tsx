import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function EmployeeDashboardPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("staff_profiles").select("role").eq("user_id", user.id).single();

  const role = profile?.role || "staff";
  const dashboards: Record<string, string> = {
    optometrist: "/optometrist", sales_executive: "/sales", cashier: "/sales",
    inventory_manager: "/inventory", lab_technician: "/workshop", accountant: "/finance",
    receptionist: "/customers", branch_manager: "/branch-dashboard",
    owner: "/owner-dashboard", admin: "/owner-dashboard",
  };
  redirect(dashboards[role] || "/");
}