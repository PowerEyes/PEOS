-- Phase 1 RBAC: READ WIDE, WRITE NARROW.
--  * Customer-facing history (sales, lines, payments, lab, repairs, eye exams, stock availability) is READABLE across all
--    branches of the organisation, so Branch B can serve a customer who bought at Branch A.
--  * Writing is still limited to branches the user belongs to (home branch, permanent extra branches, or a temporary assignment).
--  * Branch-private money data (cashbook, expenses, day closing, purchases, credit notes, stock movements) stays branch-scoped.
--  * Staff can belong to several branches permanently (profile_branches), managed only through an admin RPC.

-- 1. Permanent multi-branch membership ---------------------------------------------------------------------------
create table if not exists profile_branches (
  profile_id uuid not null references profiles(id) on delete cascade,
  branch_id  uuid not null references branches(id) on delete cascade,
  org_id     uuid not null references organizations(id),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  primary key (profile_id, branch_id));
create index if not exists idx_profile_branches_branch on profile_branches (branch_id);
alter table profile_branches enable row level security;
drop policy if exists pb_sel on profile_branches;
create policy pb_sel on profile_branches for select to authenticated
  using (org_id = public.current_org() and (profile_id = auth.uid() or public.is_manager()));
revoke insert, update, delete on profile_branches from anon, authenticated;   -- writes only via set_profile_branches()

create or replace function public.can_access_branch(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select exists (select 1 from branches br where br.id = b and br.org_id = p.org_id) and (
      p.role_key in ('owner', 'admin') or p.branch_id = b
      or exists (select 1 from profile_branches pb where pb.profile_id = p.id and pb.branch_id = b)
      or exists (select 1 from staff_assignments a where a.profile_id = p.id and a.branch_id = b
                 and a.revoked_at is null and a.starts_at <= now() and a.ends_at > now()))
    from profiles p where p.id = auth.uid() and p.is_approved and not p.deactivated), false) $$;

create or replace function public.set_profile_branches(p_profile uuid, p_branches uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare c profiles; t profiles; b uuid;
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then raise exception 'Only an owner or admin can change branch access' using errcode = '42501'; end if;
  select * into t from profiles where id = p_profile and org_id = c.org_id;
  if not found then raise exception 'Staff member not found'; end if;
  if t.role_key in ('owner', 'admin') then raise exception 'Owners and admins already see every branch'; end if;
  foreach b in array coalesce(p_branches, '{}') loop
    if not exists (select 1 from branches where id = b and org_id = c.org_id and is_active) then raise exception 'Branch not in your organisation'; end if;
  end loop;
  delete from profile_branches where profile_id = p_profile and branch_id <> all (coalesce(p_branches, '{}'));
  insert into profile_branches (profile_id, branch_id, org_id) select p_profile, x, c.org_id from unnest(coalesce(p_branches, '{}')) x
    on conflict do nothing;
  insert into audit_log (org_id, user_id, table_name, action, new_data)
    values (c.org_id, auth.uid(), 'profile_branches', 'set', jsonb_build_object('profile', p_profile, 'branches', p_branches));
end $$;
revoke all on function public.set_profile_branches(uuid, uuid[]) from public, anon;
grant execute on function public.set_profile_branches(uuid, uuid[]) to authenticated;

-- 2. Cross-branch READ for customer history & stock availability ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sales', 'lab_orders', 'repairs', 'eye_examinations', 'stock'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('drop policy if exists %I on %I', t || '_rls_sel', t);
    execute format('create policy %I on %I for select to authenticated using (org_id = public.current_org())', t || '_rls_sel', t);
  end loop;
end $$;

-- 3. Child rows: readable with the parent, but WRITABLE only when the parent's branch is accessible --------------------
do $$
declare r record; chk text;
begin
  for r in select * from (values ('sale_lines', 'sale_id', 'sales'), ('payments', 'sale_id', 'sales'),
                                 ('repair_events', 'repair_id', 'repairs'), ('lab_events', 'lab_order_id', 'lab_orders')) v(t, fk, par) loop
    continue when to_regclass('public.' || r.t) is null;
    chk := format('org_id = public.current_org() and exists (select 1 from %I par where par.id = %I and public.can_access_branch(par.branch_id))', r.par, r.fk);
    execute format('drop policy if exists %I on %I', r.t || '_rls_ins', r.t);
    execute format('create policy %I on %I for insert to authenticated with check (%s)', r.t || '_rls_ins', r.t, chk);
    if r.t in ('sale_lines', 'payments') then
      execute format('drop policy if exists %I on %I', r.t || '_rls_upd', r.t);
      execute format('create policy %I on %I for update to authenticated using (%s) with check (%s)', r.t || '_rls_upd', r.t, chk, chk);
    end if;
  end loop;
end $$;

-- 4. "Customer from another branch" context for the POS banner. SECURITY INVOKER: it only reveals what RLS already allows.
create or replace function public.customer_branch_context(p_customer uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'branches_visited', (select count(distinct s.branch_id) from sales s where s.customer_id = p_customer),
    'sale_count',       (select count(*) from sales s where s.customer_id = p_customer),
    'lifetime_value',   (select coalesce(sum(s.grand_total), 0) from sales s where s.customer_id = p_customer),
    'last_sale',        (select jsonb_build_object('branch_id', s.branch_id, 'branch', b.name, 'at', s.created_at, 'amount', s.grand_total, 'mine', public.can_access_branch(s.branch_id))
                           from sales s join branches b on b.id = s.branch_id where s.customer_id = p_customer order by s.created_at desc limit 1)) $$;
grant execute on function public.customer_branch_context(uuid) to authenticated;
