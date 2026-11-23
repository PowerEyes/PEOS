"use client";
import { useState } from "react";

export default function SectionBranding() {
  const [logo, setLogo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0A2240");
  const [accentColor, setAccentColor] = useState("#C48A3F");

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-navy-900">Branding</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Company Logo URL</label>
        <input value={logo} onChange={(e) => setLogo(e.target.value)} className="field w-full" placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Primary Color</label>
          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-10 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Accent Color</label>
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-full h-10 rounded" />
        </div>
      </div>
      <button className="btn btn-primary">Save Branding</button>
    </div>
  );
}