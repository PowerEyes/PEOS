
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Heart, ShoppingBag, User, Menu, X, ChevronDown, ChevronRight, Star, LogOut } from "lucide-react";
import { useCart } from "@/lib/cart";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { useChrome } from "@/components/chrome";
import { DEFAULT_NAV, DEFAULT_ANNOUNCEMENT, DEFAULT_LOGO, type NavItem } from "@/lib/chrome-data";
import { siteImgUrl } from "@/lib/types";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";

// Mega-menu columns are hardcoded (see chrome-data.ts) and re-attached by
// label, so a nav row renamed in the ERP simply loses its dropdown instead of
// pointing at the wrong one.
const MEGA_BY_LABEL = new Map(DEFAULT_NAV.filter(n => n.mega).map(n => [n.label, n.mega as string[][]]));

type Suggestion = { id:string; brand:string|null; model:string; selling_price:number; images:string[]; kind:string };

type QuickLink = { label:string; sub:string; href:string; emoji:string };
// Navigation shortcuts mixed into the autocomplete dropdown: category jumps,
// shape shortcuts and direct links (Book Eye Test, Track Order).
const QUICK_LINKS: QuickLink[] = [
  { label:"Eyeglasses",       sub:"Category → browse all frames",   href:"/eyeglasses",               emoji:"👓" },
  { label:"Sunglasses",       sub:"Category → UV & style",          href:"/sunglasses",               emoji:"🕶️" },
  { label:"Contact Lenses",   sub:"Category → daily & monthly",     href:"/contact-lenses",           emoji:"👁️" },
  { label:"Computer Glasses", sub:"Category → blue-cut lenses",     href:"/computer-glasses",         emoji:"🖥️" },
  { label:"Kids Eyewear",     sub:"Category → frames for children", href:"/kids",                     emoji:"🧒" },
  { label:"Offers",           sub:"Category → current deals",       href:"/offers",                   emoji:"🎉" },
  { label:"Round Frames",     sub:"Eyeglasses → Round",             href:"/eyeglasses?shape=round",   emoji:"⭕" },
  { label:"Square Frames",    sub:"Eyeglasses → Square",            href:"/eyeglasses?shape=square",  emoji:"🟦" },
  { label:"Cat Eye Frames",   sub:"Eyeglasses → Cat Eye",           href:"/eyeglasses?shape=cat-eye", emoji:"🐱" },
  { label:"Aviator Frames",   sub:"Eyeglasses → Aviator",           href:"/eyeglasses?shape=aviator", emoji:"✈️" },
  { label:"Book Eye Test",    sub:"Quick link → 20-min eye check",  href:"/eye-test",                 emoji:"📅" },
  { label:"Track Order",      sub:"Quick link → order status",      href:"/track-order",              emoji:"📦" },
];

export function Header({ portal = false }: { portal?: boolean }) {
  const pathname = usePathname() || "/";
  const { count } = useCart();
  const { whatsappNumber } = useSite();
  // `null` on a field = an operator hid that section with the eye toggle.
  // `null` on the whole object = this Header is outside ChromeProvider, so it
  // renders the hardcoded defaults rather than nothing at all.
  const chrome = useChrome();
  const ann = chrome ? chrome.announcement : DEFAULT_ANNOUNCEMENT;
  const logo = chrome ? chrome.logo : DEFAULT_LOGO;
  const navRaw = chrome ? chrome.nav : DEFAULT_NAV;
  const NAVLINKS: NavItem[] | null = navRaw
    ? navRaw.map(i => ({ ...i, mega: MEGA_BY_LABEL.get(i.label) }))
    : null;
  const [scrolled, setScrolled] = useState(false);
  const hdrRef = useRef<HTMLElement>(null);
  // Publish the live header height so sticky toolbars (filters) sit exactly beneath the fixed header.
  useEffect(() => { const el = hdrRef.current; if (!el) return; const set = () => document.documentElement.style.setProperty("--hdr", el.offsetHeight + "px"); set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect(); }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mega, setMega] = useState<string|null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocus, setSearchFocus] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", onKey); };
  }, [mobileOpen]);

  // Close search on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocus(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const safe = q.replace(/[^\p{L}\p{N}\s_-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (safe.length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("public_catalog")
        .select("id,brand,model,selling_price,images,kind")
        .or(`model.ilike.%${safe}%,brand.ilike.%${safe}%,sku.ilike.%${safe}%`)
        .limit(8);
      if (!error) setSuggestions((data ?? []) as Suggestion[]);
      else setSuggestions([]);
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }, []);

  function onQueryChange(v: string) {
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(v), 220);
  }

  function goSearch(q: string) {
    if (!q.trim()) return;
    setSearchFocus(false); setSuggestions([]); setQuery(q);
    window.location.href = `/search?q=${encodeURIComponent(q)}`;
  }

  const showDropdown = searchFocus && (suggestions.length > 0 || query.length >= 2);

  // Quick-link matches for the current query (min 2 chars, same as products).
  const q = query.trim().toLowerCase();
  const quick = q.length >= 2
    ? QUICK_LINKS.filter(l => l.label.toLowerCase().includes(q) || l.sub.toLowerCase().includes(q)).slice(0, 4)
    : [];

  return (
    <header ref={hdrRef} className={`sticky top-0 z-40 w-full bg-white transition-shadow ${scrolled ? "shadow-md" : ""}`}>
      {/* Top info bar — the whole bar goes away when `announcement` is hidden */}
      {ann && (
      <div className="bg-navy-900 px-4 py-1.5 text-center text-[11px] text-slate-300">
        <span className="hidden sm:inline">📍 {ann.text} &nbsp;·&nbsp; </span>
        {ann.ctaLabel && <a href={ann.ctaHref || waHref(whatsappNumber)} className="text-gold-400 hover:text-gold-300 transition">💬 {ann.ctaLabel}</a>}
        <span className="float-right hidden gap-4 sm:flex text-slate-400">
          <span>EN</span><span>|</span><span>₹ INR</span>
          <Link href="/store-locator" className="hover:text-gold-400 transition">Find a Store</Link>
        </span>
      </div>)}

      {/* Main header */}
      <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-100 px-4 sm:px-6">
        {/* Logo — an uploaded image replaces the monogram; no image keeps 👁 */}
        {logo && (
        <Link href={pathname === "/store" || pathname.startsWith("/store/") || ["/eyeglasses","/sunglasses","/lenses","/contact-lenses","/kids","/computer-glasses","/accessories","/cart","/checkout","/product","/collections","/search","/offers","/compare","/returns","/track-order"].some((r) => pathname === r || pathname.startsWith(r + "/")) ? "/store" : "/"} className="flex shrink-0 items-center gap-2">
          {logo.image
            ? <img src={siteImgUrl(logo.image)!} alt={logo.imageAlt || logo.title} className="h-10 w-10 shrink-0 rounded-full object-cover"/>
            : <div className="grid h-10 w-10 place-items-center rounded-full bg-navy-900 text-white font-bold text-lg select-none">{logo.icon}</div>}
          <div className="block">
            <p className="font-extrabold text-navy-900 text-sm sm:text-base leading-tight">{logo.title}{logo.badge ? <> <span className="text-gold-500">{logo.badge}</span></> : null}</p>
            <p className="hidden text-[9px] text-slate-400 tracking-widest sm:block">{logo.tagline}</p>
          </div>
        </Link>)}

        {/* Search with autocomplete */}
        <div ref={searchRef} className="relative mx-2 hidden flex-1 max-w-xl lg:block">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-3 text-slate-400 pointer-events-none"/>
            <input
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onKeyDown={e => e.key === "Enter" && goSearch(query)}
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-navy-700 focus:bg-white focus:shadow-sm"
              placeholder="Search frames, sunglasses, lenses, brands..." aria-label="Search eyewear and products" role="combobox" aria-autocomplete="list" aria-expanded={showDropdown} aria-controls="header-search-results-desktop"/>
            {query && (
              <button onClick={() => { setQuery(""); setSuggestions([]); }} className="absolute right-3 top-2.5 rounded-full p-0.5 hover:bg-slate-200 transition">
                <X size={14} className="text-slate-400"/>
              </button>)}
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}} transition={{duration:.14}}
                id="header-search-results-desktop" role="listbox" className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden z-50">
                {searching && <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>}
                {!searching && suggestions.length === 0 && quick.length === 0 && query.length >= 2 && (
                  <div className="px-4 py-4 text-sm text-center text-slate-400">
                    No results for "{query}" &nbsp;·&nbsp;
                    <button onClick={() => goSearch(query)} className="text-navy-700 font-semibold underline">Search all products</button>
                  </div>)}
                {suggestions.map(s => {
                  const img = s.images?.[0] ? `${SUPABASE_URL}/storage/v1/object/public/product-images/${s.images[0]}` : null;
                  return (
                    <a key={s.id} href={`/product/${s.id}`} rel="noopener"
                      onClick={() => setSearchFocus(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100">
                        {img ? <img src={img} alt="" className="h-full w-full object-contain p-1"/> : <span className="text-xl">👓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-900 truncate">{s.brand} {s.model}</p>
                        <p className="text-xs text-slate-500 capitalize">{s.kind?.replace("_"," ")}</p>
                      </div>
                      <p className="text-sm font-bold text-navy-900 shrink-0">₹{Number(s.selling_price).toLocaleString("en-IN")}</p>
                    </a>);})}
                {/* Quick links: categories, shape shortcuts, direct pages */}
                {quick.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick links</p>
                    {quick.map(l => (
                      <a key={l.href} href={l.href} onClick={() => setSearchFocus(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                        <span className="text-lg leading-none">{l.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy-900 truncate">{l.label}</p>
                          <p className="text-[11px] text-slate-400 truncate">{l.sub}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-300"/>
                      </a>))}
                  </div>)}
                {(suggestions.length > 0 || quick.length > 0) && (
                  <button onClick={() => goSearch(query)} className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-semibold text-navy-700 hover:bg-slate-50 border-t border-slate-100 transition">
                    <Search size={14}/>View all results for "{query}"
                  </button>)}
              </motion.div>)}
          </AnimatePresence>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/eye-test" className="hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-navy-700 transition sm:flex items-center gap-1">👁 Book Eye Test</Link>
          <button onClick={() => { setSearchFocus(true); mobileSearchRef.current?.focus(); }} className="rounded-full p-2 hover:bg-slate-100 lg:hidden" aria-label="Search"><Search size={20}/></button>
          <Link href="/my" className="flex flex-col items-center rounded-full p-2 hover:bg-slate-100" aria-label="Account">
            <User size={20}/><span className="text-[9px] text-slate-500 hidden sm:block">Account</span>
          </Link>
          <Link href="/my/wishlist" className="flex flex-col items-center rounded-full p-2 hover:bg-slate-100" aria-label="Wishlist">
            <Heart size={20}/><span className="text-[9px] text-slate-500 hidden sm:block">Wishlist</span>
          </Link>
          <Link href="/cart" className="relative flex flex-col items-center rounded-full p-2 hover:bg-slate-100" aria-label="Cart">
            <ShoppingBag size={20}/>
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-gold-500 text-[9px] font-bold text-white">{count > 9 ? "9+" : count}</span>}
            <span className="text-[9px] text-slate-500 hidden sm:block">Cart</span>
          </Link>
          <button onClick={() => setMobileOpen(true)} className="rounded-full p-2 hover:bg-slate-100 lg:hidden" aria-label="Open navigation menu" aria-expanded={mobileOpen} aria-controls="site-mobile-menu"><Menu size={20}/></button>
        </div>
      </div>

      {/* Unified destinations — Clinical Care, Store and Portal stay visible regardless of shop navigation configuration. */}
      <div className="hidden lg:flex items-center justify-end gap-2 border-b border-slate-100 px-6 py-2 text-xs font-semibold">
        <Link href="/" className={`rounded-full px-3 py-1.5 ${pathname === "/" ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}>Clinical Care</Link>
        <Link href="/store" className={`rounded-full px-3 py-1.5 ${pathname === "/store" || pathname.startsWith("/store/") ? "bg-navy-50 text-navy-800" : "text-slate-600 hover:bg-slate-50"}`}>Optical Store</Link>
        <Link href="/my" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-50">Patient Portal</Link>
      </div>
      {/* Desktop nav — the whole bar is absent when the `nav` section is hidden */}
      {NAVLINKS && (
      <nav className="hidden border-b border-slate-100 lg:flex" onMouseLeave={() => setMega(null)}>
        {/* The mega panel is absolutely positioned below the nav row, so the
            wrapper must not clip it: `overflow-x-auto` would also force
            overflow-y to `auto` (spec) and cut the panel off to the nav's own
            height, turning it into a scrollable box instead of a dropdown.
            Horizontal scrolling stays available while no panel is open. */}
        <div className={`flex items-center px-6 ${mega ? "overflow-visible" : "overflow-x-auto"}`}>
          {NAVLINKS.map(l => (
            <div key={l.label} className="relative shrink-0" onMouseEnter={() => setMega(l.mega ? l.label : null)} onFocus={() => setMega(l.mega ? l.label : null)}>
              <Link href={l.href} aria-current={pathname === l.href ? "page" : undefined} aria-haspopup={l.mega ? "true" : undefined} aria-expanded={l.mega ? mega===l.label : undefined} className={`flex items-center gap-1 px-3.5 py-3.5 text-[13px] font-medium transition whitespace-nowrap ${mega===l.label || pathname===l.href ? "text-navy-900" : "text-slate-600 hover:text-navy-900"}`}>
                {l.label}{l.mega && <ChevronDown size={12} className={`transition ${mega===l.label?"rotate-180":""}`}/>}
              </Link>
              {mega===l.label && l.mega && (
                <AnimatePresence>
                  <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}} transition={{duration:.16}}
                    className="absolute left-0 top-full z-50 min-w-[480px] rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-100" role="region" aria-label={`${l.label} submenu`}>
                    <div className="grid grid-cols-3 gap-6">
                      {l.mega.map(([title,...items]) => (
                        <div key={title}><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
                          {items.map(i => <Link key={i} href={`${l.href}?filter=${encodeURIComponent(i.toLowerCase())}`} className="block py-1 text-sm text-slate-700 hover:text-navy-900 hover:font-medium transition">{i}</Link>)}
                        </div>))}
                    </div>
                  </motion.div>
                </AnimatePresence>)}
            </div>))}
        </div>
      </nav>)}

      {/* Mobile search row */}
      <div className="border-b border-slate-100 px-4 py-2 lg:hidden">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"/>
          <input
            ref={mobileSearchRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onKeyDown={e=>e.key==="Enter"&&goSearch(query)}
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-navy-700"
            placeholder="Search frames, sunglasses, lenses..." aria-label="Search eyewear and products" role="combobox" aria-autocomplete="list" aria-expanded={showDropdown} aria-controls="header-search-results-mobile"/>
        </div>
        {showDropdown && (suggestions.length > 0 || quick.length > 0) && (
          <div id="header-search-results-mobile" role="listbox" className="mt-2 rounded-xl bg-white border border-slate-100 shadow-lg overflow-hidden">
            {suggestions.slice(0,3).map(s => (
              <a key={s.id} href={`/product/${s.id}`} onClick={()=>setSearchFocus(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                <span className="text-lg">👓</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{s.brand} {s.model}</p></div>
                <p className="text-xs font-semibold text-navy-800">₹{Number(s.selling_price).toLocaleString("en-IN")}</p>
              </a>))}
            {quick.slice(0,3).map(l => (
              <a key={l.href} href={l.href} onClick={()=>setSearchFocus(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                <span className="text-lg leading-none">{l.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{l.sub}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300"/>
              </a>))}
          </div>)}
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={()=>setMobileOpen(false)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}/>
            <motion.div id="site-mobile-menu" role="dialog" aria-modal="true" aria-label={portal ? "Customer account and shopping menu" : "Site navigation menu"} className="absolute right-0 top-0 flex h-full w-80 max-w-[calc(100vw-48px)] flex-col bg-white shadow-2xl" initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",damping:30,stiffness:300}}>
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <span className="font-bold text-navy-900">{portal ? "My Account" : "Menu"}</span>
                <button onClick={()=>setMobileOpen(false)} aria-label="Close navigation menu" className="rounded-full bg-slate-100 p-1.5 hover:bg-slate-200 transition"><X size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {!portal && <div className="mb-3 grid grid-cols-3 gap-2"><Link href="/" onClick={()=>setMobileOpen(false)} className="rounded-xl bg-teal-50 px-2 py-3 text-center text-xs font-semibold text-teal-900">Clinical Care</Link><Link href="/store" onClick={()=>setMobileOpen(false)} className="rounded-xl bg-navy-50 px-2 py-3 text-center text-xs font-semibold text-navy-900">Optical Store</Link><Link href="/my" onClick={()=>setMobileOpen(false)} className="rounded-xl border px-2 py-3 text-center text-xs font-semibold">Patient Portal</Link></div>}
                {portal && PORTAL_NAV.map(({ href, label, icon: I }) => (
                  <Link key={href} href={href} aria-current={pathname===href || (href!=="/my" && pathname.startsWith(`${href}/`)) ? "page" : undefined} onClick={()=>setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname===href || (href!=="/my" && pathname.startsWith(`${href}/`)) ? "bg-navy-50 text-navy-900" : "text-slate-700 hover:bg-navy-50 hover:text-navy-900"}`}>
                    <I size={16} className="shrink-0 text-slate-400"/>{label}
                  </Link>))}
                {portal && (
                  <form action="/api/logout" method="POST" className="pt-1">
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition">
                      <LogOut size={16} className="shrink-0"/>Sign out
                    </button>
                  </form>)}
                {portal && (
                  <div className="border-t border-slate-100 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Shop</div>)}
                {(NAVLINKS ?? []).map(l=>(
                  <Link key={l.label} href={l.href} aria-current={pathname===l.href ? "page" : undefined} onClick={()=>setMobileOpen(false)} className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname===l.href ? "bg-navy-50 text-navy-900" : "text-slate-700 hover:bg-navy-50 hover:text-navy-900"}`}>{l.label}</Link>))}
              </div>
              <div className="border-t border-slate-100 p-4 space-y-2">
                <Link href="/eye-test" onClick={()=>setMobileOpen(false)} className="flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-gold-600 transition">👁 Book Eye Test</Link>
                <a href={waHref(whatsappNumber)} target="_blank" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 transition">💬 WhatsApp Us</a>
                {!portal && <Link href="/track-order" onClick={()=>setMobileOpen(false)} className="block text-center text-xs text-slate-400 hover:underline py-1">Track an order without login</Link>}
              </div>
            </motion.div>
          </div>)}
      </AnimatePresence>

      {/* One-handed Mobile Bottom Navigation Bar (Fixed on mobile phones/tablets < lg) */}
      <nav aria-label="Mobile Bottom Navigation" className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)] print:hidden">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <Link href={pathname === "/store" || pathname.startsWith("/store/") || ["/eyeglasses","/sunglasses","/lenses","/contact-lenses","/kids","/computer-glasses","/accessories","/cart","/checkout","/product","/collections","/search","/offers","/compare","/returns","/track-order"].some((r) => pathname === r || pathname.startsWith(r + "/")) ? "/store" : "/"} className="flex flex-col items-center justify-center py-1 px-3 text-slate-600 hover:text-navy-900 transition active:scale-95">
            <span className="text-lg leading-none">🏠</span>
            <span className="text-[10px] font-medium mt-0.5">Home</span>
          </Link>
          <Link href="/store" className="flex flex-col items-center justify-center py-1 px-3 text-slate-600 hover:text-navy-900 transition active:scale-95">
            <span className="text-lg leading-none">👓</span>
            <span className="text-[10px] font-medium mt-0.5">Shop</span>
          </Link>
          <Link href="/my/wishlist" className="flex flex-col items-center justify-center py-1 px-3 text-slate-600 hover:text-navy-900 transition active:scale-95">
            <Heart size={18} />
            <span className="text-[10px] font-medium mt-0.5">Wishlist</span>
          </Link>
          <Link href="/cart" className="relative flex flex-col items-center justify-center py-1 px-3 text-slate-600 hover:text-navy-900 transition active:scale-95">
            <ShoppingBag size={18} />
            {count > 0 && (
              <span className="absolute top-0 right-2 grid h-4 w-4 place-items-center rounded-full bg-gold-500 text-[9px] font-bold text-white shadow-sm">
                {count > 9 ? "9+" : count}
              </span>
            )}
            <span className="text-[10px] font-medium mt-0.5">Bag</span>
          </Link>
          <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center py-1 px-3 text-slate-600 hover:text-navy-900 transition active:scale-95">
            <Menu size={18} />
            <span className="text-[10px] font-medium mt-0.5">Menu</span>
          </button>
        </div>
      </nav>
    </header>);
}
