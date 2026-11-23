import { getOrgId, serviceDb } from "./tenant";
import { supabaseServer } from "./supabase/server";
export type CustomerProfile = { id: string; full_name: string; customer_code: string; vision_id: string; phone: string; email: string | null; dob: string | null; gender: string | null; };
export async function getCustomer(): Promise<CustomerProfile | null> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob,gender").eq("auth_user_id", user.id).maybeSingle();
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

  // 2. Link to a customer that already exists (e.g. created by an in-store sale or guest checkout) ONLY when the
  //    login's email is VERIFIED and that row is not yet owned by another login. Never link by phone (unverified,
  //    user-typed) and never take over a row that already has an owner: that would expose someone else's data.
  const orgId = await getOrgId();
  if (email && (user as { email_confirmed_at?: string | null }).email_confirmed_at) {
    const db = serviceDb();
    const { data: match } = await db.from("customers").select("id").eq("org_id", orgId).ilike("email", email).is("auth_user_id", null).order("created_at").limit(1).maybeSingle();
    if (match) {
      const { error } = await db.from("customers").update({ auth_user_id: user.id }).eq("id", match.id).is("auth_user_id", null);
      if (!error) {
        const { data: linked } = await sb.from("customers").select("id,full_name,customer_code,vision_id,phone,email,dob,gender").eq("id", match.id).maybeSingle();
        if (linked) return linked;
      }
    }
  }

  // 3. Create a new customer row.
  const { data } = await sb.from("customers").insert({
    full_name: name, phone, email, auth_user_id: user.id,
    org_id: orgId,
        gender, dob,
    whatsapp_opt_in: user.user_metadata?.whatsapp_opt_in ?? true,
    whatsapp_opt_in_at: (user.user_metadata?.whatsapp_opt_in ?? true) ? new Date().toISOString() : null,
  }).select("id,full_name,customer_code,vision_id,phone,email,dob,gender").single();
  return data;
}
