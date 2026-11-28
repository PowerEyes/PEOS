-- Forward hardening: resolve the Rx approval trigger conflict.
-- Supplied only; apply to a disposable/cloned staging database, never to live.
--
-- Decision: strict approval wins, hardened with the expiry/status checks from the
-- newer tolerant trigger. The tolerant trg_sales_rx_valid is disabled (definition
-- retained) and one org-scoped table-boundary gate remains on public.sales.
-- Historical Rx already used by a placed sale can be backfilled only through the
-- audited function below; the root/RLS-off approval scripts are retired.

-- ── 1. Retire the tolerant trigger, preserving its definition ─────────────────
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.sales'::regclass
      and tgname = 'trg_sales_rx_valid'
      and not tgisinternal
  ) then
    execute 'alter table public.sales disable trigger trg_sales_rx_valid';
  end if;
end $$;

comment on function public.sales_rx_valid() is
  'DEPRECATED by 20270101000010_prescription_approval_resolution.sql; trg_sales_rx_valid is disabled. Approval is enforced by require_approved_sale_prescription().';

insert into public.audit_log (org_id, table_name, action, new_data)
values (
  null,
  'sales',
  'RX_POLICY_HARDENING',
  jsonb_build_object(
    'migration', '20270101000010_prescription_approval_resolution.sql',
    'authoritative_trigger', 'trg_sales_require_approved_prescription',
    'disabled_trigger', 'trg_sales_rx_valid',
    'rule', 'same-org, active, unexpired, approved by an active authorised reviewer',
    'reason', 'single table-boundary gate covering quotations and orders'
  )
);

-- ── 2. One authoritative sales/Rx gate ───────────────────────────────────────
create or replace function public.require_approved_sale_prescription()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_valid_till date;
  v_review_status text;
  v_approved_by uuid;
begin
  if new.prescription_id is null then
    return new;
  end if;

  select status, valid_till, review_status, approved_by
    into v_status, v_valid_till, v_review_status, v_approved_by
    from public.prescriptions
   where id = new.prescription_id
     and org_id = new.org_id;

  if not found then
    raise exception 'Prescription is not available to this organisation'
      using errcode = '23503';
  end if;

  if coalesce(v_status, 'active') <> 'active' then
    raise exception 'That prescription is % and cannot be used for a new sale.', v_status;
  end if;

  if v_valid_till is not null and v_valid_till < current_date then
    raise exception 'That prescription expired on %. Renew it before placing a new sale.', v_valid_till;
  end if;

  if v_review_status is distinct from 'approved' or v_approved_by is null then
    raise exception 'An optometrist must approve the prescription before a sale can be created'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_approved_by
       and p.org_id = new.org_id
       and p.is_approved
       and coalesce(p.deactivated, false) = false
       and p.role_key in ('owner', 'admin', 'optometrist')
  ) then
    raise exception 'The prescription approval is not held by an active authorised reviewer in this organisation'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_require_approved_prescription on public.sales;
create trigger trg_sales_require_approved_prescription
  before insert or update of prescription_id, org_id, kind on public.sales
  for each row execute function public.require_approved_sale_prescription();

comment on function public.require_approved_sale_prescription() is
  'Sole Rx sales gate: same-org, active, unexpired, approved by an active owner/admin/optometrist.';

-- ── 3. Direct writes cannot forge approval ───────────────────────────────────
create or replace function public.guard_prescription_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- SECURITY DEFINER reviewers and migration owners are trusted; direct PostgREST
  -- writes always run as anon/authenticated and must use set_prescription_review().
  v_trusted boolean := current_user not in ('anon', 'authenticated', 'public');
begin
  if tg_op = 'INSERT' then
    if not v_trusted
       and (new.review_status = 'approved' or new.approved_by is not null) then
      raise exception 'Use set_prescription_review() to approve a prescription'
        using errcode = '42501';
    end if;

    if new.review_status is distinct from 'approved' then
      new.approved_by := null;
      new.approved_at := null;
    end if;

    return new;
  end if;

  -- A clinical edit invalidates an earlier approval.
  if (old.od_sph, old.od_cyl, old.od_axis, old.od_add,
      old.os_sph, old.os_cyl, old.os_axis, old.os_add,
      old.od_va_dist, old.od_va_near, old.os_va_dist, old.os_va_near,
      old.pd_far, old.pd_near, old.valid_till)
     is distinct from
     (new.od_sph, new.od_cyl, new.od_axis, new.od_add,
      new.os_sph, new.os_cyl, new.os_axis, new.os_add,
      new.od_va_dist, new.od_va_near, new.os_va_dist, new.os_va_near,
      new.pd_far, new.pd_near, new.valid_till) then

    new.review_status := 'pending';
    new.approved_by := null;
    new.approved_at := null;

    insert into public.prescription_audit_log
      (org_id, prescription_id, action, old_values, new_values, performed_by, performed_at, reason)
    values
      (new.org_id, new.id, 'corrected', to_jsonb(old), to_jsonb(new), auth.uid(), now(),
       'Clinical values changed; prior approval reset by 20270101000010_prescription_approval_resolution.sql');
  end if;

  if not v_trusted
     and (new.review_status is distinct from old.review_status
          or new.approved_by is distinct from old.approved_by
          or new.approved_at is distinct from old.approved_at) then
    raise exception 'Use set_prescription_review() to change prescription approval'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prescriptions_guard_review on public.prescriptions;
create trigger trg_prescriptions_guard_review
  before insert or update on public.prescriptions
  for each row execute function public.guard_prescription_review();

-- ── 4. Audited approval RPC for the ERP UI ───────────────────────────────────
create or replace function public.set_prescription_review(
  p_prescription_id uuid,
  p_decision text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prescription public.prescriptions%rowtype;
  v_actor uuid := auth.uid();
  v_role text;
  v_status text;
  v_action text;
begin
  if p_decision not in ('approve', 'reapprove', 'reject', 'request_correction') then
    raise exception 'Unknown prescription review decision: %', p_decision;
  end if;

  select * into v_prescription
    from public.prescriptions
   where id = p_prescription_id
   for update;

  if not found or v_prescription.org_id is distinct from public.current_org() then
    raise exception 'Prescription is not available to this organisation';
  end if;

  select role_key into v_role
    from public.profiles
   where id = v_actor
     and org_id = v_prescription.org_id
     and is_approved
     and coalesce(deactivated, false) = false;

  if coalesce(v_role, '') not in ('owner', 'admin', 'optometrist') then
    raise exception 'Only an approved owner, admin or optometrist can review prescriptions'
      using errcode = '42501';
  end if;

  v_status := case
    when p_decision in ('approve', 'reapprove') then 'approved'
    when p_decision = 'reject' then 'rejected'
    else 'correction_requested'
  end;
  v_action := case
    when p_decision = 'request_correction' then 'corrected'
    else v_status
  end;

  update public.prescriptions
     set review_status = v_status,
         approved_by = case when v_status = 'approved' then v_actor else null end,
         approved_at = case when v_status = 'approved' then now() else null end
   where id = p_prescription_id;

  insert into public.prescription_audit_log
    (org_id, prescription_id, action, old_values, new_values, performed_by, performed_at, reason)
  select v_prescription.org_id, v_prescription.id, v_action,
         to_jsonb(v_prescription),
         to_jsonb(p),
         v_actor, now(), nullif(btrim(coalesce(p_reason, '')), '')
    from public.prescriptions p
   where p.id = p_prescription_id;

  insert into public.audit_log
    (org_id, user_id, table_name, row_id, action, old_data, new_data)
  select v_prescription.org_id, v_actor, 'prescriptions', v_prescription.id,
         'RX_REVIEW_' || upper(p_decision),
         to_jsonb(v_prescription),
         to_jsonb(p)
    from public.prescriptions p
   where p.id = p_prescription_id;

  return jsonb_build_object('id', v_prescription.id, 'review_status', v_status);
end;
$$;

revoke all on function public.set_prescription_review(uuid, text, text) from public, anon;
grant execute on function public.set_prescription_review(uuid, text, text) to authenticated, service_role;

comment on function public.set_prescription_review(uuid, text, text) is
  'Owner/admin/optometrist approval transition with prescription and audit-log entries.';

-- ── 5. Conservative, auditable historical backfill ───────────────────────────
-- Run once in staging as migration owner/service role with an actor map such as
-- '{"<org-uuid>":"<approved same-org reviewer-uuid>"}' and a written reason.
-- It only touches active, unexpired prescriptions that were already attached to
-- a placed sale. Never-used pending, rejected, corrected and expired Rx stay put.
create or replace function public.backfill_legacy_prescription_approvals(
  p_actor_map jsonb,
  p_reason text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rx public.prescriptions%rowtype;
  v_actor uuid;
  v_codes text;
  v_new jsonb;
  v_count int := 0;
begin
  if coalesce(btrim(coalesce(p_reason, '')), '') = '' then
    raise exception 'A written reason is required for the Rx approval backfill';
  end if;

  for v_rx in
    select p.*
      from public.prescriptions p
     where p.status = 'active'
       and (p.review_status is distinct from 'approved' or p.approved_by is null)
       and (p.valid_till is null or p.valid_till >= current_date)
       and exists (select 1 from public.sales s where s.prescription_id = p.id)
     order by p.org_id, p.rx_code
     for update of p
  loop
    v_actor := nullif(p_actor_map ->> v_rx.org_id::text, '')::uuid;

    if v_actor is null then
      raise exception 'No approver mapped for organisation %', v_rx.org_id;
    end if;

    if not exists (
      select 1
        from public.profiles pr
       where pr.id = v_actor
         and pr.org_id = v_rx.org_id
         and pr.is_approved
         and coalesce(pr.deactivated, false) = false
         and pr.role_key in ('owner', 'admin', 'optometrist')
    ) then
      raise exception 'Mapped approver % is not an active authorised reviewer for organisation %', v_actor, v_rx.org_id;
    end if;

    select string_agg(s.code, ', ' order by s.code) into v_codes
      from public.sales s
     where s.prescription_id = v_rx.id;

    update public.prescriptions
       set review_status = 'approved',
           approved_by = v_actor,
           approved_at = now()
     where id = v_rx.id
    returning to_jsonb(prescriptions) into v_new;

    insert into public.prescription_audit_log
      (org_id, prescription_id, action, old_values, new_values, performed_by, performed_at, reason)
    values
      (v_rx.org_id, v_rx.id, 'approved', to_jsonb(v_rx), v_new, v_actor, now(),
       p_reason || '; legacy Rx already used by sale ' || coalesce(v_codes, 'unknown'));

    insert into public.audit_log
      (org_id, user_id, table_name, row_id, action, old_data, new_data)
    values
      (v_rx.org_id, v_actor, 'prescriptions', v_rx.id,
       'RX_LEGACY_BACKFILL_APPROVED', to_jsonb(v_rx), v_new);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.backfill_legacy_prescription_approvals(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.backfill_legacy_prescription_approvals(jsonb, text)
  to service_role;

comment on function public.backfill_legacy_prescription_approvals(jsonb, text) is
  'One-shot audited legacy Rx approval backfill; service-role/migration owner only.';

-- ── 6. Prescription audit log is append-only ─────────────────────────────────
create or replace function public.prescription_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'prescription_audit_log is append-only';
end;
$$;

drop trigger if exists trg_prescription_audit_immutable on public.prescription_audit_log;
create trigger trg_prescription_audit_immutable
  before update or delete on public.prescription_audit_log
  for each row execute function public.prescription_audit_immutable();

revoke update, delete on public.prescription_audit_log from public, anon, authenticated;
