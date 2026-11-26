-- ── 0028: Data-integrity fixes — every constraint failure reads like English ──
--
-- Method: every CHECK constraint in `public` was pulled from pg_constraint and
-- compared, one by one, against every app code path that writes to that table
-- (`.insert` / `.update` / `.upsert` / `.rpc` across apps/erp + apps/web, plus
-- every trigger-invoked RPC). Most writers are already guarded by zod enums or
-- clamped inputs; three are not. Those three, plus the message users actually
-- see, are fixed here.
--
-- Applied migrations are never edited — 0001 / 0002 / 0003 are left untouched
-- and superseded by this file.
--
--   1. customers.gender rejected 'other', but apps/web/src/app/my/profile has
--      always offered an "Other" option, so saving a profile blew up with
--      `new row for relation "customers" violates check constraint
--      "customers_gender_check"`.
--
--   2. stock — reported as `new row for relation "stock" violates check
--      constraint "stock_qty_check"`. apply_movement() wrote the new qty
--      straight into `stock`, so ANY movement below zero surfaced as raw
--      Postgres: a negative adjustment on a branch with no stock row yet, a
--      damage/write-off larger than on-hand, or two tills selling the last
--      unit at the same moment. Owner decision: stock still never goes
--      negative — the rule is kept, the wording is not.
--
--   3. prescriptions — od_axis / os_axis are the only Rx columns with a range
--      check, and sph/cyl/add overflow numeric(4,2) (|x| > 99.99) and pd
--      overflows numeric(4,1). Two writers send unclamped free text:
--      QuickCustomer.tsx and appointments/examination-actions.ts (the other
--      three writers — prescriptions/view.tsx, sales/rx-drawer.tsx and the OCR
--      route — already clamp 0..180). Failures read as
--      `prescriptions_od_axis_check` violations or `numeric field overflow`.
--
-- Every range added here is exactly the range the existing constraint/typmod
-- already enforced, so the new triggers can never reject a row that exists.

-- ── Fix 1: customers.gender accepts 'other' ──────────────────────────────────
alter table customers drop constraint if exists customers_gender_check;
alter table customers add constraint customers_gender_check
  check (gender is null or gender in ('male', 'female', 'other'));

-- ── Fix 2: stock — keep "never negative", stop saying "check constraint" ─────
-- Locks the on-hand row first, so two movements for the same product+branch
-- serialise on that lock instead of both reading the same quantity and racing
-- past the check. The BEFORE-write raise is what makes the message ours: the
-- stock_qty_check constraint stays as the backstop for anything that writes
-- around this trigger.
create or replace function public.apply_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cur int;
  v_new int;
begin
  select qty into v_cur
    from stock
   where branch_id = new.branch_id and product_id = new.product_id
     for update;

  if not found then
    if new.delta < 0 then
      raise exception 'Not enough stock: this branch has no stock record for this item yet, so its quantity cannot be reduced by %.', abs(new.delta);
    end if;
    insert into stock (org_id, branch_id, product_id, qty)
    values (new.org_id, new.branch_id, new.product_id, new.delta)
    on conflict (branch_id, product_id) do update set qty = stock.qty + new.delta;
    -- A concurrent movement can land between the SELECT and the INSERT above;
    -- re-read so any shortfall is still reported in these words, not the
    -- constraint's.
    select qty into v_new
      from stock
     where branch_id = new.branch_id and product_id = new.product_id;
    if v_new < 0 then
      raise exception 'Not enough stock: this change would leave % on hand.', v_new;
    end if;
  else
    v_new := v_cur + new.delta;
    if v_new < 0 then
      raise exception 'Not enough stock: % on hand at this branch; this change would take it to %. Stock cannot go below zero.',
        v_cur, v_new;
    end if;
    update stock set qty = v_new
     where branch_id = new.branch_id and product_id = new.product_id;
  end if;
  return new;
end $$;

-- ── Fix 3: prescriptions — friendly axis / magnification / PD errors ─────────
create or replace function public.prescriptions_check_values() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.od_axis is not null and new.od_axis not between 0 and 180 then
    raise exception 'Right eye (OD) axis must be between 0 and 180 — got %.', new.od_axis;
  end if;
  if new.os_axis is not null and new.os_axis not between 0 and 180 then
    raise exception 'Left eye (OS) axis must be between 0 and 180 — got %.', new.os_axis;
  end if;
  if new.od_sph is not null and new.od_sph not between -99.99 and 99.99 then
    raise exception 'Right eye (OD) SPH is out of range (−99.99 to +99.99) — got %.', new.od_sph;
  end if;
  if new.os_sph is not null and new.os_sph not between -99.99 and 99.99 then
    raise exception 'Left eye (OS) SPH is out of range (−99.99 to +99.99) — got %.', new.os_sph;
  end if;
  if new.od_cyl is not null and new.od_cyl not between -99.99 and 99.99 then
    raise exception 'Right eye (OD) CYL is out of range (−99.99 to +99.99) — got %.', new.od_cyl;
  end if;
  if new.os_cyl is not null and new.os_cyl not between -99.99 and 99.99 then
    raise exception 'Left eye (OS) CYL is out of range (−99.99 to +99.99) — got %.', new.os_cyl;
  end if;
  if new.od_add is not null and new.od_add not between -99.99 and 99.99 then
    raise exception 'Right eye (OD) ADD is out of range (−99.99 to +99.99) — got %.', new.od_add;
  end if;
  if new.os_add is not null and new.os_add not between -99.99 and 99.99 then
    raise exception 'Left eye (OS) ADD is out of range (−99.99 to +99.99) — got %.', new.os_add;
  end if;
  if new.pd_far is not null and new.pd_far not between -999.9 and 999.9 then
    raise exception 'Distance PD is out of range (−999.9 to +999.9) — got %.', new.pd_far;
  end if;
  if new.pd_near is not null and new.pd_near not between -999.9 and 999.9 then
    raise exception 'Near PD is out of range (−999.9 to +999.9) — got %.', new.pd_near;
  end if;
  return new;
end $$;

drop trigger if exists trg_rx_values on prescriptions;
create trigger trg_rx_values before insert or update on prescriptions
  for each row execute function prescriptions_check_values();
