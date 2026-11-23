-- Phase 5b: more switchable permissions, enforced in the database.
-- transfers_approve: who may approve a stock transfer (default: branch managers). web_orders: who may move website orders along (default: managers).
create or replace function public.my_permissions() returns text[] language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(p), '{}') from unnest(array['finance_view', 'expenses', 'day_closing', 'catalogue_edit', 'transfers_approve', 'web_orders']) p where public.has_perm(p) $$;

create or replace function public.approve_transfer(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status <> 'requested' then raise exception 'Transfer is not awaiting approval'; end if;
  if not (public.is_manager() and public.can_access_branch(t.from_branch) and public.has_perm('transfers_approve')) then raise exception 'You are not allowed to approve transfers from this branch' using errcode = '42501'; end if;
  if t.requested_by = auth.uid() and not public.is_admin() then raise exception 'You cannot approve your own request' using errcode = '42501'; end if;
  insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, t.product_id, -t.qty, 'transfer_out', 'Transfer ' || t.id);
  update branch_transfers set status = 'in_transit', approved_by = auth.uid(), approved_at = now() where id = t.id;
end $$;

-- Website orders: forward-only fulfilment steps, only for online-paid orders of a branch the caller can write to.
create or replace function public.advance_web_order(p_sale uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare s sales; rank constant text[] := array['lab_pending', 'in_workshop', 'qc', 'ready', 'delivered'];
begin
  if not public.has_perm('web_orders') then raise exception 'You are not allowed to manage website orders' using errcode = '42501'; end if;
  if p_status <> all (rank[2:5]) then raise exception 'Invalid status'; end if;
  select * into s from sales where id = p_sale and org_id = public.current_org() and kind = 'order' for update;
  if not found or not exists (select 1 from online_payments where sale_id = s.id) then raise exception 'Website order not found'; end if;
  if not public.can_access_branch(s.branch_id) then raise exception 'Not authorised for this branch' using errcode = '42501'; end if;
  if array_position(rank, s.status) is null or array_position(rank, p_status) <= array_position(rank, s.status) then raise exception 'Order cannot move to that status' ; end if;
  update sales set status = p_status, updated_at = now() where id = s.id;
end $$;
revoke execute on function public.advance_web_order from anon, public;
grant execute on function public.advance_web_order to authenticated;
