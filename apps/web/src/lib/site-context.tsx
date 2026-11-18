"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_WA_NUMBER } from "./wa";

// Client-side access to the public site settings (fed by the root layout).
export type SiteSettings = {
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
};

const SiteCtx = createContext<SiteSettings>({
  whatsappNumber: DEFAULT_WA_NUMBER,
  instagram: "",
  analyticsId: "",
});

export function SiteProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}

export function useSite(): SiteSettings {
  return useContext(SiteCtx);
}
