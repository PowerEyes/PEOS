-- Branch-private money data must stay branch-scoped (see 20261126000000:
-- "cashbook, expenses, day closing, purchases, credit notes, stock movements
-- stays branch-scoped"). The generic perm_read policies added by 20261122010000
-- only checked the organisation, so a branch manager with the finance permission
-- could read every branch's money data in the company — RLS ORs the permissive
-- policies, which made the branch-scoped *_rls_sel policies pointless.
--
-- Keep the original shape (org match + permission) and add the branch boundary for
-- signed-in users. Owners and admins pass can_access_branch() for every branch in
-- their organisation; the null-org path (public storefront context) is unchanged.
drop policy if exists perm_read on public.cashbook;
create policy perm_read on public.cashbook as permissive for select
  using ((current_org() is null or (has_permission('finance.view') and can_access_branch(branch_id)))
         and org_id = public.request_org());

drop policy if exists perm_read on public.day_closings;
create policy perm_read on public.day_closings as permissive for select
  using ((current_org() is null or (has_permission('finance.view') and can_access_branch(branch_id)))
         and org_id = public.request_org());

drop policy if exists perm_read on public.expenses;
create policy perm_read on public.expenses as permissive for select
  using ((current_org() is null or (has_permission('expenses.manage') and can_access_branch(branch_id)))
         and org_id = public.request_org());

drop policy if exists perm_read on public.purchase_invoices;
create policy perm_read on public.purchase_invoices as permissive for select
  using ((current_org() is null or (has_permission('purchases.manage') and can_access_branch(branch_id)))
         and org_id = public.request_org());
