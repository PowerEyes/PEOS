import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeDocuments } from "@/lib/company-profile";
import { DocsEditor } from "../docs-editor";

export const dynamic = "force-dynamic";

export default async function CompanyDocsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await sb
    .from("org_settings")
    .select("value")
    .eq("key", "company_documents")
    .maybeSingle();
  // Stored rows run through the same normaliser the writer uses: anything
  // invalid reads as empty instead of rendering broken state.
  const docs = normalizeDocuments(row?.value) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs text-slate-400">
          <Link href="/company" className="hover:text-navy-700">Company</Link> / Documents
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl sm:text-3xl font-semibold">
          <FileText size={24} className="text-gold-500" /> Documents
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Licences, registrations and certificates on file for this company
        </p>
      </div>
      <DocsEditor docs={docs} />
    </div>
  );
}
