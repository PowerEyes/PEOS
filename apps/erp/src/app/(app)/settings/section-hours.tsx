"use client";

export default function SectionHours() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-navy-900">Business Hours</h3>
      <p className="text-sm text-slate-500">Set operating hours for each branch</p>
      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
        <div key={day} className="flex items-center gap-4">
          <span className="w-24 text-sm font-medium">{day}</span>
          <input type="time" className="field" defaultValue="09:00" />
          <span className="text-slate-400">to</span>
          <input type="time" className="field" defaultValue="21:00" />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" defaultChecked={day !== "Sunday"} /> Open
          </label>
        </div>
      ))}
      <button className="btn btn-primary">Save Hours</button>
    </div>
  );
}