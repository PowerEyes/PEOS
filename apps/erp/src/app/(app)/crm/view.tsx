
"use client";
import { useState, useTransition } from "react";
import { MessageCircle, Zap, Clock, CheckCircle, XCircle, Bell, Gift, ShoppingCart, Package, Play, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { updateCRMSettings, triggerFunction } from "./actions";

const TEMPLATE_PREVIEW: Record<string,string> = {};

const dStr = (d:string) => d ? new Date(d).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"}) : "—";

export function CRMView({ settings, logs, cronRuns, stats, tplPreview }: any) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [triggering, setTriggering]     = useState<string|null>(null);
  const [trigMsg, setTrigMsg]           = useState("");
  const [,start] = useTransition();

  async function trigger(fn: string) {
    setTriggering(fn); setTrigMsg("");
    const r = await triggerFunction(fn);
    setTriggering(null);
    setTrigMsg(r.ok ? `✓ ${fn} ran: ${JSON.stringify(r.result)}` : `✗ ${r.error ?? "Failed"}`);
    setTimeout(()=>setTrigMsg(""),8000);
  }

  const AUTOMATIONS = [
    { id:"rx-expiry-reminder",  label:"Rx Expiry Reminder",   icon:Bell,         color:"bg-purple-50 text-purple-700 border-purple-100", stat:stats.rxReminders, next:"Daily 9:00 AM", enabled:settings?.rx_reminder_enabled },
    { id:"birthday-greeting",   label:"Birthday Greetings",    icon:Gift,         color:"bg-rose-50 text-rose-700 border-rose-100",       stat:stats.birthdays,   next:"Daily 9:00 AM", enabled:settings?.birthday_enabled },
    { id:"order-whatsapp",      label:"Order Status Updates",  icon:Package,      color:"bg-blue-50 text-blue-700 border-blue-100",       stat:stats.orderUpdates,next:"On status change",enabled:settings?.order_updates_enabled },
    { id:"abandoned-cart",      label:"Cart Recovery",         icon:ShoppingCart, color:"bg-amber-50 text-amber-700 border-amber-100",    stat:stats.cartRecovery,next:"Every 4 hours",  enabled:settings?.cart_recovery_enabled },
  ];

  const catColor: Record<string,string> = {
    rx_expiry:"text-purple-600 bg-purple-50", birthday:"text-rose-600 bg-rose-50",
    order_update:"text-blue-600 bg-blue-50",  cart_recovery:"text-amber-600 bg-amber-50",
    manual:"text-slate-600 bg-slate-50",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><MessageCircle size={20}/>CRM Automation</h1>
          <p className="text-sm text-slate-500 mt-0.5">WhatsApp automations for customer engagement and retention.</p>
        </div>
        <button onClick={()=>setSettingsOpen(o=>!o)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          <Settings size={15}/>{settingsOpen ? "Hide Settings" : "Settings"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l:"Rx Reminders Sent", v:stats.rxReminders,    cls:"bg-purple-50 text-purple-700" },
          { l:"Birthdays Sent",    v:stats.birthdays,       cls:"bg-rose-50 text-rose-700" },
          { l:"Order Updates",     v:stats.orderUpdates,    cls:"bg-blue-50 text-blue-700" },
          { l:"Cart Recoveries",   v:stats.cartRecovery,    cls:"bg-amber-50 text-amber-700" },
        ].map(s=>(
          <div key={s.l} className={`rounded-2xl border p-4 ${s.cls}`}>
            <p className="font-extrabold text-2xl">{s.v.toLocaleString()}</p>
            <p className="text-xs font-medium mt-0.5">{s.l}</p>
          </div>))}
      </div>

      {/* Pending action alerts */}
      {(stats.rxDueSoon > 0 || stats.abandonedCarts > 0 || stats.failed > 0) && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1.5 text-sm text-amber-800">
          <p className="font-bold">Needs attention</p>
          {stats.rxDueSoon > 0     && <p>· {stats.rxDueSoon} prescriptions expiring in the next 30 days</p>}
          {stats.abandonedCarts > 0 && <p>· {stats.abandonedCarts} abandoned carts waiting for recovery</p>}
          {stats.failed > 0         && <p>· {stats.failed} failed message deliveries — check phone numbers and WhatsApp API credentials</p>}
        </div>)}

      {/* Automation cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {AUTOMATIONS.map(a => (
          <div key={a.id} className={`rounded-2xl border p-5 ${a.color}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <a.icon size={18}/>
                <div>
                  <p className="font-bold text-sm">{a.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">Next run: {a.next}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.enabled?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>
                  {a.enabled ? "Active" : "Disabled"}
                </span>
                <span className="font-bold text-lg">{a.stat}</span>
              </div>
            </div>
            <button onClick={()=>trigger(a.id)} disabled={triggering===a.id}
              className="flex items-center gap-1.5 rounded-lg bg-white/60 border border-current/20 px-3 py-1.5 text-xs font-bold hover:bg-white/80 transition disabled:opacity-40">
              <Play size={12}/>{triggering===a.id?"Running…":"Test Run Now"}
            </button>
          </div>))}
      </div>
      {trigMsg && <div className={`rounded-xl p-3 text-sm font-medium ${trigMsg.startsWith("✓")?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-rose-50 text-rose-700 border border-rose-200"}`}>{trigMsg}</div>}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <p className="font-bold text-slate-800 mb-4">Automation Settings</p>
          <form action={async (fd) => { await updateCRMSettings(fd); }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* WhatsApp provider */}
              <div className="sm:col-span-2 space-y-2 pb-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">WhatsApp Provider</p>
                <div className="flex gap-3">
                  {["meta","interakt","wati"].map(p=>(
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="wa_provider" value={p} defaultChecked={settings?.wa_provider===p} className="accent-navy-700"/>
                      <span className="text-sm capitalize">{p==="meta"?"Meta Cloud API (Official)":p==="interakt"?"Interakt (India)":"WATI"}</span>
                    </label>))}
                </div>
                <p className="text-xs text-slate-400">Set WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID (Meta) or WA_INTERAKT_API_KEY in Supabase Secrets.</p>
              </div>
              {/* Rx reminder */}
              <div className="space-y-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="rx_reminder_enabled" value="true" defaultChecked={settings?.rx_reminder_enabled} className="rounded accent-navy-700"/><span className="text-sm font-medium">Rx Expiry Reminder</span></label>
                <div><p className="text-xs text-slate-500 mb-1">Days before expiry</p>
                  <input type="number" name="rx_reminder_days_before" defaultValue={settings?.rx_reminder_days_before ?? 30} min={1} max={90} className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none"/></div>
              </div>
              {/* Birthday */}
              <div className="space-y-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="birthday_enabled" value="true" defaultChecked={settings?.birthday_enabled} className="rounded accent-navy-700"/><span className="text-sm font-medium">Birthday Greetings</span></label>
                <div><p className="text-xs text-slate-500 mb-1">Coupon discount %</p>
                  <input type="number" name="birthday_coupon_pct" defaultValue={settings?.birthday_coupon_pct ?? 10} min={1} max={50} className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none"/></div>
              </div>
              {/* Order updates */}
              <div>
                <label className="flex items-center gap-2"><input type="checkbox" name="order_updates_enabled" value="true" defaultChecked={settings?.order_updates_enabled} className="rounded accent-navy-700"/><span className="text-sm font-medium">Order Status Updates</span></label>
                <p className="text-xs text-slate-400 mt-1">Sent on: Order Placed, Ready for Pickup, Delivered, Cancelled</p>
              </div>
              {/* Cart recovery */}
              <div className="space-y-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="cart_recovery_enabled" value="true" defaultChecked={settings?.cart_recovery_enabled} className="rounded accent-navy-700"/><span className="text-sm font-medium">Cart Recovery</span></label>
                <div><p className="text-xs text-slate-500 mb-1">Hours before sending</p>
                  <input type="number" name="cart_recovery_hours" defaultValue={settings?.cart_recovery_hours ?? 4} min={1} max={48} className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none"/></div>
              </div>
            </div>
            <button className="rounded-xl bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">Save Settings</button>
          </form>
        </div>)}

      {/* Cron run history */}
      {cronRuns.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
            <Zap size={16} className="text-gold-500"/><p className="font-bold text-slate-800 text-sm">Recent Automation Runs</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {cronRuns.map((r:any) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                {r.status==="completed" ? <CheckCircle size={14} className="text-emerald-500 shrink-0"/> : r.status==="failed" ? <XCircle size={14} className="text-rose-500 shrink-0"/> : <Clock size={14} className="text-amber-500 shrink-0"/>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 capitalize">{r.job_name.replace(/-/g," ")}</p>
                  <p className="text-xs text-slate-400">{dStr(r.started_at)}</p>
                </div>
                <div className="text-right text-xs">
                  {r.messages_sent > 0 && <p className="text-emerald-600 font-medium">{r.messages_sent} sent</p>}
                  {r.messages_failed > 0 && <p className="text-rose-600">{r.messages_failed} failed</p>}
                  {r.error && <p className="text-rose-500 truncate max-w-32" title={r.error}>{r.error}</p>}
                </div>
              </div>))}</div>
        </div>)}

      {/* Recent WhatsApp log */}
      {logs.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5"><p className="font-bold text-slate-800 text-sm">Recent Messages</p></div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {logs.map((l:any) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catColor[l.category]||"bg-slate-50 text-slate-500"}`}>{l.category.replace("_"," ")}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{(l.customers as any)?.full_name ?? l.phone}</p>
                  <p className="text-xs text-slate-400 truncate">{(tplPreview?.[l.template] ?? TEMPLATE_PREVIEW[l.template] ?? l.template).slice(0,60)}…</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${l.status==="sent"||l.status==="delivered"?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-600"}`}>{l.status}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{dStr(l.sent_at)}</p>
                </div>
              </div>))}</div>
        </div>)}
    </div>);
}
