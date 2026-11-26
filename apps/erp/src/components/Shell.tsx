"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AppFooter } from "./AppFooter";
import { CommandPalette } from "./CommandPalette";
import { ScopeProvider } from "./ScopeContext";
import { getShellCounts, type ShellCounts } from "@/app/(app)/shell-actions";

export function Shell({ children, user, branches = [], tenantName, scope = null, platform = false, version, webUrl }: {
  children: React.ReactNode; user: { name: string; role: string; perms?: string[] }; branches?: { id: string; name: string }[]; tenantName?: string;
  scope?: string | null; platform?: boolean; version?: string; webUrl?: string; settings?: unknown;
}) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false), [collapsed, setCollapsed] = useState(false), [pal, setPal] = useState(false);
  const [counts, setCounts] = useState<ShellCounts | null>(null), [loading, setLoading] = useState(true);
  useEffect(() => { try { setCollapsed(localStorage.getItem("sidebar-collapsed") === "true"); } catch { /* ignore */ } }, []);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("sidebar-collapsed", String(!c)); } catch { /* ignore */ } return !c; });
  const refresh = useCallback(() => { getShellCounts().then((c) => setCounts(c)).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { refresh(); }, [path, scope, refresh]);
  useEffect(() => { const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal((o) => !o); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const branchLabel = scope ? branches.find((b) => b.id === scope)?.name ?? "Branch" : "All branches";
  return (<div className="flex h-screen overflow-hidden bg-slate-100">
    <Sidebar user={{ role: user.role, perms: user.perms, platform }} tenantName={tenantName} branches={branches} scope={scope} collapsed={collapsed} onToggleCollapse={toggle}
      drawerOpen={drawer} onClose={() => setDrawer(false)} badges={counts?.badges ?? {}} />
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <TopBar user={user} branches={branches} scope={scope} counts={counts} loading={loading} onMenu={() => setDrawer(true)} onToggleCollapse={toggle} onSearch={() => setPal(true)} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"><ScopeProvider value={scope}>{children}</ScopeProvider></main>
      <AppFooter tenantName={tenantName} branchLabel={branchLabel} version={version} webUrl={webUrl} />
    </div>
    <CommandPalette open={pal} onClose={() => setPal(false)} role={user.role} perms={user.perms} />
  </div>);
}
