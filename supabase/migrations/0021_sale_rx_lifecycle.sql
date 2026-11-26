-- ── 0021: POS prescription hard-copy gate + sale lifecycle events ─────────────
--
-- Part 1 — sales gain the staff consent attestation used when an order is
--         confirmed WITHOUT a prescription hard copy (the image itself lives
--         on prescriptions.image_path in the private `prescriptions` bucket,
--         already linked via sales.prescription_id / rx_snapshot).
-- Part 2 — prescriptions.source gains 'external' (prescriptions written by an
--         outside practice) + external_practice names the practice.
-- Part 3 — sale_events: customer-visible status history for orders, written
--         by triggers on sales so every lifecycle path is covered
--         (place_sale, advance_lab_orders, deliver_order, cancel_order,
--         markSent, quotation conversion) without touching those functions.
--         Mirrors repair_events (0008) but org_id is copied from the sale row
--         (NOT current_org()) so events also land for web/anon checkouts.
-- Part 4 — RLS: staff org read + customer read of THEIR OWN sale's events,
--         and customer read of their own repair_events (portal timeline on
--         /my/repairs/[id]).

-- ── Part 1: sales consent columns ─────────────────────────────────────────────
alter table sales
  add column if not exists rx_consent boolean not null default false,
  add column if not exists rx_consent_at timestamptz;

-- ── Part 2: external-practice prescriptions ───────────────────────────────────
alter table prescriptions
  add column if not exists external_practice text;

do $$ declare c record; begin
  -- Drop any existing check constraint that validates `source` (auto-named
  -- prescriptions_source_check, or a differently-named manual one), then
  -- re-add with 'external' included.
  for c in
    select conname from pg_constraint
    where conrelid = 'public.prescriptions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.prescriptions drop constraint %I', c.conname);
  end loop;
  alter table public.prescriptions add constraint prescriptions_source_check
    check (source in ('manual','ocr','external'));
end $$;

-- ── Part 3: sale_events + triggers ────────────────────────────────────────────
create table if not exists sale_events (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  sale_id uuid not null references sales(id) on delete cascade,
  from_status text, to_status text not null,
  note text, by_user uuid default auth.uid(), at timestamptz default now());
create index if not exists idx_sale_events_sale on sale_events (sale_id, at);

create or replace function public.sale_events_track() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into sale_events (org_id, sale_id, from_status, to_status, note)
    values (new.org_id, new.id, null, new.status,
            case when new.kind = 'quotation' then 'Quotation created'
                 else 'Order placed' end);
  elsif new.status is distinct from old.status then
    insert into sale_events (org_id, sale_id, from_status, to_status, note)
    values (new.org_id, new.id, old.status, new.status, null);
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.sales'::regclass
                   and tgname = 'trg_sales_events') then
    create trigger trg_sales_events
      after insert or update on public.sales
      for each row execute function public.sale_events_track();
  end if;
end $$;

-- ── Part 4: RLS ───────────────────────────────────────────────────────────────
alter table sale_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sale_events_staff_select') then
    create policy sale_events_staff_select on public.sale_events
      for select using (org_id = public.current_org());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sale_events_customer_select') then
    create policy sale_events_customer_select on public.sale_events
      for select to authenticated
      using (sale_id in (select id from public.sales
                         where customer_id in (select id from public.customers
                                               where auth_user_id = auth.uid())));
  end if;

  -- Portal repair timeline: customers can read the event history of their own
  -- repairs (base policy from 0008 is org-scoped = NULL for customers).
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'repair_events_customer_select') then
    create policy repair_events_customer_select on public.repair_events
      for select to authenticated
      using (repair_id in (select id from public.repairs
                           where customer_id in (select id from public.customers
                                                 where auth_user_id = auth.uid())));
  end if;
end $$;
