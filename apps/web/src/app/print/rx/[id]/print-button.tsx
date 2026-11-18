"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-800 transition active:scale-[.97]"
    >
      <Printer size={15} /> Print
    </button>
  );
}
