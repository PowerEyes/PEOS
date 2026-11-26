import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCustomerOrCreate } from "@/lib/customer";

export async function POST(request: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Signup passes its WhatsApp opt-in preference along with the link call so
  // the preference is stored even if the client-side update didn't stick
  // (e.g. the customer row only exists after this call). Older callers send
  // no body — then nothing is touched.
  let whatsappOptIn: boolean | null = null;
  let gender: string | null = null;
  let dob: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.whatsappOptIn === "boolean") whatsappOptIn = body.whatsappOptIn;
    if (typeof body?.gender === "string" && (body.gender === "male" || body.gender === "female")) gender = body.gender;
    if (typeof body?.dob === "string" && body.dob) dob = body.dob;
  } catch { /* no JSON body */ }

  const customer = await getCustomerOrCreate({ id: user.id, email: user.email, user_metadata: { ...user.user_metadata, gender, dob, whatsapp_opt_in: whatsappOptIn } });

  if (customer) {
    const patch: any = {};
    if (whatsappOptIn !== null) { patch.whatsapp_opt_in = whatsappOptIn; patch.whatsapp_opt_in_at = whatsappOptIn ? new Date().toISOString() : null; }
    if (gender) patch.gender = gender;
    if (dob) patch.dob = dob;
    if (Object.keys(patch).length) await sb.from("customers").update(patch).eq("id", customer.id);
  }

  return NextResponse.json({ customerId: customer?.id });
}
