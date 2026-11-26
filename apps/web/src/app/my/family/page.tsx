import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer";
import Link from "next/link";
import { Users, UserPlus } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
export default async function Page() {
  const site = await getSiteSettings();
  const c = await getCustomer(); if (!c) redirect("/my/login");
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-bold text-navy-900">Family Members</h1>
        <a href={waHref(site.whatsappNumber, "I'd like to add a family member to my account")} target="_blank" className="btn-gold text-sm"><UserPlus size={14}/>Add Member</a></div>
      <div className="card p-6 text-center">
        <Users size={40} className="mx-auto mb-3 text-slate-300"/>
        <p className="font-semibold text-slate-600">Family member management</p>
        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">Add family members to track everyone's prescriptions and eye health in one place. Contact us on WhatsApp to add a family member to your account.</p>
        <a href={waHref(site.whatsappNumber, "I'd like to add a family member to my Vision ID")} target="_blank" className="btn-gold mt-5 inline-flex">💬 Add via WhatsApp</a>
      </div>
    </div>);
}
