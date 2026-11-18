import { supabaseServer } from "./supabase/server";
export type CustomerProfile = { id: string; full_name: string; customer_code: string; vision_id: string; phone: string; email: string | null; dob: string | null; };
export async function getCustomer(): Promise<CustomerProfile | null> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob").eq("auth_user_id", user.id).single();
  return data;
}
export async function getCustomerOrCreate(user: { id: string; email?: string; user_metadata?: any }): Promise<CustomerProfile | null> {
  const sb = supabaseServer();
  const { data: existing } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob").eq("auth_user_id", user.id).single();
  if (existing) return existing;
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer";
  const phone = user.user_metadata?.phone || "";
  const { data } = await sb.from("customers").insert({ full_name: name, phone, email: user.email, auth_user_id: user.id, org_id: "00000000-0000-0000-0000-000000000001", city: "Chennai", state: "Tamil Nadu", pincode: "600037" }).select("id,full_name,customer_code,vision_id,phone,email,dob").single();
  return data;
}
