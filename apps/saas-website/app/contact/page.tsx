import { LeadForm } from "./form";
export const metadata = { title: "Get started" };
export default function Contact({ searchParams }: { searchParams: { plan?: string } }) {
  return (<div className="mx-auto max-w-xl px-4 py-14"><h1 className="text-3xl font-bold">Get started</h1><p className="mt-2 text-slate-600">Tell us about your business. We will set up your company and send your owner an invitation.</p><LeadForm plan={(searchParams.plan ?? "").slice(0, 40)} /></div>);
}
