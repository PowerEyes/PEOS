-- Durable organisation and branch configuration used by ERP, invoices and web.

alter table public.organizations
  add column if not exists legal_name text,
  add column if not exists business_email text,
  add column if not exists business_phone text,
  add column if not exists billing_address text,
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists currency text not null default 'INR',
  add column if not exists financial_year_start_month smallint not null default 4;
alter table public.organizations drop constraint if exists organizations_currency_check;
alter table public.organizations add constraint organizations_currency_check check (currency = 'INR');
alter table public.organizations drop constraint if exists organizations_financial_year_start_month_check;
alter table public.organizations add constraint organizations_financial_year_start_month_check check (financial_year_start_month between 1 and 12);

alter table public.branches
  add column if not exists legal_name text,
  add column if not exists gstin text,
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists invoice_terms text,
  add column if not exists is_default_pickup boolean not null default false,
  add column if not exists image_alt text;
with first_active as (
  select distinct on (org_id) id from public.branches
  where is_active order by org_id, code, id
)
update public.branches b set is_default_pickup=true
from first_active f where b.id=f.id
  and not exists(select 1 from public.branches x where x.org_id=b.org_id and x.is_default_pickup);
create unique index if not exists branches_one_default_pickup
  on public.branches(org_id) where is_default_pickup;
create index if not exists branches_active_pickup on public.branches(org_id,is_active,is_default_pickup);

-- Keep current server-side pricing behavior and the seed defaults aligned.
insert into public.org_settings(org_id,key,value)
select id,'max_staff_discount_pct','10'::jsonb from public.organizations
on conflict(org_id,key) do nothing;
insert into public.org_settings(org_id,key,value)
select id,'quotation_valid_days','14'::jsonb from public.organizations
on conflict(org_id,key) do nothing;
insert into public.org_settings(org_id,key,value)
select id,'lab_lead_days','5'::jsonb from public.organizations
on conflict(org_id,key) do nothing;
insert into public.org_settings(org_id,key,value)
select id,'default_supply_type','"intrastate"'::jsonb from public.organizations
on conflict(org_id,key) do nothing;
insert into public.org_settings(org_id,key,value)
select id,'default_state_of_supply','"Tamil Nadu"'::jsonb from public.organizations
on conflict(org_id,key) do nothing;

create or replace function public.set_default_pickup_branch(p_branch uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.current_org();
begin
  if v_org is null or not public.is_admin() then raise exception 'Only owners and admins can change the pickup branch' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));
  if not exists(select 1 from public.branches where id=p_branch and org_id=v_org and is_active) then raise exception 'Choose an active branch'; end if;
  update public.branches set is_default_pickup=false where org_id=v_org and is_default_pickup and id<>p_branch;
  update public.branches set is_default_pickup=true where org_id=v_org and id=p_branch;
end $$;
revoke all on function public.set_default_pickup_branch(uuid) from public,anon;
grant execute on function public.set_default_pickup_branch(uuid) to authenticated;

create or replace function public.set_branch_active(p_branch uuid,p_active boolean) returns void
language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.current_org(); v_fallback uuid;
begin
  if v_org is null or not public.is_admin() then raise exception 'Only owners and admins can change branch status' using errcode='42501'; end if;
  if p_active is null then raise exception 'Choose an active status'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));
  perform 1 from public.branches where id=p_branch and org_id=v_org for update;
  if not found then raise exception 'Branch not found' using errcode='42501'; end if;
  if p_active then
    update public.branches set is_active=true where id=p_branch and org_id=v_org;
    if not exists(select 1 from public.branches where org_id=v_org and is_default_pickup) then
      update public.branches set is_default_pickup=true where id=p_branch and org_id=v_org;
    end if;
  else
    if (select count(*) from public.branches where org_id=v_org and is_active)>1 then
      if exists(select 1 from public.branches where id=p_branch and org_id=v_org and is_default_pickup) then
        select id into v_fallback from public.branches where org_id=v_org and id<>p_branch and is_active order by code,id limit 1;
        update public.branches set is_default_pickup=false where id=p_branch and org_id=v_org;
        update public.branches set is_default_pickup=true where id=v_fallback;
      end if;
      update public.branches set is_active=false where id=p_branch and org_id=v_org;
    else
      raise exception 'An organisation must keep at least one active branch';
    end if;
  end if;
end $$;
revoke all on function public.set_branch_active(uuid,boolean) from public,anon;
grant execute on function public.set_branch_active(uuid,boolean) to authenticated;

-- A settings-specific audit row avoids assuming org_settings has an id column.
create or replace function public.audit_settings_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_old jsonb; v_new jsonb; v_org uuid;
begin
  if tg_op<>'INSERT' then v_old:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then v_new:=to_jsonb(new); end if;
  v_org:=coalesce((v_new->>'org_id')::uuid,(v_old->>'org_id')::uuid);
  insert into public.audit_log(org_id,user_id,table_name,row_id,action,old_data,new_data)
  values(v_org,auth.uid(),tg_table_name,nullif(coalesce(v_new->>'id',v_old->>'id'),'')::uuid,tg_op,v_old,v_new);
  return coalesce(new,old);
end $$;
drop trigger if exists trg_org_settings_audit on public.org_settings;
create trigger trg_org_settings_audit after insert or update or delete on public.org_settings for each row execute function public.audit_settings_change();
drop trigger if exists trg_branches_settings_audit on public.branches;
create trigger trg_branches_settings_audit after insert or update or delete on public.branches for each row execute function public.audit_row();
drop trigger if exists trg_message_templates_settings_audit on public.message_templates;
create trigger trg_message_templates_settings_audit after insert or update or delete on public.message_templates for each row execute function public.audit_row();
drop trigger if exists trg_loyalty_rules_settings_audit on public.loyalty_rules;
create trigger trg_loyalty_rules_settings_audit after insert or update or delete on public.loyalty_rules for each row execute function public.audit_row();
drop trigger if exists trg_org_domains_settings_audit on public.org_domains;
create trigger trg_org_domains_settings_audit after insert or update or delete on public.org_domains for each row execute function public.audit_row();

create or replace function public.audit_organization_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_log(org_id,user_id,table_name,row_id,action,old_data,new_data)
  values(coalesce(new.id,old.id),auth.uid(),'organizations',coalesce(new.id,old.id),tg_op,
    case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
drop trigger if exists trg_organizations_settings_audit on public.organizations;
create trigger trg_organizations_settings_audit after update on public.organizations for each row execute function public.audit_organization_change();
