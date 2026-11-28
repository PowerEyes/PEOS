import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformSession } from "@/lib/auth";
import LogoutButton from "./logout-button";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getPlatformSession();
  if (!session) redirect("/login");

  return (
    <>
      <nav className="fixed w-64 bg-navy-900 text-white h-full">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center">
              <span className="text-navy-900 font-bold text-xs">PO</span>
            </div>
            <span className="font-bold text-xl">PowerOS</span>
          </div>
          <nav className="space-y-2">
            <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-navy-800 text-white">
              <span>📊</span><span>Dashboard</span>
            </Link>
            <Link href="/organisations" className="flex items-center gap-3 px-3 py-2 rounded-lg text-navy-300 hover:bg-navy-800">
              <span>🏢</span><span>Organisations</span>
            </Link>
            <Link href="/admin/invitations" className="flex items-center gap-3 px-3 py-2 rounded-lg text-navy-300 hover:bg-navy-800">
              <span>👥</span><span>Staff Invitations</span>
            </Link>
            <Link href="/billing" className="flex items-center gap-3 px-3 py-2 rounded-lg text-navy-300 hover:bg-navy-800">
              <span>💳</span><span>Billing</span>
            </Link>
            <Link href="/support" className="flex items-center gap-3 px-3 py-2 rounded-lg text-navy-300 hover:bg-navy-800">
              <span>💬</span><span>Support</span>
            </Link>
          </nav>
          <div className="mt-8 border-t border-navy-800 pt-4">
            <p className="text-xs text-navy-300 truncate">{session.name}</p>
            <p className="text-[10px] text-navy-400 uppercase tracking-wide">{session.role}</p>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <div className="ml-64 p-8">{children}</div>
    </>
  );
}
