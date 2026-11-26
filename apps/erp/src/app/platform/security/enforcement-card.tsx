"use client";
import { useState, useTransition } from "react";
import { setEntitlementEnforcement } from "../actions";

/**
 * Rollout control for plan 9.5: a fresh install ships log-only so a
 * mis-calculated entitlement can never lock a customer out of their own
 * business; flip to enforce once the violations have been validated.
 */
export function EnforcementCard({ mode }: { mode: string }) {
  const [cur, setCur] = useState(mode);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const enforcing = cur === "enforce";

  const set = (m: "log" | "enforce") => {
    if (m === cur || pending) return;
    setMsg({});
    start(async () => {
      const r = await setEntitlementEnforcement(m);
      setMsg(r);
      if (r.ok) setCur(m);
    });
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-navy-900">Entitlement enforcement</h3>
          <p className="mt-1 text-sm text-slate-500">
            {enforcing
              ? "Blocked writes are refused at the server action and the database."
              : "Log-only: blocked writes are recorded in the audit log and allowed through."}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs ${
            enforcing ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {enforcing ? "Enforce" : "Log-only"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || enforcing}
          onClick={() => set("enforce")}
          className="btn bg-gold-500 text-slate-950 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Turn on enforcement"}
        </button>
        <button
          type="button"
          disabled={pending || !enforcing}
          onClick={() => set("log")}
          className="btn btn-ghost disabled:opacity-50"
        >
          Switch to log-only
        </button>
      </div>

      {msg.error && <p className="mt-2 text-xs text-rose-400">{msg.error}</p>}
      {msg.ok && <p className="mt-2 text-xs text-emerald-400">{msg.ok}</p>}
    </div>
  );
}
