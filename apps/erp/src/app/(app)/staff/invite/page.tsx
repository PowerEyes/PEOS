import { inviteStaff } from "./actions";

export default function InviteStaffPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Invite Employee</h1>
        <p className="text-sm text-slate-500">Add a new team member to your company</p>
      </div>
      <form action={inviteStaff} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name *</label>
          <input name="name" required className="field w-full" placeholder="Employee name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input name="email" type="email" required className="field w-full" placeholder="employee@company.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role *</label>
          <select name="role" required className="field w-full">
            <option value="branch_manager">Branch Manager</option>
            <option value="optometrist">Optometrist</option>
            <option value="sales_executive">Sales Executive</option>
            <option value="cashier">Cashier</option>
            <option value="inventory_manager">Inventory Manager</option>
            <option value="lab_technician">Lab Technician</option>
            <option value="accountant">Accountant</option>
            <option value="receptionist">Receptionist</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Branch *</label>
          <select name="branch_id" required className="field w-full">
            <option value="">Select branch</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary w-full">Send Invitation</button>
      </form>
    </div>
  );
}