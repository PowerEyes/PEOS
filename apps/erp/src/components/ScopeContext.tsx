"use client";
import { createContext, useContext } from "react";
const Ctx = createContext<string | null>(null);
/** Current branch scope (null = all branches) for client components. UI filter only; the database enforces access. */
export const ScopeProvider = Ctx.Provider;
export const useScope = () => useContext(Ctx);
