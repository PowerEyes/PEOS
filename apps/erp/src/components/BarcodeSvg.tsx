"use client";
import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";
export function BarcodeSvg({ value, height = 30, width = 1.3, fontSize = 9, displayValue = true, className }: {
  value: string; height?: number; width?: number; fontSize?: number; displayValue?: boolean; className?: string;
}) {
  const r = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!r.current || !value) return;
    try { JsBarcode(r.current, value, { format: "CODE128", height, width, fontSize, margin: 0, displayValue }); }
    catch { /* invalid characters — leave the svg empty rather than crash the printout */ }
  }, [value, height, width, fontSize, displayValue]);
  return <svg ref={r} className={className} />;
}
