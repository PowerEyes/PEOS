"use client";
import { createContext, useContext, type ReactNode } from "react";

// Client-side access to the public site settings (fed by the root layout).
export type SiteSettings = {
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
  storeName: string;
  branchNames: string[];
  phones: string[];
  hours: string;
};

const SiteCtx = createContext<SiteSettings>({
  whatsappNumber: "",
  instagram: "",
  analyticsId: "",
  storeName: "",
  branchNames: [],
  phones: [],
  hours: "",
});

export function SiteProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}

export function useSite(): SiteSettings {
  return useContext(SiteCtx);
}
