import { createBranch } from "./actions";

export default function NewBranchPage({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Create New Branch</h1>
        <p className="text-sm text-slate-500">Add a new store location to your company</p>
      </div>
      {searchParams.e && (
        <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{searchParams.e}</div>
      )}
      <form action={createBranch} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Branch Name *</label>
          <input name="name" required minLength={2} placeholder="e.g., Mogappair East" className="field w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Branch Code *</label>
          <input name="code" required maxLength={12} placeholder="e.g., MPE" className="field w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea name="address" rows={3} placeholder="Full address" className="field w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input name="phone" placeholder="+91 98765 43210" className="field w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Branch GSTIN (optional)</label>
          <input name="gstin" maxLength={15} placeholder="33AAAAA0000A1Z5" className="field w-full" />
        </div>
        <button type="submit" className="btn btn-primary w-full">Create Branch</button>
      </form>
    </div>
  );
}
