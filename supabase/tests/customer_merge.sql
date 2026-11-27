-- Post-merge verification for 20270101000020_customer_phone_merge.sql.
-- Run on the disposable staging clone after the merge migration has been applied:
--   psql -v ON_ERROR_STOP=1 -f customer_merge.sql
-- Read-only; wrapped in a transaction so it cannot mutate the clone.

begin;

create or replace function pg_temp.expect_rows(sql text, want int, label text)
returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if;
  raise notice 'ok   %', label;
end $$;

select pg_temp.expect_rows(
  $q$select 1 from public.customers
      where customer_code = 'CUS-0007' and phone = '' and status = 'merged'$q$,
  1, 'CUS-0007 is retained only as a merged audit row');

select pg_temp.expect_rows(
  $q$select 1 from public.customers
      where customer_code = 'CUS-0006' and phone = '9000000001' and status <> 'merged'$q$,
  1, 'CUS-0006 remains the active customer for phone 9000000001');

select pg_temp.expect_rows(
  $q$select 1 from public.customer_merge_audit
      where survivor_code = 'CUS-0006'
        and merged_code = 'CUS-0007'
        and phone = '9000000001'$q$,
  1, 'merge is recorded with both pre-merge customer snapshots');

select pg_temp.expect_rows(
  $q$select 1 from public.customers
      where org_id = (select org_id from public.customers where customer_code = 'CUS-0006')
        and phone = '9000000001'
      group by phone
     having count(*) > 1$q$,
  0, 'no active duplicate phone 9000000001 remains');

select pg_temp.expect_rows(
  $q$select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname = 'customers_phone_unique'$q$,
  1, 'hardened unique phone index exists');

-- Any non-audit row still pointing at the merged customer is a failed redirect.
do $$
declare r record; n int;
begin
  for r in
    select distinct n.nspname, c.relname, a.attname
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and c.confrelid = 'public.customers'::regclass
       and c.conrelid not in ('public.customers'::regclass,
                              'public.customer_merge_audit'::regclass)
       and k.ord = 1
  loop
    execute format(
      'select count(*) from %I.%I where %I = (select id from public.customers where customer_code = $1)',
      r.nspname, r.relname, r.attname) into n using 'CUS-0007';
    if n > 0 then
      raise exception 'FAIL: %.% still references CUS-0007 in % rows', r.nspname, r.relname, r.attname, n;
    end if;
  end loop;
  raise notice 'ok   no business row still references CUS-0007';
end $$;

rollback;
