import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { createOrganisation } from "./actions";
export default async function Onboarding({ searchParams }: { searchParams: { e?: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await sb.from("profiles").select("is_approved, org_id").eq("id", user.id).maybeSingle();
  if (p?.is_approved && p.org_id) redirect("/");
  return (<main className="grid min-h-screen place-items-center p-6"><form action={createOrganisation} className="card w-full max-w-md space-y-3 p-8">
    <h1 className="font-display text-2xl font-semibold">Set up your organisation</h1>
    <p className="text-sm text-slate-500">You become the owner. Invite your team and add branches afterwards.</p>
    {searchParams.e && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{searchParams.e}</p>}
    <input name="org" required minLength={2} placeholder="Organisation name" className="field w-full" />
    <input name="branch" required minLength={2} placeholder="First branch name" className="field w-full" />
    <input name="code" required maxLength={8} placeholder="Branch code (e.g. MPR)" className="field w-full" />
    <button className="btn btn-primary w-full">Create organisation</button></form></main>);
}
