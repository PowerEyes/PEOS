import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function LpimsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: lenses } = await sb.from("lens_inventory").select("*").eq("tenant_id", profile?.tenant_id).limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">LPIMS — Lens Power Inventory</h1>
          <p className="text-sm text-slate-500">Lens prescription and recommendation management</p>
        </div>
        <Link href="/lpims/search" className="btn btn-primary">Search Lens Power</Link>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">Lens Inventory Overview</h3>
        <p className="text-sm text-slate-500">{lenses?.length || 0} lens items in stock</p>
      </div>
    </div>
  );
}