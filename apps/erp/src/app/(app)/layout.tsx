import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { TemplatesProvider } from "@/components/templates-context";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // An invited user whose email is now confirmed is granted access here (idempotent, DB-verified).
  await sb.rpc("claim_invitation");
  const { data: perms } = await sb.rpc("my_permissions");
  const [{ data: p }, { data: branches }, { data: tmpls }, settings] = await Promise.all([
    sb.from("profiles").select("full_name, role_key, is_approved, org_id").eq("id", user.id).single(),
    sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.from("message_templates").select("*").order("sort_order"),
    getSettings(),
  ]);
  if (!p?.is_approved) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div className="card max-w-md p-8 space-y-3">
          <h1 className="font-display text-2xl font-semibold">Waiting for approval</h1>
          <p className="text-sm text-slate-500">Your account was created. You need an invitation from an owner or admin to access PowerOS. If you were invited, confirm your email and refresh.</p>
          <a href="/onboarding" className="text-xs underline text-slate-500">Setting up a new organisation?</a>
          <p className="text-xs text-slate-400">After approval, refresh this page.</p>
          <form action="/login" method="get"><button className="btn btn-ghost text-sm">Back to login</button></form>
        </div>
      </main>
    );
  }
  return (
    <TemplatesProvider templates={tmpls ?? []} storeName={branches?.[0]?.name ?? "our store"}>
      <Shell user={{ name: p.full_name ?? user.email!, role: p.role_key, perms: perms ?? [] }} branches={branches ?? []} settings={settings}>
        {children}
      </Shell>
    </TemplatesProvider>
  );
}
