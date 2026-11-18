import { supabaseServer } from "@/lib/supabase/server";
import { StaffView } from "./view";
export default async function Page() {
  const sb = supabaseServer();
  const [{ data: staff }, { data: branches }] = await Promise.all([
    sb.from("profiles").select("id,full_name,role_key,is_approved,branch_id,deactivated,created_at").order("created_at",{ascending:false}),
    sb.from("branches").select("id,name").eq("is_active",true).order("name"),
  ]);
  return <StaffView staff={staff ?? []} branches={branches ?? []} />;
}
