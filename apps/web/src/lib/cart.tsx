
"use client";
import { createContext, useContext, useEffect, useReducer, useCallback, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const KEY = "pe_cart_v3";

export type CartItem = {
  id: string;           // local UUID
  productId?: string;
  name?: string;        // legacy shape (product page / QuickView)
  productName?: string; // shape used by cart & checkout pages
  brand?: string;
  image?: string;
  framePrice: number;
  lensTotal: number;
  lensPackage?: string;
  lensPackageId?: string;
  lensPackageName?: string;
  lensIndex?: string;
  addons?: string[];
  optionIds?: string[];
  total: number;
  qty: number;
  power_eligible?: boolean;
  rx?: any;
};

type CartState = {
  items: CartItem[];
  coupon: string;
  discount: number;
};

type Action =
  | { type:"LOAD";   items: CartItem[] }
  | { type:"ADD";    item: CartItem }
  | { type:"REMOVE"; id: string }
  | { type:"QTY";    id: string; qty: number }
  | { type:"COUPON"; code: string; discount: number }
  | { type:"CLEAR" };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "LOAD":   return { ...state, items: action.items.map(i => ({ ...i, productName: i.productName ?? i.name })) };
    case "ADD":    return { ...state, items: [...state.items, action.item] };
    case "REMOVE": return { ...state, items: state.items.filter(i => i.id !== action.id) };
    case "QTY":
      if (action.qty <= 0) return { ...state, items: state.items.filter(i => i.id !== action.id) };
      return { ...state, items: state.items.map(i => i.id===action.id ? {...i, qty:action.qty, total:i.framePrice*action.qty+i.lensTotal} : i) };
    case "COUPON": return { ...state, coupon: action.code, discount: action.discount };
    case "CLEAR":  return { items:[], coupon:"", discount:0 };
    default:       return state;
  }
}

type CartCtx = {
  state: CartState;
  add:         (item: CartItem) => void;
  remove:      (id: string)     => void;
  setQty:      (id: string, qty: number) => void;
  applyCoupon: (code: string, discount: number) => void;
  clear:       ()               => void;
  subtotal:    number;
  total:       number;
  count:       number;
  /** true once the saved cart has been read from localStorage — pages use this
   *  to show a skeleton instead of flashing the empty state on first paint. */
  loaded:      boolean;
};

const Ctx = createContext<CartCtx>({} as CartCtx);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items:[], coupon:"", discount:0 });
  const [loaded, setLoaded] = useState(false);

  // ── Load from localStorage on mount ──────────────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(saved) && saved.length) dispatch({ type:"LOAD", items:saved });
    } catch {}
    setLoaded(true);
  }, []);

  // ── Persist to localStorage on every change ───────────────────────────────
  const loadedRef = useRef(false);
  useEffect(() => {
    // Skip the very first run: the load effect above may not have applied yet,
    // and writing [] here would clobber the saved cart.
    if (!loadedRef.current) { loadedRef.current = true; return; }
    try { localStorage.setItem(KEY, JSON.stringify(state.items)); } catch {}
    window.dispatchEvent(new Event("pe_cart"));
  }, [state.items]);

  // ── Cross-tab sync ────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === KEY) {
        try {
          const items = JSON.parse(e.newValue ?? "[]");
          if (Array.isArray(items)) dispatch({ type:"LOAD", items });
        } catch {}
      }
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);

  // ── In-tab sync — components write localStorage directly then fire this ───
  useEffect(() => {
    const reload = () => {
      try {
        const items = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        if (Array.isArray(items)) dispatch({ type:"LOAD", items });
      } catch {}
    };
    window.addEventListener("pe_cart_update", reload);
    return () => window.removeEventListener("pe_cart_update", reload);
  }, []);

  // ── DB sync for logged-in customers (enables abandoned cart automation) ───
  const syncToDb = useCallback(async (items: CartItem[]) => {
    try {
      const sb = supabaseBrowser();
      const { data:{ user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: c } = await sb.from("customers").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
      if (!c) return;
      // Clear existing cart then insert current items
      await sb.from("cart_items").delete().eq("customer_id", c.id).is("notified_at", null);
      if (!items.length) return;
      const rows = items.map(item => ({
        org_id:       c.org_id,
        customer_id:  c.id,
        product_id:   item.productId ?? null,
        product_name: item.productName ?? item.name ?? "",
        qty:          item.qty,
        frame_price:  item.framePrice,
        lens_package: item.lensPackage ?? null,
        lens_total:   item.lensTotal,
        total:        item.total,
        rx_data:      item.rx ?? null,
      }));
      await sb.from("cart_items").insert(rows);
    } catch (e) {
      // Silent fail — cart still works from localStorage
    }
  }, []);

  // Debounced DB sync — only sync after 2s of inactivity to avoid hammering
  useEffect(() => {
    const timer = setTimeout(() => syncToDb(state.items), 2000);
    return () => clearTimeout(timer);
  }, [state.items, syncToDb]);

  const subtotal = state.items.reduce((a, i) => a + i.total, 0);
  const total    = Math.max(0, subtotal - state.discount);
  const count    = state.items.reduce((a, i) => a + i.qty, 0);

  const add         = (item: CartItem)             => dispatch({ type:"ADD",    item });
  const remove      = (id: string)                 => dispatch({ type:"REMOVE", id });
  const setQty      = (id: string, qty: number)    => dispatch({ type:"QTY",    id, qty });
  const applyCoupon = (code: string, discount: number) => dispatch({ type:"COUPON", code, discount });
  const clear       = ()                           => dispatch({ type:"CLEAR" });

  return (
    <Ctx.Provider value={{ state, add, remove, setQty, applyCoupon, clear, subtotal, total, count, loaded }}>
      {children}
    </Ctx.Provider>);
}

export const useCart = () => useContext(Ctx);
