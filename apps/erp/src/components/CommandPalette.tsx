"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@poweros/ui";
import { Home, Users, FileText, UserPlus, FilePlus, Search, ShoppingCart, Boxes, Wrench, Glasses, Landmark, CalendarDays, Shield, Settings } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Cmd = { label: string; hint?: string; icon: any; go: string };
const BASE: Cmd[] = [
  { label: "Dashboard",      icon: Home,         go: "/" },
  { label: "Customers",      icon: Users,        go: "/customers" },
  { label: "Prescriptions",  icon: FileText,     go: "/prescriptions" },
  { label: "Appointments",   icon: CalendarDays, go: "/appointments" },
  { label: "POS & Orders",   icon: ShoppingCart, go: "/sales" },
  { label: "Workshop & Lab", icon: Wrench,       go: "/workshop" },
  { label: "Repairs",        icon: Glasses,      go: "/repairs" },
  { label: "Inventory",      icon: Boxes,        go: "/inventory" },
  { label: "Finance",        icon: Landmark,     go: "/finance" },
  { label: "Staff & Users",  icon: Shield,       go: "/staff" },
  { label: "Settings",       icon: Settings,     go: "/settings" },
  { label: "New customer",   icon: UserPlus,     go: "/customers?new=1" },
  { label: "New prescription", icon: FilePlus,   go: "/prescriptions?new=1" },
  { label: "New sale",       icon: ShoppingCart, go: "/sales?new=1" },
  { label: "New repair",     icon: Glasses,      go: "/repairs?new=1" },
  { label: "Book appointment", icon: CalendarDays, go: "/appointments?new=1" },
  { label: "Add product",    icon: Boxes,        go: "/inventory?new=1" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<Cmd[]>([]); const [i, setI] = useState(0);
  const router = useRouter();
  useEffect(() => { if (!open) { setQ(""); setFound([]); setI(0); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(async () => {
      const s = q.trim().replace(/[%,]/g, "");
      const { data } = await supabaseBrowser()
        .from("customers")
        .select("id, full_name, phone, vision_id")
        .or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,vision_id.ilike.%${s}%`)
        .limit(5);
      setFound((data ?? []).map((c) => ({ label: c.full_name, hint: `${c.vision_id} | ${c.phone}`, icon: Users, go: `/customers?open=${c.id}` })));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  const items = useMemo(() => {
    const filtered = BASE.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
    return [...found, ...filtered];
  }, [found, q]);
  const run = (c: Cmd) => { onClose(); router.push(c.go); };
  return (
    <Modal open={open} onClose={onClose} title="Search PowerOS" subtitle="Jump to any page, customer or action">
      <div className="p-4" onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
        if (e.key === "Enter" && items[i]) run(items[i]);
      }}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
            placeholder="Type a name, page or action" className="field pl-9" />
        </div>
        <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto">
          {items.map((c, n) => (
            <li key={c.label + c.go}>
              <button onMouseEnter={() => setI(n)} onClick={() => run(c)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${n === i ? "bg-navy-50" : ""}`}>
                <c.icon size={16} className="shrink-0 text-gold-500" />
                <span className="flex-1 font-medium">{c.label}</span>
                {c.hint && <span className="text-xs text-slate-500">{c.hint}</span>}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="p-4 text-center text-sm text-slate-500">Nothing matches &ldquo;{q}&rdquo;.</li>}
        </ul>
      </div>
    </Modal>
  );
}
