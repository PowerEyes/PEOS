"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantBreakGlass, revokeBreakGlass } from "../../../actions";

type Msg = { error?: string; ok?: string };

/** Gated entry: type a reason, get a 30-minute grant (recorded in the audit log). */
export function BreakGlassRequest({ orgId }: { orgId: string }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>({});
  const router = useRouter();

  return (
    <div className="max-w-xl space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-sm font-semibold text-slate-200">Request break-glass access</p>
      <p className="text-xs text-slate-400">
        Tell us why these records are needed (support ticket, incident, escalation…). Your name, the company,
        your reason and the time window are written to the platform audit log.
      </p>
      <textarea
        className="input min-h-20 w-full text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Ticket #1234 — customer import reports duplicate Vision IDs, need to inspect affected rows"
      />
      <div className="flex items-center gap-3">
        <button
          disabled={pending || reason.trim().length < 10}
          className="btn bg-amber-500 text-slate-900 disabled:opacity-50"
          onClick={() => {
            setMsg({});
            start(async () => {
              const r = await grantBreakGlass(orgId, reason);
              setMsg(r);
              if (r.ok) router.refresh();
            });
          }}
        >
          Grant access (30 min)
        </button>
        {reason.trim().length > 0 && reason.trim().length < 10 && (
          <span className="text-xs text-slate-500">{10 - reason.trim().length} more characters…</span>
        )}
      </div>
      {msg.error && <p className="text-xs text-rose-400">{msg.error}</p>}
      {msg.ok && <p className="text-xs text-emerald-400">{msg.ok}</p>}
    </div>
  );
}

/** End an active grant before its 30 minutes are up. */
export function BreakGlassRevoke({ grantId, orgId }: { grantId: string; orgId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>({});
  const router = useRouter();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        className="btn btn-ghost text-xs text-rose-400 disabled:opacity-50"
        onClick={() => {
          setMsg({});
          start(async () => {
            const r = await revokeBreakGlass(grantId, orgId);
            setMsg(r);
            if (r.ok) router.refresh();
          });
        }}
      >
        End access now
      </button>
      {msg.error && <span className="text-xs text-rose-400">{msg.error}</span>}
    </span>
  );
}
