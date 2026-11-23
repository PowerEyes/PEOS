"use client";
import { useState } from "react";

export default function MaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("PowerOS is currently undergoing maintenance. Please try again later.");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Maintenance Mode</h1>
      <div className="card p-6 space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5" />
          <span className="font-medium">Enable Maintenance Mode</span>
        </label>
        <p className="text-sm text-slate-500">When enabled, all non-admin users will see the maintenance message.</p>
        <div>
          <label className="block text-sm font-medium mb-1">Maintenance Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="field w-full" />
        </div>
        <button className="btn btn-primary">Save Settings</button>
      </div>
    </div>
  );
}