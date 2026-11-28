"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="mt-6 w-full text-left text-sm text-navy-300 hover:text-white"
    >
      ↩ Sign out
    </button>
  );
}
