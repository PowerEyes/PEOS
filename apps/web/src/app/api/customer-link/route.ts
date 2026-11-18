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
  try {
    const body = await request.json();
    if (typeof body?.whatsappOptIn === "boolean") whatsappOptIn = body.whatsappOptIn;
  } catch { /* no JSON body */ }

  const customer = await getCustomerOrCreate({ id: user.id, email: user.email, user_metadata: user.user_metadata });

  if (customer && whatsappOptIn !== null) {
    await sb.from("customers").update({
      whatsapp_opt_in: whatsappOptIn,
      whatsapp_opt_in_at: whatsappOptIn ? new Date().toISOString() : null,
    }).eq("id", customer.id);
  }

  return NextResponse.json({ customerId: customer?.id });
}
