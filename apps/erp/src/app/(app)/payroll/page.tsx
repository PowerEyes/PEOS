import Link from "next/link";

export default function PayrollPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-navy-900">Payroll</h1>
      <div className="card space-y-3 p-6">
        <p className="font-semibold text-amber-800">Payroll is not enabled for production use.</p>
        <p className="text-sm text-slate-600">The current database does not contain a verified payroll processing model. Salary totals and payment status must not be inferred from staff profile fields. This screen is intentionally read-only until payroll periods, earnings, statutory deductions, approvals and payment reconciliation are implemented and tested.</p>
        <Link href="/staff" className="btn btn-ghost w-fit">Open staff management</Link>
      </div>
    </div>
  );
}
