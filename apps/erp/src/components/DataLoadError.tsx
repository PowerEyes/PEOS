"use client";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
export function DataLoadError({ title = "Unable to load page data", message }: { title?: string; message?: string }) {
  const router = useRouter();
  return <section role="alert" className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
    <div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-rose-600" size={20}/><div className="min-w-0"><h2 className="font-semibold text-rose-900">{title}</h2><p className="mt-1 text-sm text-rose-800">{message || "The data could not be loaded. Please retry. Your existing records have not been changed."}</p>
      <button type="button" onClick={() => router.refresh()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RefreshCw size={14}/>Retry loading</button></div></div>
  </section>;
}
