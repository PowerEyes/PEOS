import { createClient } from "@supabase/supabase-js";
const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const anonDb = () => createClient(url(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
/** Service role: server routes only (stores leads, rate limiting). */
export const serviceDb = () => createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
