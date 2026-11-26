"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";

export type WATemplate = {
  id: string;
  key: string;
  category: string;
  name: string;
  body_auto: string;
  body_staff: string;
  meta_template?: string | null;
  variables: string[];
  sort_order: number;
  is_active: boolean;
};

type Ctx = { templates: WATemplate[]; storeName: string };

const TemplatesCtx = createContext<Ctx>({ templates: [], storeName: "our store" });

export function TemplatesProvider({ templates, storeName, children }: {
  templates: WATemplate[]; storeName: string; children: ReactNode;
}) {
  const value = useMemo(() => ({ templates, storeName }), [templates, storeName]);
  return <TemplatesCtx.Provider value={value}>{children}</TemplatesCtx.Provider>;
}

export function useTemplates(): Ctx {
  return useContext(TemplatesCtx);
}

// Replace [Name]-style placeholders; unknown/blank vars stay as-is so staff can see what to fill.
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\[([^\]]+)\]/g, (m, k) => (vars[k] !== undefined && vars[k] !== "" ? vars[k] : m));
}

// Keep the requested order, drop inactive/missing templates.
export function pickTemplates(all: WATemplate[], keys: string[]): WATemplate[] {
  const out: WATemplate[] = [];
  for (const k of keys) {
    const t = all.find((x) => x.key === k);
    if (t && t.is_active) out.push(t);
  }
  return out;
}
