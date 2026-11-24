import { supabaseServer } from "@/lib/supabase/server";

export default async function CommunicationsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Communications</h1>
      <p className="text-sm text-slate-500">WhatsApp, SMS and email management</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center"><p className="text-lg font-semibold text-navy-900">WhatsApp</p><p className="text-sm text-slate-500">Templates & campaigns</p></div>
        <div className="card p-5 text-center"><p className="text-lg font-semibold text-navy-900">SMS</p><p className="text-sm text-slate-500">Text messages</p></div>
        <div className="card p-5 text-center"><p className="text-lg font-semibold text-navy-900">Email</p><p className="text-sm text-slate-500">Email campaigns</p></div>
      </div>
    </div>
  );
}