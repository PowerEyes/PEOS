
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { MapPin } from "lucide-react";

export default async function AddressesPage() {
  const sb = supabaseServer();
  const {data:{user}} = await sb.auth.getUser();
  if(!user) redirect("/my/login");
  const {data:c} = await sb.from("customers").select("id,full_name,phone,address_line1,city,state,pincode").eq("auth_user_id",user.id).maybeSingle();
  if(!c) redirect("/my/login");

  const hasAddr = c?.address_line1 || c?.city;

  return (
    <PortalLayout activePath="/my/addresses">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 to-violet-500 text-white px-8 py-10 mb-6">
        <h1 className="font-extrabold text-3xl">MY ADDRESSES</h1>
        <p className="text-white/80 mt-1">Manage your delivery addresses for faster checkout.</p>
      </div>
      <div className="flex justify-end mb-4">
        <Link href="/my/profile" className="rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition">+ Add New Address</Link>
      </div>
      {hasAddr ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border-2 border-navy-800 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-navy-50 shrink-0"><MapPin size={18} className="text-navy-800"/></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-navy-900">{c?.full_name}</p>
                    <span className="rounded bg-navy-800 text-white text-[10px] font-bold px-2 py-0.5">Default</span>
                  </div>
                  <p className="text-sm text-slate-600">{[c?.address_line1,c?.city,c?.state,c?.pincode].filter(Boolean).join(", ")}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{c?.full_name} | {c?.phone}</p>
                </div>
              </div>
              <Link href="/my/profile" className="text-sm text-navy-700 font-semibold hover:underline">Edit</Link>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center">
            <MapPin size={24} className="mx-auto text-slate-300 mb-2"/>
            <p className="text-sm text-slate-500">Add another delivery address</p>
            <Link href="/my/profile" className="mt-3 inline-flex rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Add New Address</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
          <MapPin size={40} className="mx-auto mb-3 text-slate-200"/>
          <p className="font-semibold text-slate-600">No addresses saved yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Add your address for faster checkout</p>
          <Link href="/my/profile" className="inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">Add Address</Link>
        </div>
      )}
      <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 space-y-1">
        <p>✓ Saved addresses make checkout faster</p>
        <p>✓ You can store multiple addresses (home, office, etc.)</p>
        <p>✓ Choose your preferred address at checkout</p>
      </div>
    </PortalLayout>
  );
}
