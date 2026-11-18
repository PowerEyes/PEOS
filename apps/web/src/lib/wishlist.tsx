"use client";
import { useEffect, useSyncExternalStore } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Wishlist store shared by every product card.
 *
 * - Logged-in customers (auth session with a linked customer record) sync to
 *   the `customer_wishlist` table, which is what /my/wishlist reads.
 * - Guests persist to localStorage so the heart survives refreshes.
 *
 * Module-level store + useSyncExternalStore so all cards stay in sync without
 * a provider; SSR always snapshots an empty list (init runs client-side).
 */
const KEY = "pe_wishlist";

let ids: string[] = [];
let customerId: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  ids = [...ids];
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot() { return ids; }
function getServerSnapshot() { return ids; }

async function init() {
  if (initialized) return;
  initialized = true;
  try {
    const sb = supabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      const { data: cust } = await sb
        .from("customers").select("id")
        .eq("auth_user_id", session.user.id).maybeSingle();
      if (cust) {
        customerId = cust.id;
        const { data: wl } = await sb
          .from("customer_wishlist").select("product_id")
          .eq("customer_id", cust.id);
        ids = (wl ?? []).map((w: any) => w.product_id);
        emit();
        return;
      }
    }
    ids = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    emit();
  } catch { /* first render just shows unhearted */ }
}

async function toggle(id: string) {
  const wasIn = ids.includes(id);
  const next = wasIn ? ids.filter((x) => x !== id) : [...ids, id];
  // Optimistic: flip immediately, roll back if the remote write fails.
  ids = next;
  emit();
  if (customerId) {
    try {
      const sb = supabaseBrowser();
      const q = wasIn
        ? sb.from("customer_wishlist").delete().eq("customer_id", customerId).eq("product_id", id)
        : sb.from("customer_wishlist").insert({ customer_id: customerId, product_id: id });
      const { error } = await q;
      if (error) throw error;
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    } catch {
      ids = wasIn ? [...ids, id] : ids.filter((x) => x !== id);
      emit();
    }
  } else {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }
}

export function useWishlist() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { init(); }, []);
  return {
    ids: list,
    has: (id: string) => list.includes(id),
    toggle: (id: string) => { void toggle(id); },
  };
}
