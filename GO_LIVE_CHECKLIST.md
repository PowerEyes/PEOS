# Go-live checklist (must be done by a person, in order)

1. `pnpm install && pnpm build` for both apps — **the code has never been compiled here** (no network). Fix any type errors first.
2. Run all migrations on a Supabase **staging** project, then `node scripts/verify-migrations.mjs`.
3. Set every variable in `.env.example` in Vercel (both apps). Rotate any key that has ever been in a zip/chat.
4. Razorpay: test-mode order → pay → webhook → sale created; then a wrong-amount attempt must be refused.
5. Google Drive: connect, "Back up now", confirm the file appears, download and open it. Then restore it into staging once.
6. Payroll: create a salary, generate a month, finalise, mark paid; log in as that employee and open their payslip.
7. Role tests: log in as each role (owner, admin, branch_manager, staff,
   optometrist, cashier, sales_executive, inventory_manager, lab_technician,
   accountant, receptionist) and confirm they cannot open pages/data outside
   their grant; confirm a second company's data is invisible. `admin` is the
   company-manager tier; `branch_manager` is the branch manager. Assert the
   cashier refund conflict explicitly: `credit_notes.issue` is granted in the
   catalogue but the owner/admin write trigger still refuses cashier refunds.
8. Supabase: enable daily backups/PITR, email confirmations, and set Site URL + Redirect URLs. Turn on leaked-password protection.
9. Load/abuse check: hit /api/coupon and /api/checkout repeatedly and confirm 429s.
10. Monitoring: connect Sentry (or Vercel logs alerts) and /api/health uptime check.
