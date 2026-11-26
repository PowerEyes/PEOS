"use client";
import { createContext, useContext } from "react";
import type { SiteChrome } from "@/lib/chrome-data";

// Populated once per request by the root layout (the only caller of
// getSiteChrome) and read by <Header/> and <Footer/>. Both are client
// components — Header because it holds search/cart state, Footer because it is
// also rendered from the client `cart` and `checkout` pages and therefore
// cannot be an async Server Component.
//
// `null` means "the whole site is outside the provider" (e.g. a component
// rendered in isolation); callers fall back to their DEFAULT_* constants.
// A field of `null` inside the value means an operator hid that section.
const ChromeCtx = createContext<SiteChrome | null>(null);

export function ChromeProvider({ value, children }: { value: SiteChrome; children: React.ReactNode }) {
  return <ChromeCtx.Provider value={value}>{children}</ChromeCtx.Provider>;
}

export const useChrome = () => useContext(ChromeCtx);
