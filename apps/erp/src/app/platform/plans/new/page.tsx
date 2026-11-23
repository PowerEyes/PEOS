export default function NewPlanPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Create Subscription Plan</h1>
      <form className="card p-6 space-y-4">
        <div><label className="block text-sm font-medium mb-1">Plan Name *</label><input name="name" required className="field w-full" placeholder="e.g., Growth" /></div>
        <div><label className="block text-sm font-medium mb-1">Description</label><textarea name="description" className="field w-full" rows={2} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Monthly Price (₹)</label><input name="monthly_price" type="number" className="field w-full" /></div>
          <div><label className="block text-sm font-medium mb-1">Annual Price (₹)</label><input name="annual_price" type="number" className="field w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Branch Limit</label><input name="branch_limit" type="number" className="field w-full" placeholder="5" /></div>
          <div><label className="block text-sm font-medium mb-1">Employee Limit</label><input name="employee_limit" type="number" className="field w-full" placeholder="25" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Trial Days</label><input name="trial_days" type="number" className="field w-full" placeholder="14" /></div>
        <button type="submit" className="btn btn-primary w-full">Create Plan</button>
      </form>
    </div>
  );
}