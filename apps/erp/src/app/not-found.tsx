import Link from "next/link";
export default function NotFound() {
  return (<main className="grid min-h-screen place-items-center bg-canvas p-6">
    <div className="text-center"><p className="font-display text-8xl font-bold text-navy-800">404</p>
      <p className="mt-2 text-xl font-semibold">Page not found</p>
      <p className="mt-1 text-slate-500">This page does not exist or you don&apos;t have permission to see it.</p>
      <Link href="/" className="btn btn-primary mt-6 inline-flex">Go to dashboard</Link></div></main>);
}
