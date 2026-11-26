"use client";
import { Printer } from "lucide-react";
export function PrintButton({ label = "Print" }: { label?: string }) {
  return <button onClick={() => window.print()} className="btn btn-primary print:hidden"><Printer size={16} />{label}</button>;
}
