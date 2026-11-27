-- Forward hardening: merge the known duplicate customer phone 9000000001.
-- Supplied only. Apply to a disposable/cloned staging database, never to live.
--
-- CUS-0006 is retained as the survivor because it was the original registration
-- (A-01 in docs/PILOT_TEST_WORKBOOK.md); CUS-0007 was created silently by the
-- duplicate-mobile path. The duplicate row is kept for audit history but its
-- phone is cleared to the empty placeholder, which the hardened phone index in
-- 20261207000000_customer_phone_uniqueness.sql deliberately excludes.
--
-- All single-column foreign keys to customers(id) are redirected dynamically so
-- sales, prescriptions, lab orders, notes, loyalty, notifications, document links
-- and patient_customer_id columns follow the survivor. If any redirect would
-- collide with an existing survivor row, the migration aborts with the table and
-- column named; resolve that conflict in staging before continuing.

create table if not exists public.customer_merge_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  survivor_customer_id uuid not null references public.customers(id),
  merged_customer_id uuid not null references public.customers(id),
  survivor_code text not null,
  merged_code text not null,
  phone text not null,
  old_survivor jsonb not null,
  old_merged jsonb not null,
  performed_by uuid,
  performed_at timestamptz not null default now()
);

alter table public.customer_merge_audit enable row level security;

drop policy if exists customer_merge_audit_select on public.customer_merge_audit;
create policy customer_merge_audit_select on public.customer_merge_audit
  for select to authenticated
  using (org_id = public.current_org() and public.is_admin());

grant select on public.customer_merge_audit to authenticated, service_role;

do $$
declare
  v_org uuid;
  v_merge_org uuid;
  v_survivor uuid;
  v_duplicate uuid;
  v_customer_attnum smallint;
  r record;
  v_sql text;
  v_match_count int;
begin
  select org_id into v_org
    from public.customers
   where customer_code = 'CUS-0006' and phone = '9000000001';

  select org_id into v_merge_org
    from public.customers
   where customer_code = 'CUS-0007' and phone = '9000000001';

  if v_org is null and v_merge_org is null then
    raise notice 'skip: duplicate CUS-0006/CUS-0007 phone 9000000001 not present';
    return;
  end if;

  if v_org is null or v_merge_org is null then
    raise exception 'Only one of CUS-0006/CUS-0007 exists with phone 9000000001; merge needs both rows';
  end if;

  if v_org is distinct from v_merge_org then
    raise exception 'CUS-0006 and CUS-0007 belong to different organisations; refusing merge';
  end if;

  select count(*) into v_match_count
    from public.customers
   where org_id = v_org
     and phone = '9000000001'
     and customer_code in ('CUS-0006', 'CUS-0007');

  if v_match_count <> 2 then
    raise exception 'Expected exactly two duplicate customers, found %', v_match_count;
  end if;

  select attnum into v_customer_attnum
    from pg_attribute
   where attrelid = 'public.customers'::regclass
     and attname = 'id'
     and not attisdropped;

  select id into v_survivor
    from public.customers
   where org_id = v_org and customer_code = 'CUS-0006' and phone = '9000000001';

  select id into v_duplicate
    from public.customers
   where org_id = v_org and customer_code = 'CUS-0007' and phone = '9000000001';

  insert into public.customer_merge_audit
    (org_id, survivor_customer_id, merged_customer_id, survivor_code, merged_code,
     phone, old_survivor, old_merged, performed_by)
  select v_org, v_survivor, v_duplicate, 'CUS-0006', 'CUS-0007', '9000000001',
         to_jsonb(s), to_jsonb(d), auth.uid()
    from public.customers s, public.customers d
   where s.id = v_survivor and d.id = v_duplicate;

  for r in
    select distinct n.nspname, c.relname, a.attname
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and c.confrelid = 'public.customers'::regclass
       and c.confkey = array[v_customer_attnum]::smallint[]
       and array_length(c.conkey, 1) = 1
       and k.ord = 1
       and c.conrelid <> 'public.customers'::regclass
  loop
    v_sql := format(
      'update %I.%I set %I = $1 where %I = $2 and %I is distinct from $1',
      r.nspname, r.relname, r.attname, r.attname, r.attname);

    begin
      execute v_sql using v_survivor, v_duplicate;
    exception when unique_violation then
      raise exception 'Customer merge blocked by a unique constraint on %.%.% -- resolve in staging and rerun',
        r.nspname, r.relname, r.attname;
    end;
  end loop;

  -- Self-reference: customers.referred_by_customer.
  update public.customers
     set referred_by_customer = v_survivor
   where referred_by_customer = v_duplicate;

  -- Keep the old row for audit history, but remove it from the active phone
  -- uniqueness domain and make its merged status explicit.
  update public.customers
     set phone = '',
         status = 'merged',
         notes = left(
           coalesce(notes, '') ||
           E'\nMerged into CUS-0006 by 20270101000020_customer_phone_merge.sql', 500)
   where id = v_duplicate;

  if exists (
    select 1
      from public.customers
     where org_id = v_org and phone = '9000000001'
     group by phone
    having count(*) > 1
  ) then
    raise exception 'Duplicate phone 9000000001 still exists after merge';
  end if;

  raise notice 'merged CUS-0007 into CUS-0006 for org %', v_org;
end $$;

-- Keep the hardened phone index authoritative after the merge. Rebuilding it
-- also proves no other active duplicate phone remains in the database.
drop index if exists public.customers_phone_unique;
create unique index customers_phone_unique
  on public.customers (org_id, phone)
 where phone is not null and phone <> '';
