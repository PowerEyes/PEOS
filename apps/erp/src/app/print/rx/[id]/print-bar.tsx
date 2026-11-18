"use client";
import { Printer } from "lucide-react";
export function PrintBar() {
  return <div className="mx-auto mb-4 flex w-[210mm] justify-end print:hidden"><button onClick={() => window.print()} className="btn btn-primary"><Printer size={16} />Print A5</button></div>;
}
