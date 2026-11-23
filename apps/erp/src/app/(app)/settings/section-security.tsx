"use client";

export default function SectionSecurity() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-navy-900">Security Settings</h3>
      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" defaultChecked className="w-4 h-4" />
          <span className="text-sm">Require password change every 90 days</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" defaultChecked className="w-4 h-4" />
          <span className="text-sm">Enable two-factor authentication (2FA)</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4" />
          <span className="text-sm">Restrict login to company IP addresses</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" defaultChecked className="w-4 h-4" />
          <span className="text-sm">Log all admin actions (audit trail)</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4" />
          <span className="text-sm">Auto-logout after 30 minutes of inactivity</span>
        </label>
      </div>
      <button className="btn btn-primary">Save Security Settings</button>
    </div>
  );
}