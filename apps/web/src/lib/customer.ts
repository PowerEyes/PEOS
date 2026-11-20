import { supabaseServer } from "./supabase/server";
export type CustomerProfile = { id: string; full_name: string; customer_code: string; vision_id: string; phone: string; email: string | null; dob: string | null; gender: string | null; };
export async function getCustomer(): Promise<CustomerProfile | null> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob,gender").eq("auth_user_id", user.id).single();
  return data;
}
export async function getCustomerOrCreate(user: { id: string; email?: string; user_metadata?: any }): Promise<CustomerProfile | null> {
  const sb = supabaseServer();
  // 1. Already linked to this auth user?
  const { data: existing } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob,gender").eq("auth_user_id", user.id).maybeSingle();
  if (existing) return existing;

  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer";
  const phone = user.user_metadata?.phone || "";
  const gender = user.user_metadata?.gender || null;
  const dob = user.user_metadata?.dob || null;
  const email = user.email || null;

  // 2. Detect an already-registered customer by email or phone and link the
  //    auth user to it instead of creating a duplicate.
  if (email || phone) {
    let q = sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob,gender");
    if (email && phone) q = q.or(`email.eq.${email},phone.eq.${phone}`);
    else if (email) q = q.eq("email", email);
    else q = q.eq("phone", phone);
    const { data: match } = await q.limit(1).maybeSingle();
    if (match) {
      await sb.from("customers").update({ auth_user_id: user.id, gender: gender ?? match.gender, dob: dob ?? match.dob, whatsapp_opt_in: user.user_metadata?.whatsapp_opt_in ?? undefined }).eq("id", match.id);
      const { data: linked } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob,gender").eq("id", match.id).single();
      return linked;
    }
  }

  // 3. Create a new customer row.
  const { data } = await sb.from("customers").insert({
    full_name: name, phone, email, auth_user_id: user.id,
    org_id: "00000000-0000-0000-0000-000000000001",
    city: "Chennai", state: "Tamil Nadu", pincode: "600037",
    gender, dob,
    whatsapp_opt_in: user.user_metadata?.whatsapp_opt_in ?? true,
    whatsapp_opt_in_at: (user.user_metadata?.whatsapp_opt_in ?? true) ? new Date().toISOString() : null,
  }).select("id,full_name,customer_code,vision_id,phone,email,dob,gender").single();
  return data;
}