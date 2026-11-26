


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."_assert_other_owner"("p_target" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from profiles where org_id = (select org_id from profiles where id = p_target)
       and role_key = 'owner' and is_approved and not deactivated and id <> p_target) then
    raise exception 'An organisation must keep at least one active owner'; end if;
end $$;


ALTER FUNCTION "public"."_assert_other_owner"("p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_set_branches"("p_org" "uuid", "p_user" "uuid", "p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (select 1 from unnest(p_ids) i where not exists (select 1 from branches where id = i and org_id = p_org and is_active)) then
    raise exception 'One or more branches are invalid for this organisation'; end if;
  delete from user_branches where user_id = p_user and kind = 'permanent';
  insert into user_branches (org_id, user_id, branch_id) select p_org, p_user, i from unnest(p_ids) i
    on conflict (user_id, branch_id) do update set kind='permanent', expires_at=null, reason=null;
  update profiles set branch_id = p_ids[1] where id = p_user;
end $$;


ALTER FUNCTION "public"."_set_branches"("p_org" "uuid", "p_user" "uuid", "p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_staff_guard"("p_target" "uuid", "p_new_role" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare me profiles%rowtype; tg profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  if me.id is null or me.role_key not in ('owner','admin') then raise exception 'Only owners and company admins can manage staff' using errcode='42501'; end if;
  select * into tg from profiles where id = p_target;
  if tg.id is null or tg.org_id is distinct from me.org_id then raise exception 'Staff member not found in your organisation' using errcode='42501'; end if;
  if me.role_key = 'admin' and (tg.role_key in ('owner','admin') or p_new_role in ('owner','admin')) and tg.id <> me.id then
    raise exception 'Only an owner can manage owners and company admins' using errcode='42501'; end if;
  if p_new_role is not null and p_new_role not in ('owner','admin','branch_manager','staff') then raise exception 'Unknown role'; end if;
  if p_new_role = 'owner' and me.role_key <> 'owner' then raise exception 'Only an owner can grant owner' using errcode='42501'; end if;
  return me.org_id;
end $$;


ALTER FUNCTION "public"."_staff_guard"("p_target" "uuid", "p_new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_org_domain"("p_domain" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare d text := lower(trim(p_domain));
begin
  if not public.is_admin() then raise exception 'Only owners and admins can manage domains' using errcode = '42501'; end if;
  if d !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' then raise exception 'Enter a valid domain, e.g. shop.example.com'; end if;
  begin insert into org_domains (domain, org_id) values (d, public.current_org());
  exception when unique_violation then raise exception 'That domain is already registered'; end;
end $_$;


ALTER FUNCTION "public"."add_org_domain"("p_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_staff"("p_id" "uuid", "p_role" "text" DEFAULT NULL::"text", "p_branch" "uuid" DEFAULT NULL::"uuid", "p_set_branch" boolean DEFAULT false, "p_deactivated" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare c profiles; t profiles; v_role text; v_deact boolean;
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then raise exception 'Only owners and admins can manage staff' using errcode = '42501'; end if;
  select * into t from profiles where id = p_id and org_id = c.org_id for update;
  if not found then raise exception 'Staff member not found'; end if;
  if t.id = c.id and (p_role is not null or p_deactivated is true) then raise exception 'You cannot change your own role or deactivate yourself'; end if;
  if c.role_key <> 'owner' and (t.role_key in ('owner', 'admin') or p_role in ('owner', 'admin')) then
    raise exception 'Only an owner can manage or grant admin/owner access' using errcode = '42501'; end if;
  if p_role is not null and p_role not in ('owner', 'admin', 'branch_manager', 'staff') then raise exception 'Invalid role'; end if;
  v_role := coalesce(p_role, t.role_key); v_deact := coalesce(p_deactivated, t.deactivated);
  if t.role_key = 'owner' and (v_role <> 'owner' or v_deact) and
     not exists (select 1 from profiles o where o.org_id = t.org_id and o.role_key = 'owner' and o.is_approved and not o.deactivated and o.id <> t.id) then
    raise exception 'An organisation must keep at least one active owner'; end if;
  if p_set_branch and p_branch is not null and not exists (select 1 from branches where id = p_branch and org_id = c.org_id) then
    raise exception 'Branch not in your organisation'; end if;
  update profiles set role_key = v_role, deactivated = v_deact, is_approved = not v_deact,
         branch_id = case when p_set_branch then p_branch else branch_id end,
         branch_reviewed = case when p_set_branch then true else branch_reviewed end where id = t.id;
  if v_deact then update staff_assignments set revoked_at = now(), revoked_by = c.id where profile_id = t.id and revoked_at is null; end if;
end $$;


ALTER FUNCTION "public"."admin_update_staff"("p_id" "uuid", "p_role" "text", "p_branch" "uuid", "p_set_branch" boolean, "p_deactivated" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_lab_orders"("p_ids" "uuid"[], "p_to" "text", "p_note" "text" DEFAULT NULL::"text", "p_supplier" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r lab_orders%rowtype; m int;
begin
  if public.current_org() is null then raise exception 'Only approved staff can update lab orders'; end if;
  for r in select * from lab_orders where id = any(p_ids) and org_id = public.current_org() for update loop
    if not ((r.status, p_to) in (('to_buy','ordered'),('ordered','received'),('received','edging'),('edging','fitting'),('fitting','qc'),('qc','ready'),('qc','fitting'))) then
      raise exception '% cannot move from % to %', r.code, r.status, p_to; end if;
    if p_to = 'ordered' and coalesce(nullif(trim(p_supplier),''), r.supplier_name) is null then raise exception 'Enter the supplier name'; end if;
    if r.status = 'qc' and p_to = 'fitting' and coalesce(trim(p_note),'') = '' then raise exception 'Describe what needs rework'; end if;
    update lab_orders set status = p_to,
      supplier_name = case when p_to = 'ordered' then coalesce(nullif(trim(p_supplier),''), supplier_name) else supplier_name end,
      ordered_at = case when p_to = 'ordered' then now() else ordered_at end, received_at = case when p_to = 'received' then now() else received_at end,
      qc_note = case when r.status = 'qc' and p_to = 'fitting' then p_note else qc_note end where id = r.id;
    insert into lab_events (org_id, lab_order_id, from_status, to_status, note) values (r.org_id, r.id, r.status, p_to, nullif(trim(p_note),''));
    select min(case status when 'to_buy' then 1 when 'ordered' then 2 when 'received' then 3 when 'edging' then 4 when 'fitting' then 5 when 'qc' then 6 else 7 end)
      into m from lab_orders where sale_id = r.sale_id and status not in ('cancelled','delivered');
    update sales set status = case when m = 7 then 'ready' when m = 6 then 'qc' when m >= 4 then 'in_workshop' else 'lab_pending' end
      where id = r.sale_id and status in ('lab_pending','in_workshop','qc','ready');
  end loop;
end $$;


ALTER FUNCTION "public"."advance_lab_orders"("p_ids" "uuid"[], "p_to" "text", "p_note" "text", "p_supplier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_repair"("p_id" "uuid", "p_to" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r repairs%rowtype;
begin
  if public.current_org() is null then raise exception 'Only approved staff can update repairs'; end if;
  select * into r from repairs where id = p_id and org_id = public.current_org() for update;
  if not found then raise exception 'Repair not found'; end if;
  if not ((r.status,p_to) in (('pending','in_progress'),('in_progress','ready'),('ready','delivered'),('pending','cancelled'),('in_progress','cancelled'),('ready','cancelled')))
    then raise exception 'Cannot move repair from % to %', r.status, p_to; end if;
  update repairs set status = p_to where id = p_id;
  insert into repair_events (org_id,repair_id,from_status,to_status,note) values (r.org_id,p_id,r.status,p_to,nullif(trim(coalesce(p_note,'')),''));
end $$;


ALTER FUNCTION "public"."advance_repair"("p_id" "uuid", "p_to" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_web_order"("p_sale" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."advance_web_order"("p_sale" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_branch_scope"("t" "regclass") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
begin
  execute format('drop policy if exists branch_scope on %s', t);
  execute format($f$create policy branch_scope on %s as restrictive for all
    using (public.current_org() is null or branch_id is null or public.can_access_branch(branch_id))
    with check (public.current_org() is null or branch_id is null or public.can_access_branch(branch_id))$f$, t);
  execute format('drop trigger if exists trg_00_branch_scope on %s', t);
  execute format('create trigger trg_00_branch_scope before insert or update or delete on %s for each row execute function public.enforce_branch_scope()', t);
end $_$;


ALTER FUNCTION "public"."apply_branch_scope"("t" "regclass") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_movement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_permission"("t" "text", "p_write" "text", "p_read" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if to_regclass('public.'||t) is null then return; end if;
  execute format('drop trigger if exists trg_01_perm on public.%I', t);
  execute format('create trigger trg_01_perm before insert or update or delete on public.%I for each row execute function public.enforce_permission(%L)', t, p_write);
  if p_read is not null then
    execute format('drop policy if exists perm_read on public.%I', t);
    execute format('create policy perm_read on public.%I as restrictive for select using (public.current_org() is null or public.has_permission(%L))', t, p_read);
  end if;
end $$;


ALTER FUNCTION "public"."apply_permission"("t" "text", "p_write" "text", "p_read" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_org uuid := public.current_org();
  v_role text;
  v_req public.family_member_requests%rowtype;
  v_member public.customers%rowtype;
  v_phone text;
  v_match_count integer;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Authentication and active organisation are required';
  end if;

  select role_key into v_role
  from public.profiles
  where id = auth.uid() and is_approved = true and deactivated = false
    and org_id = v_org;

  if coalesce(v_role, '') not in ('owner','admin') then
    raise exception 'You are not authorised to approve family links';
  end if;

  select * into v_req
  from public.family_member_requests
  where id = p_request_id and org_id = v_org
  for update;

  if not found then raise exception 'Family request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;
  if not exists (select 1 from public.customers where id = v_req.customer_id and org_id = v_org) then
    raise exception 'The requesting customer is no longer valid in this organisation';
  end if;

  v_phone := regexp_replace(coalesce(v_req.member_phone,''), '[^0-9]', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 15 then
    raise exception 'The requested mobile number is invalid. Correct the request before approval.';
  end if;
  select count(*) into v_match_count
  from public.customers c
  where c.org_id = v_org
    and right(regexp_replace(coalesce(c.phone,''), '[^0-9]', '', 'g'), 10) = right(v_phone, 10)
    and lower(trim(c.full_name)) = lower(trim(v_req.member_name));

  if v_match_count = 0 then
    raise exception 'No existing customer matches both the name and phone number. Verify the details in Customers before approving.';
  elsif v_match_count > 1 then
    raise exception 'More than one customer matches these details. Resolve the duplicate records before approving.';
  end if;

  select * into v_member from public.customers c
  where c.org_id = v_org
    and right(regexp_replace(coalesce(c.phone,''), '[^0-9]', '', 'g'), 10) = right(v_phone, 10)
    and lower(trim(c.full_name)) = lower(trim(v_req.member_name))
  limit 1;

  if v_member.id = v_req.customer_id then
    raise exception 'A customer cannot be linked as their own family member';
  end if;

  insert into public.family_members(org_id, primary_customer_id, member_customer_id, relationship, member_label, is_active)
  values (v_org, v_req.customer_id, v_member.id, v_req.relationship, v_member.full_name, true)
  on conflict (primary_customer_id, member_customer_id)
  do update set relationship = excluded.relationship, member_label = excluded.member_label, is_active = true;

  update public.family_member_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = v_req.id;

  return jsonb_build_object(
    'request_id', v_req.id,
    'primary_customer_id', v_req.customer_id,
    'member_customer_id', v_member.id,
    'member_name', v_member.full_name,
    'vision_id', v_member.vision_id
  );
end
$$;


ALTER FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid", "p_member_customer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_request public.family_member_requests%rowtype; v_member public.customers%rowtype;
begin
  if public.current_org() is null or not public.is_admin() then
    raise exception 'Only an organisation administrator can approve family links';
  end if;
  select * into v_request from public.family_member_requests
    where id = p_request_id and org_id = public.current_org() for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Pending family request not found';
  end if;
  select * into v_member from public.customers
    where id = p_member_customer_id and org_id = public.current_org();
  if not found then raise exception 'Customer record not found in this organisation'; end if;
  if regexp_replace(coalesce(v_member.phone,''), '[^0-9]', '', 'g')
     <> regexp_replace(v_request.member_phone, '[^0-9]', '', 'g') then
    raise exception 'The customer mobile number does not match the request';
  end if;
  if v_request.customer_id = v_member.id then raise exception 'A customer cannot be linked to themselves'; end if;
  insert into public.family_members(org_id,primary_customer_id,member_customer_id,relationship,member_label,is_active)
  values (v_request.org_id,v_request.customer_id,v_member.id,v_request.relationship,v_member.full_name,true)
  on conflict (primary_customer_id,member_customer_id)
  do update set relationship=excluded.relationship,member_label=excluded.member_label,is_active=true;
  update public.family_member_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid()
  where id=v_request.id;
end $$;


ALTER FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid", "p_member_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_staff"("p_user" "uuid", "p_role" "text", "p_branch_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid := public._staff_guard(p_user, p_role);
begin
  if not exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
    raise exception 'The staff member must verify their email first'; end if;
  if p_role in ('branch_manager','staff') and coalesce(array_length(p_branch_ids,1),0) = 0 then
    raise exception 'Assign at least one branch'; end if;
  update profiles set is_approved = true, deactivated = false, role_key = p_role where id = p_user;
  if p_role in ('branch_manager','staff') then perform public._set_branches(v_org, p_user, p_branch_ids);
  else delete from user_branches where user_id = p_user and kind = 'permanent'; update profiles set branch_id = null where id = p_user; end if;
end $$;


ALTER FUNCTION "public"."approve_staff"("p_user" "uuid", "p_role" "text", "p_branch_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_stock_transfer"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t stock_transfers%rowtype; r record; v_role text := public.current_role_key();
begin
  select * into t from stock_transfers where id = p_id and org_id = public.current_org() for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'requested' then raise exception 'Transfer is not awaiting approval'; end if;
  if not (v_role in ('owner','admin') or (v_role = 'branch_manager' and public.can_access_branch(t.from_branch))) then
    raise exception 'Only the source branch manager or an admin can approve' using errcode='42501'; end if;
  if t.requested_by = auth.uid() and v_role <> 'owner' then raise exception 'You cannot approve your own request' using errcode='42501'; end if;
  for r in select * from stock_transfer_lines where transfer_id = p_id loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, r.product_id, -r.qty, 'transfer_out', 'Transfer ' || left(p_id::text, 8));
  end loop;
  update stock_transfers set status = 'in_transit', approved_by = auth.uid(), updated_at = now() where id = p_id;
end $$;


ALTER FUNCTION "public"."approve_stock_transfer"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_transfer"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status <> 'requested' then raise exception 'Transfer is not awaiting approval'; end if;
  if not (public.is_manager() and public.can_access_branch(t.from_branch)) then raise exception 'Only a manager of the sending branch can approve' using errcode = '42501'; end if;
  if t.requested_by = auth.uid() and not public.is_admin() then raise exception 'You cannot approve your own request' using errcode = '42501'; end if;
  insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, t.product_id, -t.qty, 'transfer_out', 'Transfer ' || t.id);
  update branch_transfers set status = 'in_transit', approved_by = auth.uid(), approved_at = now() where id = t.id;
end $$;


ALTER FUNCTION "public"."approve_transfer"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_temp_branch"("p_profile" "uuid", "p_branch" "uuid", "p_ends" timestamp with time zone, "p_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare c profiles; t profiles; v_id uuid;
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin', 'branch_manager') then raise exception 'Not authorised to assign staff' using errcode = '42501'; end if;
  select * into t from profiles where id = p_profile and org_id = c.org_id and is_approved and not deactivated;
  if not found then raise exception 'Staff member not found or inactive'; end if;
  if not exists (select 1 from branches where id = p_branch and org_id = c.org_id and is_active) then raise exception 'Branch not in your organisation'; end if;
  if c.role_key = 'branch_manager' and not public.can_access_branch(p_branch) then
    raise exception 'Managers can only bring staff into their own branch' using errcode = '42501'; end if;
  if t.role_key in ('owner', 'admin') then raise exception 'Admins already have access to every branch'; end if;
  insert into staff_assignments (org_id, profile_id, branch_id, ends_at, reason) values (c.org_id, p_profile, p_branch, p_ends, p_reason) returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION "public"."assign_temp_branch"("p_profile" "uuid", "p_branch" "uuid", "p_ends" timestamp with time zone, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin raise exception 'audit_log is append-only'; end $$;


ALTER FUNCTION "public"."audit_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_log_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin raise exception 'audit_log is append-only'; end $$;


ALTER FUNCTION "public"."audit_log_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_row"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into audit_log(org_id,table_name,row_id,action,old_data,new_data)
  values (coalesce(new.org_id,old.org_id), tg_table_name, coalesce(new.id,old.id), tg_op,
          case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;


ALTER FUNCTION "public"."audit_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."branch_overview"() RETURNS TABLE("branch_id" "uuid", "branch" "text", "today_sales" numeric, "today_orders" integer, "month_sales" numeric, "month_orders" integer, "month_collected" numeric, "low_stock" integer, "open_repairs" integer, "lab_pending" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with d as (select (now() at time zone 'Asia/Kolkata')::date as today, date_trunc('month', now() at time zone 'Asia/Kolkata')::date as m0)
  select b.id, b.name,
    coalesce((select sum(s.grand_total) from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date = d.today), 0),
    (select count(*)::int from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date = d.today),
    coalesce((select sum(s.grand_total) from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date >= d.m0), 0),
    (select count(*)::int from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date >= d.m0),
    coalesce((select sum(s.paid_total) from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date >= d.m0), 0),
    (select count(*)::int from stock k where k.branch_id = b.id and k.reorder_level > 0 and k.qty <= k.reorder_level),
    (select count(*)::int from repairs r where r.branch_id = b.id and r.status in ('pending', 'in_progress')),
    (select count(*)::int from sales s where s.branch_id = b.id and s.kind = 'order' and s.status in ('lab_pending', 'in_workshop', 'qc'))
  from branches b where b.org_id = public.current_org() and b.is_active order by b.name $$;


ALTER FUNCTION "public"."branch_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_product_view"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into product_view_counts (product_id, views, today_views, counted_on)
  values (p_id, 1, 1, current_date)
  on conflict (product_id) do update set
    views = product_view_counts.views + 1,
    today_views = case when product_view_counts.counted_on = current_date
                        then product_view_counts.today_views + 1 else 1 end,
    counted_on = current_date,
    updated_at = now();
end $$;


ALTER FUNCTION "public"."bump_product_view"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_branch"("b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select exists (select 1 from branches br where br.id = b and br.org_id = p.org_id) and (
      p.role_key in ('owner', 'admin') or p.branch_id = b
      or exists (select 1 from staff_assignments a where a.profile_id = p.id and a.branch_id = b
                 and a.revoked_at is null and a.starts_at <= now() and a.ends_at > now()))
    from profiles p where p.id = auth.uid() and p.is_approved and not p.deactivated), false) $$;


ALTER FUNCTION "public"."can_access_branch"("b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_order"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare s sales%rowtype; r record;
begin
  select * into s from sales
  where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status not in ('lab_pending','ready')
    then raise exception 'Cannot cancel an order that is in production or already delivered/cancelled'; end if;
  if exists (select 1 from lab_orders where sale_id = p_id and status not in ('to_buy','cancelled'))
    then raise exception 'Lenses were already bought for this order. Contact the owner to cancel.'; end if;
  if s.paid_total > 0
    then raise exception 'Refund all payments before cancelling (Finance → Credit Notes).'; end if;
  for r in select product_id, qty from sale_lines where sale_id = p_id and product_id is not null loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note)
    values (s.org_id, s.branch_id, r.product_id, r.qty, 'return', s.code || ' cancelled');
  end loop;
  update lab_orders set status = 'cancelled' where sale_id = p_id;
  update sales set status = 'cancelled' where id = p_id;
end $$;


ALTER FUNCTION "public"."cancel_order"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cashbook_from_credit_note"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_m text; v_party text;
begin
  -- create_credit_note() inserts the header with grand_total = 0 and fills the
  -- totals in afterwards, so the money only exists on the UPDATE that follows.
  if coalesce(new.grand_total,0) <= 0 then return new; end if;
  v_m := public.cashbook_method(new.refund_method);
  if v_m = 'other' then return new; end if;  -- store credit / unlabelled: no cash moved

  select c.full_name into v_party from customers c where c.id = new.customer_id;

  insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                        category, party, doc_code, reference, memo, sale_id, occurred_on, occurred_at, created_by)
  values (new.org_id, new.branch_id, 'out', 'refund', new.id, new.grand_total, v_m,
          'Refund', v_party, new.code, nullif(new.reason,''), null, new.original_sale_id,
          (new.created_at at time zone 'Asia/Kolkata')::date, new.created_at, new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."cashbook_from_credit_note"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cashbook_from_expense"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                        category, doc_code, reference, memo, occurred_on, occurred_at, created_by)
  values (new.org_id, new.branch_id, 'out', 'expense', new.id, new.amount, public.cashbook_method(new.payment_method),
          new.category, null, nullif(new.reference,''), new.description,
          new.expense_date, timezone('Asia/Kolkata', new.expense_date::timestamp), new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."cashbook_from_expense"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cashbook_from_online"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_party text;
begin
  if new.sale_id is not null then return new; end if;   -- already posted via `payments`
  if coalesce(new.status,'') <> 'paid' then return new; end if;

  select c.full_name into v_party from customers c where c.id = new.customer_id;

  insert into cashbook (org_id, direction, source, source_id, amount, method,
                        category, party, doc_code, reference, occurred_on, occurred_at)
  values (new.org_id, 'in', 'online_payment', new.id, new.amount, 'razorpay',
          'Online payment', v_party, new.razorpay_order_id, new.razorpay_payment_id,
          (new.created_at at time zone 'Asia/Kolkata')::date, new.created_at)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."cashbook_from_online"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cashbook_from_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_branch uuid; v_code text; v_party text;
begin
  select s.branch_id, s.code, c.full_name into v_branch, v_code, v_party
    from sales s left join customers c on c.id = s.customer_id where s.id = new.sale_id;

  insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                        category, party, doc_code, reference, sale_id, occurred_on, occurred_at, created_by)
  values (new.org_id, v_branch, 'in', 'sale_payment', new.id, new.amount, public.cashbook_method(new.method),
          'Sale payment', v_party, v_code, nullif(new.reference,''), new.sale_id,
          (new.created_at at time zone 'Asia/Kolkata')::date, new.created_at, new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."cashbook_from_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cashbook_from_purchase"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_delta numeric; v_no int;
begin
  v_delta := coalesce(new.paid_amount,0) - case when tg_op = 'INSERT' then 0 else coalesce(old.paid_amount,0) end;
  if v_delta <= 0 then return new; end if;

  select coalesce(max(entry_no),0) + 1 into v_no from cashbook
    where org_id = new.org_id and source = 'purchase_payment' and source_id = new.id;

  insert into cashbook (org_id, branch_id, direction, source, source_id, entry_no, amount, method,
                        category, party, doc_code, reference, occurred_on, occurred_at, created_by)
  values (new.org_id, new.branch_id, 'out', 'purchase_payment', new.id, v_no, v_delta,
          public.cashbook_method(new.payment_mode), 'Supplier payment', new.supplier_name, new.invoice_no,
          nullif(new.payment_ref,''),
          coalesce(new.payment_date, (now() at time zone 'Asia/Kolkata')::date), now(), new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."cashbook_from_purchase"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cashbook_method"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when lower(coalesce(p,'')) = 'cash' then 'cash'
    when lower(coalesce(p,'')) in ('upi','upi/vpa','upi transfer') then 'upi'
    when lower(coalesce(p,'')) in ('card','credit card','debit card','cc','dc') then 'card'
    when lower(coalesce(p,'')) in ('bank','bank transfer','neft/rtgs','neft','rtgs','imps','cheque','check','transfer') then 'bank'
    when lower(coalesce(p,'')) in ('razorpay','online','gateway') then 'razorpay'
    else 'other'
  end $$;


ALTER FUNCTION "public"."cashbook_method"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_invitation"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_uid uuid := auth.uid(); v_email text; v_inv staff_invitations; v_name text;
begin
  if v_uid is null then return false; end if;
  select lower(email), coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)) into v_email, v_name
    from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return false; end if;
  if exists (select 1 from profiles where id = v_uid and org_id is not null) then return false; end if;
  select * into v_inv from staff_invitations where lower(email) = v_email and accepted_at is null and revoked_at is null and expires_at > now()
    order by created_at desc limit 1 for update;
  if not found then return false; end if;
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated)
    values (v_uid, v_inv.org_id, v_name, v_inv.role_key, v_inv.branch_id, true, false)
  on conflict (id) do update set org_id = excluded.org_id, role_key = excluded.role_key, branch_id = excluded.branch_id, is_approved = true, deactivated = false;
  update staff_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return true;
end $$;


ALTER FUNCTION "public"."claim_invitation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_stock_transfer"("p_id" "uuid", "p_reject" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t stock_transfers%rowtype; v_role text := public.current_role_key();
begin
  select * into t from stock_transfers where id = p_id and org_id = public.current_org() for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'requested' then raise exception 'Only requests awaiting approval can be closed'; end if;
  if p_reject then
    if not (v_role in ('owner','admin') or (v_role = 'branch_manager' and public.can_access_branch(t.from_branch))) then raise exception 'Not permitted' using errcode='42501'; end if;
  elsif t.requested_by <> auth.uid() and v_role not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
  update stock_transfers set status = case when p_reject then 'rejected' else 'cancelled' end, updated_at = now() where id = p_id;
end $$;


ALTER FUNCTION "public"."close_stock_transfer"("p_id" "uuid", "p_reject" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_transfer"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status not in ('requested', 'in_transit') then raise exception 'Transfer can no longer be cancelled'; end if;
  if t.status = 'requested' then
    if not (t.requested_by = auth.uid() or (public.is_manager() and (public.can_access_branch(t.from_branch) or public.can_access_branch(t.to_branch)))) then raise exception 'Not authorised' using errcode = '42501'; end if;
    update branch_transfers set status = 'rejected' where id = t.id;
  else
    if not (public.is_manager() and public.can_access_branch(t.from_branch)) then raise exception 'Only a manager of the sending branch can cancel a shipment' using errcode = '42501'; end if;
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, t.product_id, t.qty, 'transfer_in', 'Transfer cancelled ' || t.id);
    update branch_transfers set status = 'cancelled' where id = t.id;
  end if;
end $$;


ALTER FUNCTION "public"."close_transfer"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_credit_note"("p" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org uuid := public.current_org(); v_sale sales%rowtype; v_cn_id uuid; v_cn_code text;
  l jsonb; v_orig sale_lines%rowtype;
  v_sub numeric := 0; v_cg numeric := 0; v_sg numeric := 0; v_ig numeric := 0; v_total numeric := 0; v_rqty int;
begin
  if v_org is null then raise exception 'Only approved staff can issue credit notes'; end if;
  select * into v_sale from sales where id = (p->>'sale_id')::uuid and org_id = v_org;
  if not found then raise exception 'Order not found'; end if;
  if v_sale.status in ('cancelled') then raise exception 'Cannot return a cancelled order'; end if;
  insert into credit_notes (branch_id, original_sale_id, customer_id, reason, refund_method)
  values (v_sale.branch_id, v_sale.id, v_sale.customer_id, coalesce(nullif(trim(p->>'reason'),''), 'Customer return'), nullif(p->>'refund_method',''))
  returning id, code into v_cn_id, v_cn_code;
  for l in select * from jsonb_array_elements(p->'lines') loop
    select * into v_orig from sale_lines where id = (l->>'line_id')::uuid and sale_id = v_sale.id;
    if not found then raise exception 'Line not found on this order'; end if;
    v_rqty := least(greatest(1, (l->>'qty')::int), v_orig.qty);
    declare v_taxable numeric := round(v_orig.taxable_value / v_orig.qty * v_rqty, 2);
        v_cg_a numeric := round(v_orig.cgst_amt / v_orig.qty * v_rqty, 2);
        v_sg_a numeric := round(v_orig.sgst_amt / v_orig.qty * v_rqty, 2);
        v_ig_a numeric := round(v_orig.igst_amt / v_orig.qty * v_rqty, 2);
        v_lt numeric := round(v_orig.line_total / v_orig.qty * v_rqty, 2);
    begin
      insert into credit_note_lines (credit_note_id, original_line_id, description, qty, unit_price, taxable_value,
        cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, line_total)
      values (v_cn_id, v_orig.id, v_orig.description, v_rqty, v_orig.unit_price, v_taxable,
        v_orig.cgst_pct, v_cg_a, v_orig.sgst_pct, v_sg_a, v_orig.igst_pct, v_ig_a, v_lt);
      v_sub := v_sub + v_taxable; v_cg := v_cg + v_cg_a; v_sg := v_sg + v_sg_a; v_ig := v_ig + v_ig_a; v_total := v_total + v_lt;
      if v_orig.product_id is not null then
        insert into stock_movements (branch_id, product_id, delta, reason, note)
        values (v_sale.branch_id, v_orig.product_id, v_rqty, 'return', v_cn_code); end if;
    end;
  end loop;
  update credit_notes set subtotal = v_sub, cgst_total = v_cg, sgst_total = v_sg, igst_total = v_ig, grand_total = v_total where id = v_cn_id;
  return jsonb_build_object('id', v_cn_id, 'code', v_cn_code);
end $$;


ALTER FUNCTION "public"."create_credit_note"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organisation"("p_name" "text", "p_branch_name" "text", "p_branch_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_uid uuid := auth.uid(); v_org uuid; v_br uuid; v_name text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then raise exception 'Confirm your email first'; end if;
  if exists (select 1 from profiles where id = v_uid and org_id is not null and is_approved) then raise exception 'You already belong to an organisation'; end if;
  if exists (select 1 from organizations) and not exists (select 1 from platform_admins where user_id = v_uid) then
    raise exception 'Organisation creation is by invitation only' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_branch_name, ''))) < 2 or length(trim(coalesce(p_branch_code, ''))) < 1 then raise exception 'Organisation and branch names are required'; end if;
  insert into organizations (name) values (trim(p_name)) returning id into v_org;
  insert into branches (org_id, code, name) values (v_org, upper(trim(p_branch_code)), trim(p_branch_name)) returning id into v_br;
  select coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)) into v_name from auth.users where id = v_uid;
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated) values (v_uid, v_org, v_name, 'owner', v_br, true, false)
  on conflict (id) do update set org_id = v_org, role_key = 'owner', branch_id = v_br, is_approved = true, deactivated = false;
  return v_org;
end $$;


ALTER FUNCTION "public"."create_organisation"("p_name" "text", "p_branch_name" "text", "p_branch_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."credit_notes_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin new.code := public.next_code(new.org_id,'credit_note','CN-'); return new; end $$;


ALTER FUNCTION "public"."credit_notes_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select org_id from profiles where id = auth.uid() and is_approved and not deactivated $$;


ALTER FUNCTION "public"."current_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_portal_customer_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
  select c.id from public.customers c where c.auth_user_id = auth.uid() limit 1
$$;


ALTER FUNCTION "public"."current_portal_customer_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_role_key"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select role_key from profiles where id = auth.uid() and is_approved and not deactivated $$;


ALTER FUNCTION "public"."current_role_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customer_branch_context"("p_customer" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'branches_visited', (select count(distinct s.branch_id) from sales s where s.customer_id = p_customer),
    'sale_count',       (select count(*) from sales s where s.customer_id = p_customer),
    'lifetime_value',   (select coalesce(sum(s.grand_total), 0) from sales s where s.customer_id = p_customer),
    'last_sale',        (select jsonb_build_object('branch_id', s.branch_id, 'branch', b.name, 'at', s.created_at, 'amount', s.grand_total, 'mine', public.can_access_branch(s.branch_id))
                           from sales s join branches b on b.id = s.branch_id where s.customer_id = p_customer order by s.created_at desc limit 1)) $$;


ALTER FUNCTION "public"."customer_branch_context"("p_customer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customers_assign_codes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.customer_code := public.next_code(new.org_id,'customer','CUS-');
  new.vision_id     := public.next_code(new.org_id,'vision','VIS-');
  return new;
end $$;


ALTER FUNCTION "public"."customers_assign_codes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."customers_protect_cols"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or current_setting('role', true) = 'service_role' then return new; end if;   -- server/service paths
  if public.current_org() is not null then return new; end if;                                       -- approved staff
  if new.auth_user_id is distinct from old.auth_user_id or new.org_id is distinct from old.org_id
     or new.customer_code is distinct from old.customer_code or new.vision_id is distinct from old.vision_id
     or new.status is distinct from old.status or new.tags is distinct from old.tags
     or new.notes is distinct from old.notes or new.branch_id is distinct from old.branch_id
     or new.referral_code is distinct from old.referral_code or new.referred_by_customer is distinct from old.referred_by_customer
     or new.gstin is distinct from old.gstin or new.created_at is distinct from old.created_at then
    raise exception 'These customer fields can only be changed by the store';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."customers_protect_cols"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."default_org"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select org_id from site_domains where is_default limit 1),
                  (select id from organizations where (select count(*) from organizations) = 1)) $$;


ALTER FUNCTION "public"."default_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deliver_order"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare s sales%rowtype;
begin
  select * into s from sales
  where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status <> 'ready' then raise exception 'Only orders marked ready can be delivered'; end if;
  if s.paid_total < s.grand_total
    then raise exception 'Balance of ₹% is still due. Collect payment first.', (s.grand_total - s.paid_total); end if;
  update lab_orders set status = 'delivered' where sale_id = p_id and status = 'ready';
  update sales set status = 'delivered' where id = p_id;
end $$;


ALTER FUNCTION "public"."deliver_order"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_branch_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare b uuid := case when tg_op = 'DELETE' then old.branch_id else new.branch_id end;
begin
  if auth.uid() is not null and public.current_org() is not null and b is not null and not public.can_access_branch(b) then
    raise exception 'Access denied: you are not assigned to this branch' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;


ALTER FUNCTION "public"."enforce_branch_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_branch_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_b uuid := nullif(to_jsonb(new)->>'branch_id', '')::uuid;
begin
  if auth.uid() is null or v_b is null then return new; end if;
  if not public.can_access_branch(v_b) then raise exception 'Not authorised for this branch' using errcode = '42501'; end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_branch_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_permission"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null and public.current_org() is not null and not public.has_permission(tg_argv[0]) then
    raise exception 'Access denied: requires permission %', tg_argv[0] using errcode='42501'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;


ALTER FUNCTION "public"."enforce_permission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_patient_customer_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.patient_customer_id := coalesce(new.patient_customer_id, new.customer_id);
  return new;
end $$;


ALTER FUNCTION "public"."fill_patient_customer_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_temp_branch"("p_user" "uuid", "p_branch" "uuid", "p_expires" timestamp with time zone, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare me profiles%rowtype; tg profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  select * into tg from profiles where id = p_user and is_approved and not deactivated;
  if me.id is null or tg.id is null or me.org_id is distinct from tg.org_id then raise exception 'Not found' using errcode='42501'; end if;
  if not exists (select 1 from branches where id = p_branch and org_id = me.org_id and is_active) then raise exception 'Invalid branch'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'A reason is required'; end if;
  if p_expires is null or p_expires <= now() then raise exception 'Expiry must be in the future'; end if;
  if me.role_key in ('owner','admin') then
    if p_expires > now() + interval '365 days' then raise exception 'Maximum 365 days'; end if;
  elsif me.role_key = 'branch_manager' then
    if tg.role_key <> 'staff' or not public.can_access_branch(p_branch) then raise exception 'Not permitted' using errcode='42501'; end if;
    if p_expires > now() + interval '30 days' then raise exception 'Managers can grant at most 30 days'; end if;
  else raise exception 'Not permitted' using errcode='42501'; end if;
  insert into user_branches (org_id, user_id, branch_id, kind, expires_at, reason) values (me.org_id, p_user, p_branch, 'temporary', p_expires, p_reason)
  on conflict (user_id, branch_id) do update set expires_at = excluded.expires_at, reason = excluded.reason, granted_by = auth.uid(), kind = 'temporary'
    where user_branches.kind = 'temporary';   -- never downgrade a permanent assignment
end $$;


ALTER FUNCTION "public"."grant_temp_branch"("p_user" "uuid", "p_branch" "uuid", "p_expires" timestamp with time zone, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin insert into profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_perm"("p" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(case when r in ('owner', 'admin') then true
    else coalesce((select allowed from role_permissions rp where rp.org_id = public.current_org() and rp.role_key = r and rp.permission = p), r = 'branch_manager') end, false)
  from (select public.current_role_key() r) x $$;


ALTER FUNCTION "public"."has_perm"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("p" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_approved and not pr.deactivated
    and (pr.role_key in ('owner','admin') or exists (select 1 from role_permissions rp where rp.org_id = pr.org_id and rp.role_key = pr.role_key and rp.permission = p))) $$;


ALTER FUNCTION "public"."has_permission"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_staff"("p_email" "text", "p_role" "text", "p_branch" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  c profiles;
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite staff' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if p_role not in ('admin', 'branch_manager', 'staff') then raise exception 'Invalid role'; end if;
  if c.role_key <> 'owner' and p_role = 'admin' then
    raise exception 'Only an owner can invite admins' using errcode = '42501';
  end if;
  if p_role in ('branch_manager', 'staff') and p_branch is null then raise exception 'Choose a branch'; end if;
  if p_branch is not null and not exists (
    select 1 from branches where id = p_branch and org_id = c.org_id and is_active
  ) then raise exception 'Branch not in your organisation'; end if;

  update staff_invitations set revoked_at = now()
  where org_id = c.org_id and lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into staff_invitations (org_id, email, role_key, branch_id)
  values (c.org_id, v_email, p_role, p_branch)
  returning id into v_id;
  return v_id;
end $_$;


ALTER FUNCTION "public"."invite_staff"("p_email" "text", "p_role" "text", "p_branch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select coalesce(public.current_role_key() in ('owner', 'admin'), false) $$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select coalesce(public.current_role_key() in ('owner', 'admin', 'branch_manager'), false) $$;


ALTER FUNCTION "public"."is_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_prescription_expired"("p_rx_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(valid_till < current_date, false) from prescriptions where id = p_rx_id
$$;


ALTER FUNCTION "public"."is_prescription_expired"("p_rx_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lab_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin if tg_op = 'INSERT' then new.code := public.next_code(new.org_id, 'lab', 'LAB-'); else new.code := old.code; new.updated_at := now(); end if; return new; end $$;


ALTER FUNCTION "public"."lab_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_export"("p_kind" "text", "p_rows" integer, "p_detail" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if public.current_org() is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  insert into audit_log (org_id, user_id, table_name, action, new_data)
  values (public.current_org(), auth.uid(), left(coalesce(p_kind, 'export'), 60), 'EXPORT', jsonb_build_object('rows', p_rows, 'detail', p_detail, 'role', public.current_role_key()));
end $$;


ALTER FUNCTION "public"."log_export"("p_kind" "text", "p_rows" integer, "p_detail" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_permissions"() RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select coalesce(array_agg(p), '{}') from unnest(array['finance_view', 'expenses', 'day_closing', 'catalogue_edit']) p where public.has_perm(p) $$;


ALTER FUNCTION "public"."my_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_code"("p_org" "uuid", "p_key" "text", "p_prefix" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare n int;
begin
  if public.current_org() is not null and p_org is distinct from public.current_org() then
    raise exception 'Access denied' using errcode = '42501'; end if;
  insert into counters(org_id,key,value) values (p_org,p_key,1)
  on conflict (org_id,key) do update set value = counters.value + 1 returning value into n;
  return p_prefix || lpad(n::text, 4, '0');
end $$;


ALTER FUNCTION "public"."next_code"("p_org" "uuid", "p_key" "text", "p_prefix" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_default_text"("p_key" "text", "p_fallback" "text" DEFAULT ''::"text", "p_org" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select value #>> '{}' from org_settings where org_id = coalesce(p_org, public.current_org(), public.default_org()) and key = p_key), p_fallback) $$;


ALTER FUNCTION "public"."org_default_text"("p_key" "text", "p_fallback" "text", "p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_for_host"("p_host" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$ select org_id from org_domains where domain = lower(regexp_replace(coalesce(p_host, ''), ':\d+$', '')) limit 1 $_$;


ALTER FUNCTION "public"."org_for_host"("p_host" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."palre_guard_verified_catalogue_evidence"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.verification_status = 'verified' then
      raise exception 'Verified PALRE evidence cannot be deleted; supersede it and create a new version';
    end if;
    return old;
  end if;

  if old.verification_status = 'verified' then
    if new.verification_status <> 'superseded'
       or (to_jsonb(new) - 'verification_status' - 'created_at')
          <> (to_jsonb(old) - 'verification_status' - 'created_at') then
      raise exception 'Verified PALRE evidence is immutable; create a new version';
    end if;
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."palre_guard_verified_catalogue_evidence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."palre_guard_verified_option_combination"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_status text;
begin
  if tg_table_name = 'lens_package_option_combinations' then
    if tg_op = 'DELETE' and old.verification_status = 'verified' then
      raise exception 'Verified option combinations cannot be deleted; supersede them';
    end if;
    if tg_op = 'UPDATE' and old.verification_status = 'verified'
       and (new.verification_status <> 'superseded'
         or (to_jsonb(new) - 'verification_status' - 'created_at')
            <> (to_jsonb(old) - 'verification_status' - 'created_at')) then
      raise exception 'Verified option combinations are immutable; create a new combination';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select verification_status into v_status
  from public.lens_package_option_combinations
  where org_id = old.org_id and id = old.combination_id;
  if v_status = 'verified' then
    raise exception 'Items in a verified option combination are immutable';
  end if;
  if tg_op = 'UPDATE' then
    select verification_status into v_status
    from public.lens_package_option_combinations
    where org_id = new.org_id and id = new.combination_id;
    if v_status = 'verified' then
      raise exception 'Items cannot be moved into a verified option combination';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."palre_guard_verified_option_combination"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."palre_recommendation_event_no_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ begin raise exception 'PALRE recommendation events are append-only'; end $$;


ALTER FUNCTION "public"."palre_recommendation_event_no_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."palre_validate_compatibility_design_family"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_design text;
begin
  select design into v_design from public.lens_packages
  where id=new.lens_package_id and org_id=new.org_id;
  if not found then raise exception 'Lens package does not exist in this organisation'; end if;
  if (v_design='single_vision' and new.design_family<>'SV')
     or (v_design='bifocal' and new.design_family<>'BF')
     or (v_design='progressive' and new.design_family<>'PROG')
     or (v_design='occupational' and new.design_family<>'OCC')
     or v_design not in ('single_vision','bifocal','progressive','occupational') then
    raise exception 'Compatibility rule design family does not match lens package design';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."palre_validate_compatibility_design_family"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."palre_validate_option_combination"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_package_id uuid;
  v_option_package_id uuid;
  v_status text;
  v_combo_status text;
  v_count integer;
begin
  if tg_table_name = 'lens_package_option_combinations' then
    if new.verification_status = 'verified' then
      select count(*) into v_count
      from public.lens_package_option_combination_items i
      where i.org_id = new.org_id and i.combination_id = new.id;
      if v_count < 2 then
        raise exception 'A verified option combination must contain at least two verified package options';
      end if;
    end if;
    return new;
  end if;

  select lens_package_id, verification_status
    into v_option_package_id, v_status
  from public.lens_package_option_eligibility
  where org_id = new.org_id and id = new.package_option_eligibility_id;

  select lens_package_id, verification_status
    into v_package_id, v_combo_status
  from public.lens_package_option_combinations
  where org_id = new.org_id and id = new.combination_id;

  if v_combo_status = 'verified' then
    raise exception 'Items in a verified option combination are immutable';
  end if;
  if v_package_id is null or v_option_package_id is null
     or v_package_id <> v_option_package_id
     or v_status <> 'verified' then
    raise exception 'Combination items must reference verified options belonging to the same package and organisation';
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."palre_validate_option_combination"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payments_apply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare s sales%rowtype;
begin
  select * into s from sales where id = new.sale_id for update;
  if s.kind <> 'order' then raise exception 'Payments can only be taken on orders'; end if;
  if s.status = 'cancelled' then raise exception 'This order is cancelled'; end if;
  if s.paid_total + new.amount > s.grand_total then raise exception 'That is more than the balance due'; end if;
  update sales set paid_total = s.paid_total + new.amount,
    payment_status = case when s.paid_total + new.amount >= s.grand_total then 'paid' else 'partial' end where id = s.id;
  return new;
end $$;


ALTER FUNCTION "public"."payments_apply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_sale"("p" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_org uuid := public.current_org(); v_kind text := p->>'kind'; v_cust uuid := (p->>'customer_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid; v_qid uuid := (p->>'quotation_id')::uuid; v_rx jsonb; v_role text; v_maxdisc numeric;
  v_gst boolean := coalesce((select (value #>> '{}')::boolean from org_settings where org_id = public.current_org() and key = 'gst_enabled'), true);
  v_lead int := coalesce((select (value #>> '{}')::int from org_settings where org_id = public.current_org() and key = 'lab_lead_days'), 5);
  v_supply_type text := coalesce(nullif(p->>'supply_type',''), 'intrastate');
  v_state_of_supply text := coalesce(nullif(p->>'state_of_supply',''), 'Tamil Nadu');
  v_recipient_gstin text := nullif(trim(coalesce(p->>'recipient_gstin','')), '');
  v_id uuid; v_code text; v_lid uuid; l jsonb; n int := 0;
  v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text;
  v_hsn text; v_pmode text;
  v_taxable numeric; v_tax_amt numeric; v_cgst_p numeric; v_sgst_p numeric; v_igst_p numeric;
  v_cgst_a numeric; v_sgst_a numeric; v_igst_a numeric; v_tot numeric;
  -- subtotal = sum of listed prices (before discount), always inclusive-of-tax
  -- grand_total = sum of actual amounts paid
  v_sub numeric := 0; v_grand numeric := 0; v_taxable_tot numeric := 0;
  v_cgst_tot numeric := 0; v_sgst_tot numeric := 0; v_igst_tot numeric := 0;
  v_lab boolean := false; v_pkind text; v_fdesc text; v_fpid uuid;
  v_pid uuid; v_have int; v_pkg lens_packages%rowtype; v_opts uuid[]; v_optsum numeric; v_optnames text;
  v_pay numeric := coalesce((p->'payment'->>'amount')::numeric, 0);
  v_idem text := nullif(p->>'idempotency_key', '');
  -- Track inserted sale lines' product IDs for stock deduction
  v_product_ids uuid[] := '{}';
begin
  -- ── Organisational context security check ────────────────────────────────────────
  -- Ensure the caller is validated under an approved organisation context.
  -- If no org is found, raise immediately (prevents anonymous/unvalidated execution).
  if v_org is null then raise exception 'Only approved staff can create sales'; end if;

  -- ── Sale type validation ─────────────────────────────────────────────────────────
  if v_kind not in ('quotation','order') then raise exception 'Unknown sale type'; end if;

  -- ── Role validation ──────────────────────────────────────────────────────────────
  select role_key into v_role from profiles where id = auth.uid();
  v_maxdisc := coalesce((select (value #>> '{}')::numeric from org_settings where org_id = v_org and key = 'max_staff_discount_pct'), 10);

  -- ── Customer & branch validation ─────────────────────────────────────────────────
  if not exists (select 1 from customers where id = v_cust) then raise exception 'Choose a customer'; end if;
  if not exists (select 1 from branches where id = v_branch) then raise exception 'Choose a branch'; end if;

  -- ── Prescription validation ──────────────────────────────────────────────────────
  if v_rx_id is not null then
    select to_jsonb(r) into v_rx from prescriptions r where r.id = v_rx_id and r.customer_id = v_cust;
    if v_rx is null then raise exception 'That prescription does not belong to this customer'; end if;
  end if;

  -- ── Quotation validation ─────────────────────────────────────────────────────────
  if v_qid is not null and not exists (select 1 from sales where id = v_qid and kind = 'quotation' and status in ('draft','sent')) then
    raise exception 'That quotation can no longer be converted'; end if;

  -- ── Idempotency check: return existing sale if same key already submitted ──────────
  if v_idem is not null and v_idem <> '' then
    select id, code into v_id, v_code from sales where org_id = v_org and idempotency_key = v_idem::uuid limit 1;
    if v_id is not null then return jsonb_build_object('id', v_id, 'code', v_code, 'idempotent', true); end if;
  end if;

  -- ── Ensure at least one line item ────────────────────────────────────────────────
  if jsonb_array_length(coalesce(p->'lines','[]'::jsonb)) = 0 then raise exception 'Add at least one item'; end if;

  -- ── Insert the sale header with full GST context ─────────────────────────────────
  insert into sales (branch_id, kind, customer_id, prescription_id, rx_snapshot, source_quotation_id,
    status, notes, gst_applied, supply_type, state_of_supply, recipient_gstin, valid_until)
  values (v_branch, v_kind, v_cust, v_rx_id, v_rx, v_qid, 'draft', nullif(p->>'notes',''),
    v_gst, v_supply_type, v_state_of_supply, v_recipient_gstin,
    case when v_kind = 'quotation' then coalesce((p->>'valid_until')::date,
      current_date + coalesce((select (value #>> '{}')::int from org_settings where org_id = v_org and key = 'quotation_valid_days'), 14)) end)
  returning id, code into v_id, v_code;

  -- ── Process each line item ───────────────────────────────────────────────────────
  for l in select * from jsonb_array_elements(p->'lines') loop
    n := n + 1; v_type := l->>'line_type'; v_pid := null; v_det := null; v_opts := '{}';
    v_hsn := null; v_pmode := 'inclusive';
    v_qty := greatest(1, coalesce((l->>'qty')::int, 1));
    v_disc := coalesce((l->>'discount_pct')::numeric, 0);
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be between 0 and 100'; end if;
    if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin') then
      raise exception 'Discounts above % need an owner or admin', v_maxdisc; end if;

    -- ── Lens items ────────────────────────────────────────────────────────────────
    if v_type = 'lens' then
      select * into v_pkg from lens_packages where id = (l->>'lens_package_id')::uuid and status = 'active';
      if not found then raise exception 'Choose an active lens package'; end if;
      v_opts := array(select jsonb_array_elements_text(coalesce(l->'option_ids','[]'::jsonb))::uuid);
      select coalesce(sum(price),0), string_agg(name, ', ' order by display_order)
        into v_optsum, v_optnames from lens_options where id = any(v_opts) and status = 'active';
      v_unit := v_pkg.base_price + v_optsum; v_tax := v_pkg.tax_pct;
      v_desc := v_pkg.name || ' lenses'; v_det := v_optnames;
      v_hsn := '900150'; v_pmode := 'inclusive'; v_lab := true;

      -- ── Frame-only (no prescription) → no lab job ──────────────────────────────
      -- If there is no prescription, this is a frame-only sale: skip lab order creation
      -- but still record the sale. Lab jobs only happen when a prescription exists.
      if v_rx is null then
        v_lab := false;
      end if;

    -- ── Product/accessory items ───────────────────────────────────────────────────
    elsif v_type in ('product','accessory') then
      v_pid := (l->>'product_id')::uuid;
      select p2.selling_price, p2.tax_pct, trim(coalesce(b.name,'') || ' ' || p2.model),
             p2.kind, coalesce(p2.hsn,''), p2.price_mode
        into v_unit, v_tax, v_desc, v_pkind, v_hsn, v_pmode
        from products p2 left join brands b on b.id = p2.brand_id
       where p2.id = v_pid and p2.status = 'active';
      if v_unit is null then raise exception 'An item in the bag is no longer available'; end if;
      if v_pkind in ('frame','sunglass') then v_fdesc := v_desc; v_fpid := v_pid; end if;
      if v_kind = 'order' then
        select qty into v_have from stock where branch_id = v_branch and product_id = v_pid;
        v_have := coalesce(v_have, 0);
        if v_have < v_qty then raise exception 'Not enough stock for % (only % here)', v_desc, v_have; end if;
      end if;

    -- ── Service items ─────────────────────────────────────────────────────────────
    elsif v_type = 'service' then
      v_unit := (l->>'unit_price')::numeric; v_tax := coalesce((l->>'tax_pct')::numeric, 18);
      v_desc := nullif(trim(l->>'description'), '');
      if v_desc is null or v_unit is null or v_unit < 0 then raise exception 'Service items need a name and a price'; end if;
      v_hsn := '999999'; v_pmode := 'exclusive';
    else raise exception 'Unknown item type: %', v_type; end if;

    -- ── GST: disable tax if org setting says so ────────────────────────────────────
    if not v_gst then v_tax := 0; end if;

    -- ── Price / tax calculation (exclusive vs inclusive) ──────────────────────────
    if v_pmode = 'exclusive' then
      v_taxable := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_tax_amt := round(v_taxable * v_tax / 100, 2);
      v_tot     := v_taxable + v_tax_amt;
      -- Subtotal for exclusive = full price including tax (MRP equivalent)
      v_sub := v_sub + round(v_qty * v_unit * (1 + v_tax/100), 2);
    else -- inclusive (default for Indian retail)
      v_tot     := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_taxable := case when v_tax > 0 then round(v_tot / (1 + v_tax/100), 2) else v_tot end;
      v_tax_amt := v_tot - v_taxable;
      v_sub := v_sub + v_qty * v_unit;
    end if;

    -- ── CGST/SGST vs IGST split ──────────────────────────────────────────────────
    if v_gst and v_supply_type = 'intrastate' then
      v_cgst_p := v_tax/2; v_sgst_p := v_tax/2; v_igst_p := 0;
      v_cgst_a := round(v_tax_amt/2, 2); v_sgst_a := v_tax_amt - round(v_tax_amt/2,2); v_igst_a := 0;
    elsif v_gst then
      v_cgst_p := 0; v_sgst_p := 0; v_igst_p := v_tax;
      v_cgst_a := 0; v_sgst_a := 0; v_igst_a := v_tax_amt;
    else
      v_cgst_p := 0; v_sgst_p := 0; v_igst_p := 0;
      v_cgst_a := 0; v_sgst_a := 0; v_igst_a := 0;
    end if;

    v_grand       := v_grand + v_tot;
    v_taxable_tot := v_taxable_tot + v_taxable;
    v_cgst_tot    := v_cgst_tot + v_cgst_a;
    v_sgst_tot    := v_sgst_tot + v_sgst_a;
    v_igst_tot    := v_igst_tot + v_igst_a;

    -- ── Insert sale line with all GST fields ──────────────────────────────────────
    insert into sale_lines (sale_id, line_no, line_type, product_id, lens_package_id, option_ids,
      description, details, qty, unit_price, discount_pct, tax_pct, line_total,
      hsn, price_mode, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt)
    values (v_id, n, v_type, v_pid,
      case when v_type = 'lens' then v_pkg.id end, v_opts,
      v_desc, v_det, v_qty, v_unit, v_disc, v_tax, v_tot,
      v_hsn, v_pmode, v_taxable, v_cgst_p, v_cgst_a, v_sgst_p, v_sgst_a, v_igst_p, v_igst_a)
    returning id into v_lid;

    -- ── Stock deduction for product/accessory orders ───────────────────────────────
    if v_kind = 'order' and v_pid is not null then
      insert into stock_movements (branch_id, product_id, delta, reason, note)
      values (v_branch, v_pid, -v_qty, 'sale', v_code);
      v_product_ids := v_product_ids || array[v_pid];
    end if;

    -- ── Lab order creation for prescription lens orders ONLY ─────────────────────
    -- Rule: lab_orders are created only when:
    --   1. v_kind = 'order' (actual order, not quotation)
    --   2. v_type = 'lens' (lens item)
    --   3. v_rx is not null (prescription exists)
    -- This ensures:
    --   - Frame-only sales (frame sunglasses without prescription) do NOT create lab jobs
    --   - Quotations do NOT create lab jobs
    --   - Product/accessory orders do NOT create lab jobs
    if v_kind = 'order' and v_type = 'lens' and v_rx is not null then
      insert into lab_orders (branch_id, sale_id, sale_line_id, customer_id,
        lens_package_id, lens_desc, lens_details, frame_desc, frame_product_id,
        rx_code, od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add,
        pd_far, pd_near, due_date)
      values (v_branch, v_id, v_lid, v_cust, v_pkg.id, v_desc, v_det, v_fdesc, v_fpid,
        v_rx->>'rx_code',
        (v_rx->>'od_sph')::numeric, (v_rx->>'od_cyl')::numeric,
        (v_rx->>'od_axis')::int,    (v_rx->>'od_add')::numeric,
        (v_rx->>'os_sph')::numeric, (v_rx->>'os_cyl')::numeric,
        (v_rx->>'os_axis')::int,    (v_rx->>'os_add')::numeric,
        (v_rx->>'pd_far')::numeric, (v_rx->>'pd_near')::numeric,
        current_date + v_lead);
    end if;
  end loop;

  -- ── Validate lens orders require prescription ────────────────────────────────────
  if v_kind = 'order' and v_lab and v_rx is null then
    raise exception 'Lens orders need a prescription. Add one first.'; end if;

  -- ── Update sale totals with all GST aggregates ──────────────────────────────────
  update sales set
    subtotal         = v_sub,
    -- FIX: discount_total = listed price − what customer pays (always ≥ 0)
    discount_total   = greatest(0, round(v_sub - v_grand, 2)),
    tax_included     = v_cgst_tot + v_sgst_tot + v_igst_tot,
    grand_total      = v_grand,
    taxable_total    = v_taxable_tot,
    cgst_total       = v_cgst_tot,
    sgst_total       = v_sgst_tot,
    igst_total       = v_igst_tot,
    needs_lab        = v_lab,
    status           = case
      when v_kind = 'quotation' then 'draft'
      when v_lab then 'lab_pending'
      else 'ready'
    end,
    gst_applied      = v_gst,
    supply_type      = v_supply_type,
    state_of_supply  = v_state_of_supply,
    recipient_gstin  = v_recipient_gstin,
    idempotency_key  = v_idem::uuid
  where id = v_id;

  -- ── Convert quotation if referencing one ─────────────────────────────────────────
  if v_qid is not null then update sales set status = 'converted' where id = v_qid; end if;

  -- ── Insert payment if amount provided ───────────────────────────────────────────
  if v_kind = 'order' and v_pay > 0 then
    insert into payments (sale_id, amount, method, reference)
    values (v_id, v_pay,
      coalesce(p->'payment'->>'method','cash'),
      nullif(p->'payment'->>'reference',''));
  end if;

  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;


ALTER FUNCTION "public"."place_sale"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_family_members"() RETURNS TABLE("id" "uuid", "full_name" "text", "vision_id" "text", "relationship" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
  with me as (
    select c.id from public.customers c where c.auth_user_id = auth.uid() limit 1
  )
  select c.id, c.full_name, c.vision_id, 'You'::text as relationship
  from public.customers c join me on me.id = c.id
  union all
  select member.id, member.full_name, member.vision_id, fm.relationship
  from public.family_members fm
  join me on me.id = fm.primary_customer_id
  join public.customers member on member.id = fm.member_customer_id
  where fm.is_active = true
$$;


ALTER FUNCTION "public"."portal_family_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_notify_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_title text; v_body text; v_key text;
begin
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then return new; end if;
  end if;
  v_title := case when tg_op = 'INSERT' then 'Eye test appointment requested'
                  else 'Eye test appointment updated' end;
  v_body := to_char(new.appt_date, 'DD Mon YYYY') || ' at ' ||
            to_char(new.appt_time, 'HH12:MI AM') || ' · ' || replace(new.status, '_', ' ');
  v_key := 'appointment:' || new.id::text || ':' || new.status;
  insert into public.customer_notifications(org_id, customer_id, notification_type, title, body, href, source_key)
  values (new.org_id, new.customer_id, 'appointment', v_title, v_body, '/my/appointments', v_key)
  on conflict (customer_id, source_key) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."portal_notify_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_notify_loyalty"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.customer_notifications(org_id, customer_id, notification_type, title, body, href, source_key)
  values (new.org_id, new.customer_id, 'loyalty',
    case when new.delta > 0 then '+' || new.delta::text || ' loyalty points earned'
         else abs(new.delta)::text || ' loyalty points redeemed' end,
    replace(new.reason, '_', ' '), '/my/loyalty', 'loyalty:' || new.id::text)
  on conflict (customer_id, source_key) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."portal_notify_loyalty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_notify_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_title text; v_body text; v_key text;
begin
  if new.kind <> 'order' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then return new; end if;
  end if;
  if tg_op = 'INSERT' then
    v_title := 'Order #' || coalesce(new.code, '');
    v_body := case new.status
      when 'ready' then 'Your order is ready for pickup.'
      when 'delivered' then 'Your order has been delivered.'
      when 'cancelled' then 'Your order was cancelled.'
      else 'Your order has been placed successfully.' end;
    v_key := 'order:' || new.id::text || ':created';
  else
    v_title := 'Order #' || coalesce(new.code, '') || ' updated';
    v_body := case new.status
      when 'processing' then 'Your order is being prepared.'
      when 'lab_pending' then 'Your lenses are at the lab.'
      when 'in_workshop' then 'Your order is in the workshop.'
      when 'qc' then 'Your order is in quality check.'
      when 'ready' then 'Your order is ready for pickup.'
      when 'delivered' then 'Your order has been delivered.'
      when 'cancelled' then 'Your order was cancelled.'
      else 'Your order status is now ' || replace(new.status, '_', ' ') || '.' end;
    v_key := 'order:' || new.id::text || ':status:' || new.status;
  end if;
  insert into public.customer_notifications(org_id, customer_id, notification_type, title, body, href, source_key)
  values (new.org_id, new.customer_id, 'order', v_title, v_body, '/my/orders/' || new.id::text, v_key)
  on conflict (customer_id, source_key) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."portal_notify_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_notify_prescription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.customer_notifications(org_id, customer_id, notification_type, title, body, href, source_key)
  values (new.org_id, new.customer_id, 'prescription',
    'Prescription added',
    'Your prescription ' || coalesce(new.rx_code, '') || ' is now available in your Vision ID.',
    '/my/prescriptions', 'prescription:' || new.id::text)
  on conflict (customer_id, source_key) do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."portal_notify_prescription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prescriptions_assign_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin new.rx_code := public.next_code(new.org_id,'rx','RX-'); return new; end $$;


ALTER FUNCTION "public"."prescriptions_assign_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prescriptions_check_values"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."prescriptions_check_values"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_costs_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if not exists (select 1 from products p where p.id = new.product_id and p.org_id = new.org_id) then raise exception 'Product not in your organisation' using errcode = '42501'; end if;
  new.updated_at := now(); new.updated_by := auth.uid(); return new;
end $$;


ALTER FUNCTION "public"."product_costs_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."products_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    new.sku := public.next_code(new.org_id, 'sku_' || new.kind,
      case new.kind when 'frame' then 'FRM-' when 'sunglass' then 'SUN-' when 'contact_lens' then 'CL-' else 'ACC-' end);
    new.barcode := coalesce(nullif(new.barcode, ''), new.sku);
  else new.sku := old.sku; new.updated_at := now(); end if;
  return new;
end $$;


ALTER FUNCTION "public"."products_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_orders_no"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.po_no is null or new.po_no = '' then
    new.po_no := public.next_code(new.org_id, 'purchase_order', 'PO-');
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."purchase_orders_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_limit" integer, "p_window_secs" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_secs) * p_window_secs); h int;
begin
  insert into rate_limits (key, window_start) values (left(p_key, 200), w)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1 returning hits into h;
  if random() < 0.02 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return h <= p_limit;
end $$;


ALTER FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_limit" integer, "p_window_secs" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_stock_transfer"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t stock_transfers%rowtype; r record;
begin
  select * into t from stock_transfers where id = p_id and org_id = public.current_org() for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'in_transit' then raise exception 'Transfer is not in transit'; end if;
  if not public.can_access_branch(t.to_branch) then raise exception 'Only the receiving branch can receive stock' using errcode='42501'; end if;
  for r in select * from stock_transfer_lines where transfer_id = p_id loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.to_branch, r.product_id, r.qty, 'transfer_in', 'Transfer ' || left(p_id::text, 8));
  end loop;
  update stock_transfers set status = 'received', received_by = auth.uid(), updated_at = now() where id = p_id;
end $$;


ALTER FUNCTION "public"."receive_stock_transfer"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_transfer"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status <> 'in_transit' then raise exception 'Transfer is not in transit'; end if;
  if not public.can_access_branch(t.to_branch) then raise exception 'Only the receiving branch can confirm receipt' using errcode = '42501'; end if;
  insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.to_branch, t.product_id, t.qty, 'transfer_in', 'Transfer ' || t.id);
  update branch_transfers set status = 'received', received_by = auth.uid(), received_at = now() where id = t.id;
end $$;


ALTER FUNCTION "public"."receive_transfer"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_palre_compatibility_evaluation"("p_prescription_id" "uuid", "p_design_family" "text", "p_result_status" "text", "p_preferred_index" numeric, "p_measurements" "jsonb", "p_candidates" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_org_id uuid := public.current_org(); v_user_id uuid := auth.uid();
  v_run_id uuid; v_candidate jsonb; v_position integer:=0;
  v_eligible boolean; v_match_type text;
begin
  if v_org_id is null or v_user_id is null then raise exception 'Authenticated organisation context is required'; end if;
  if p_design_family not in ('SV','BF','PROG','OCC')
     or p_result_status not in ('exact_match','nearest_eligible_match','no_eligible_match')
     or jsonb_typeof(coalesce(p_candidates,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_measurements,'{}'::jsonb))<>'object'
     or jsonb_array_length(coalesce(p_candidates,'[]'::jsonb))>250 then
    raise exception 'Invalid PALRE evaluation payload';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.org_id=v_org_id
    and p.is_approved=true and p.deactivated=false and p.role_key='optometrist') then
    raise exception 'Only an approved optometrist can record PALRE evaluations';
  end if;
  if not exists(select 1 from public.prescriptions rx where rx.id=p_prescription_id
    and rx.org_id=v_org_id and rx.status='active') then
    raise exception 'Active prescription does not belong to current organisation';
  end if;
  insert into public.lens_compatibility_evaluation_runs(org_id,prescription_id,design_family,result_status,preferred_index,measurements,evaluated_by)
  values(v_org_id,p_prescription_id,p_design_family,p_result_status,p_preferred_index,coalesce(p_measurements,'{}'::jsonb),v_user_id)
  returning id into v_run_id;
  for v_candidate in select value from jsonb_array_elements(coalesce(p_candidates,'[]'::jsonb)) with ordinality x(value,ord) order by ord loop
    v_position:=v_position+1;
    v_eligible:=coalesce((v_candidate->>'eligible')::boolean,false);
    v_match_type:=case when v_eligible then coalesce(v_candidate->>'match_type','nearest_eligible') else 'ineligible' end;
    insert into public.lens_compatibility_evaluation_candidates(
      org_id,evaluation_run_id,lens_package_id,manufacturer_sku_snapshot,candidate_position,eligible,match_type,
      matched_rule_id,matched_option_combination_id,preference_score,od_result,os_result,reason_details
    ) values(v_org_id,v_run_id,(v_candidate->>'package_id')::uuid,nullif(v_candidate->>'manufacturer_sku',''),
      v_position,v_eligible,v_match_type,nullif(v_candidate->>'matched_rule_id','')::uuid,
      nullif(v_candidate->>'matched_option_combination_id','')::uuid,nullif(v_candidate->>'preference_score','')::numeric,
      coalesce(v_candidate->'od_result','{}'::jsonb),coalesce(v_candidate->'os_result','{}'::jsonb),coalesce(v_candidate->'reason_details','[]'::jsonb));
  end loop;
  if p_result_status='no_eligible_match' and exists(select 1 from public.lens_compatibility_evaluation_candidates where org_id=v_org_id and evaluation_run_id=v_run_id and eligible) then raise exception 'No-match run cannot contain eligible candidates'; end if;
  if p_result_status='exact_match' and not exists(select 1 from public.lens_compatibility_evaluation_candidates where org_id=v_org_id and evaluation_run_id=v_run_id and eligible and match_type='exact') then raise exception 'Exact-match run must contain an exact eligible candidate'; end if;
  if p_result_status='nearest_eligible_match' and (not exists(select 1 from public.lens_compatibility_evaluation_candidates where org_id=v_org_id and evaluation_run_id=v_run_id and eligible and match_type='nearest_eligible') or exists(select 1 from public.lens_compatibility_evaluation_candidates where org_id=v_org_id and evaluation_run_id=v_run_id and eligible and match_type='exact')) then raise exception 'Nearest-match run must contain eligible nearest candidates and no exact candidate'; end if;
  return v_run_id;
end $$;


ALTER FUNCTION "public"."record_palre_compatibility_evaluation"("p_prescription_id" "uuid", "p_design_family" "text", "p_result_status" "text", "p_preferred_index" numeric, "p_measurements" "jsonb", "p_candidates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_palre_recommendation_run"("p_prescription_id" "uuid", "p_compatibility_run_ids" "uuid"[], "p_status" "text", "p_snapshot" "jsonb", "p_candidates" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_org uuid:=public.current_org(); v_user uuid:=auth.uid(); v_run uuid;
  v_item jsonb; v_pos integer:=0; v_package uuid; v_match text;
begin
  if v_org is null or v_user is null then raise exception 'Authenticated organisation required'; end if;
  if p_status not in ('awaiting_optometrist_review','no_eligible_match')
     or jsonb_typeof(coalesce(p_snapshot,'{}'::jsonb))<>'object'
     or jsonb_typeof(coalesce(p_candidates,'[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_candidates,'[]'::jsonb))>250 then
    raise exception 'Invalid recommendation run payload';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.org_id=v_org
    and p.is_approved and not p.deactivated and p.role_key='optometrist') then
    raise exception 'Only approved optometrists can create recommendation runs';
  end if;
  if not exists(select 1 from public.prescriptions rx where rx.id=p_prescription_id and rx.org_id=v_org and rx.status='active') then
    raise exception 'Active prescription not found in current organisation';
  end if;
  if coalesce(array_length(p_compatibility_run_ids,1),0)=0 or exists(
    select 1 from unnest(p_compatibility_run_ids) x(id)
    where not exists(select 1 from public.lens_compatibility_evaluation_runs r
      where r.id=x.id and r.org_id=v_org and r.prescription_id=p_prescription_id)
  ) then raise exception 'Compatibility evaluation references are invalid'; end if;
  if p_status='no_eligible_match' and jsonb_array_length(coalesce(p_candidates,'[]'::jsonb))<>0 then
    raise exception 'No-match recommendation cannot contain candidates';
  end if;
  if p_status='awaiting_optometrist_review' and jsonb_array_length(coalesce(p_candidates,'[]'::jsonb))=0 then
    raise exception 'Review queue recommendation requires at least one eligible candidate';
  end if;
  insert into public.palre_recommendation_runs(org_id,prescription_id,status,compatibility_run_ids,recommendation_snapshot,created_by)
  values(v_org,p_prescription_id,p_status,coalesce(p_compatibility_run_ids,'{}'),coalesce(p_snapshot,'{}'::jsonb),v_user)
  returning id into v_run;
  for v_item in select value from jsonb_array_elements(coalesce(p_candidates,'[]'::jsonb)) with ordinality x(value,ord) order by ord loop
    v_pos:=v_pos+1; v_package:=(v_item->>'package_id')::uuid; v_match:=v_item->>'match_type';
    if v_match not in ('exact','nearest_eligible') then raise exception 'Recommendation candidate must be clinically eligible'; end if;
    if not exists(select 1 from public.lens_compatibility_evaluation_candidates c
      where c.org_id=v_org and c.lens_package_id=v_package and c.eligible
      and c.match_type=v_match and c.evaluation_run_id=any(p_compatibility_run_ids)
      and exists(select 1 from public.lens_compatibility_evaluation_runs r where r.org_id=v_org
        and r.id=c.evaluation_run_id and r.design_family=v_item->>'design_family')) then
      raise exception 'Candidate is not eligible in the referenced compatibility run';
    end if;
    insert into public.palre_recommendation_candidates(org_id,recommendation_run_id,lens_package_id,candidate_position,tier,match_type,candidate_snapshot)
    values(v_org,v_run,v_package,v_pos,nullif(v_item->>'tier',''),v_match,coalesce(v_item->'snapshot','{}'::jsonb));
  end loop;
  insert into public.palre_recommendation_events(org_id,recommendation_run_id,event_type,actor_id,event_payload)
  values(v_org,v_run,case when p_status='awaiting_optometrist_review' then 'recommendation_prepared_for_optometrist_review' else 'no_eligible_match' end,v_user,
    jsonb_build_object('candidate_count',v_pos,'compatibility_run_ids',p_compatibility_run_ids));
  return v_run;
end $$;


ALTER FUNCTION "public"."record_palre_recommendation_run"("p_prescription_id" "uuid", "p_compatibility_run_ids" "uuid"[], "p_status" "text", "p_snapshot" "jsonb", "p_candidates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_family_member_request"("p_request_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_org uuid := public.current_org();
  v_role text;
begin
  if auth.uid() is null or v_org is null then raise exception 'Authentication required'; end if;
  select role_key into v_role from public.profiles
  where id = auth.uid() and is_approved = true and deactivated = false and org_id = v_org;
  if coalesce(v_role, '') not in ('owner','admin') then
    raise exception 'You are not authorised to reject family links';
  end if;
  update public.family_member_requests
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      notes = concat_ws(E'\n', nullif(notes,''), nullif(trim(p_reason),''))
  where id = p_request_id and org_id = v_org and status = 'pending';
  if not found then raise exception 'Pending family request not found'; end if;
end
$$;


ALTER FUNCTION "public"."reject_family_member_request"("p_request_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_org_domain"("p_domain" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can manage domains' using errcode = '42501'; end if;
  delete from org_domains where domain = lower(trim(p_domain)) and org_id = public.current_org();
end $$;


ALTER FUNCTION "public"."remove_org_domain"("p_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repairs_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then new.code := public.next_code(new.org_id,'repair','REP-');
  else new.code := old.code; new.updated_at := now(); end if;
  new.total_amount := round((new.repair_charges + new.parts_cost - new.discount) * (1 + new.tax_pct/100), 2);
  return new;
end $$;


ALTER FUNCTION "public"."repairs_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_org"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(public.current_org(),
    public.resolve_org(nullif(current_setting('request.headers', true), '')::json ->> 'x-site-host')) $$;


ALTER FUNCTION "public"."request_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_stock_transfer"("p_from" "uuid", "p_to" "uuid", "p_lines" "jsonb", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid := public.current_org(); v_id uuid; l jsonb;
begin
  if v_org is null then raise exception 'Only approved staff can request transfers' using errcode='42501'; end if;
  if p_from = p_to then raise exception 'Choose two different branches'; end if;
  if not (public.can_access_branch(p_from) or public.can_access_branch(p_to)) then raise exception 'You must belong to one of the branches' using errcode='42501'; end if;
  if (select count(*) from branches where id in (p_from,p_to) and org_id = v_org and is_active) <> 2 then raise exception 'Invalid branches'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one product'; end if;
  insert into stock_transfers (org_id, from_branch, to_branch, note) values (v_org, p_from, p_to, p_note) returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    if (l->>'qty')::int <= 0 or not exists (select 1 from products where id = (l->>'product_id')::uuid and org_id = v_org) then raise exception 'Invalid line'; end if;
    insert into stock_transfer_lines (transfer_id, product_id, qty) values (v_id, (l->>'product_id')::uuid, (l->>'qty')::int);
  end loop;
  return v_id;
end $$;


ALTER FUNCTION "public"."request_stock_transfer"("p_from" "uuid", "p_to" "uuid", "p_lines" "jsonb", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_transfer"("p_from" "uuid", "p_to" "uuid", "p_product" "uuid", "p_qty" integer, "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid := public.current_org(); v_id uuid;
begin
  if v_org is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'Choose two different branches'; end if;
  if not (public.can_access_branch(p_from) or public.can_access_branch(p_to)) then raise exception 'Not authorised for these branches' using errcode = '42501'; end if;
  if (select count(*) from branches where id in (p_from, p_to) and org_id = v_org and is_active) <> 2 then raise exception 'Branches must belong to your organisation'; end if;
  if not exists (select 1 from products where id = p_product and org_id = v_org) then raise exception 'Product not found'; end if;
  insert into branch_transfers (org_id, from_branch, to_branch, product_id, qty, note) values (v_org, p_from, p_to, p_product, p_qty, p_note) returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION "public"."request_transfer"("p_from" "uuid", "p_to" "uuid", "p_product" "uuid", "p_qty" integer, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_org"("p_host" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select coalesce((select org_id from site_domains where host = regexp_replace(lower(coalesce(p_host,'')), '^www\.|:\d+$', '', 'g') limit 1),
                  public.default_org()) $_$;


ALTER FUNCTION "public"."resolve_org"("p_host" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_branch_access"("p_user" "uuid", "p_branch" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare me profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  if me.role_key not in ('owner','admin') and not (me.role_key = 'branch_manager' and public.can_access_branch(p_branch)) then
    raise exception 'Not permitted' using errcode='42501'; end if;
  delete from user_branches where user_id = p_user and branch_id = p_branch and org_id = me.org_id
    and (kind = 'temporary' or me.role_key in ('owner','admin'));
end $$;


ALTER FUNCTION "public"."revoke_branch_access"("p_user" "uuid", "p_branch" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_invitation"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can revoke invitations' using errcode = '42501'; end if;
  update staff_invitations set revoked_at = now() where id = p_id and org_id = public.current_org() and accepted_at is null;
end $$;


ALTER FUNCTION "public"."revoke_invitation"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_temp_assignment"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare a staff_assignments;
begin
  select * into a from staff_assignments where id = p_id and org_id = public.current_org() for update;
  if not found then raise exception 'Assignment not found'; end if;
  if not (public.is_admin() or a.created_by = auth.uid() or (public.is_manager() and public.can_access_branch(a.branch_id))) then
    raise exception 'Not authorised' using errcode = '42501'; end if;
  update staff_assignments set revoked_at = now(), revoked_by = auth.uid() where id = p_id and revoked_at is null;
end $$;


ALTER FUNCTION "public"."revoke_temp_assignment"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sale_events_track"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sale_events_track"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sales_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then new.code := public.next_code(new.org_id, 'sale_' || new.kind, case new.kind when 'quotation' then 'Q-' else 'ORD-' end);
  else new.code := old.code; new.updated_at := now(); end if;
  return new;
end $$;


ALTER FUNCTION "public"."sales_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sales_trend"("p_branch" "uuid" DEFAULT NULL::"uuid", "p_days" integer DEFAULT 14) RETURNS TABLE("day" "date", "amount" numeric, "orders" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select g::date, coalesce(sum(s.grand_total), 0), count(s.id)::int
  from generate_series((now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 90) - 1), (now() at time zone 'Asia/Kolkata')::date, interval '1 day') g
  left join sales s on s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date = g::date
       and (p_branch is null or s.branch_id = p_branch) and s.org_id = public.current_org()
  group by 1 order by 1 $$;


ALTER FUNCTION "public"."sales_trend"("p_branch" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_org_permissions"("p_org" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into role_permissions (org_id, role_key, permission)
  select p_org, r, c.key from permission_catalog c, unnest(c.default_roles) r where r in ('branch_manager','staff') on conflict do nothing $$;


ALTER FUNCTION "public"."seed_org_permissions"("p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_branches"("p_profile" "uuid", "p_branches" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."set_profile_branches"("p_profile" "uuid", "p_branches" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_referral_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.referral_code is null then
    new.referral_code := 'PE'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  end if; return new;
end $$;


ALTER FUNCTION "public"."set_referral_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_role_permission"("p_role" "text", "p_permission" "text", "p_allowed" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Only owners and admins can change permissions' using errcode = '42501';
  end if;
  insert into role_permissions (org_id, role_key, permission, allowed)
  values (public.current_org(), p_role, p_permission, p_allowed)
  on conflict (org_id, role_key, permission)
  do update set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();
end $$;


ALTER FUNCTION "public"."set_role_permission"("p_role" "text", "p_permission" "text", "p_allowed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_staff_active"("p_user" "uuid", "p_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid := public._staff_guard(p_user);
begin
  if p_user = auth.uid() then raise exception 'You cannot deactivate yourself'; end if;
  if not p_active and (select role_key from profiles where id = p_user) = 'owner' then perform public._assert_other_owner(p_user); end if;
  update profiles set deactivated = not p_active, is_approved = p_active where id = p_user;
  if not p_active then delete from user_branches where user_id = p_user and kind = 'temporary'; end if;
end $$;


ALTER FUNCTION "public"."set_staff_active"("p_user" "uuid", "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_staff_branches"("p_user" "uuid", "p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid := public._staff_guard(p_user);
begin
  if coalesce(array_length(p_ids,1),0) = 0 then raise exception 'Assign at least one branch'; end if;
  perform public._set_branches(v_org, p_user, p_ids);
end $$;


ALTER FUNCTION "public"."set_staff_branches"("p_user" "uuid", "p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_staff_role"("p_user" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid := public._staff_guard(p_user, p_role); v_old text;
begin
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  select role_key into v_old from profiles where id = p_user;
  if v_old = 'owner' and p_role <> 'owner' then perform public._assert_other_owner(p_user); end if;
  update profiles set role_key = p_role where id = p_user;
  if p_role in ('owner','admin') then delete from user_branches where user_id = p_user and kind = 'permanent'; end if;
end $$;


ALTER FUNCTION "public"."set_staff_role"("p_user" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sp_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin new.updated_at := now(); return new; end $$;


ALTER FUNCTION "public"."sp_touch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_auth_to_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_org uuid; v_br uuid; v_name text; v_phone text; v_meta text := new.raw_user_meta_data->>'org_id';
begin
  if (new.raw_user_meta_data->>'is_staff') = 'true' then
    insert into public.profiles (id, full_name) values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1))) on conflict (id) do nothing;
    return new;
  end if;
  if exists (select 1 from public.customers where auth_user_id = new.id) then return new; end if;
  if v_meta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then select id into v_org from public.organizations where id = v_meta::uuid; end if;
  if v_org is null then select id into v_org from public.organizations order by created_at limit 1; end if;
  if v_org is null then return new; end if;
  select id into v_br from public.branches where org_id = v_org and is_active order by name limit 1;
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Customer');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '');
  insert into public.customers (org_id, branch_id, full_name, phone, email, auth_user_id, notes) values (v_org, v_br, v_name, v_phone, new.email, new.id, 'Auto-created from website portal');
  return new;
end $_$;


ALTER FUNCTION "public"."sync_auth_to_customer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_pi_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."touch_pi_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_po_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."touch_po_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_org_seed_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin perform public.seed_org_permissions(new.id); return new; end $$;


ALTER FUNCTION "public"."trg_org_seed_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_family_member_org"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if not exists (select 1 from public.customers c where c.id = new.primary_customer_id and c.org_id = new.org_id) then
    raise exception 'Primary customer must belong to the family organisation';
  end if;
  if not exists (select 1 from public.customers c where c.id = new.member_customer_id and c.org_id = new.org_id) then
    raise exception 'Family member must belong to the same organisation';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."validate_family_member_org"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "appt_type" "text" DEFAULT 'Eye Test'::"text" NOT NULL,
    "appt_date" "date" NOT NULL,
    "appt_time" time without time zone NOT NULL,
    "duration_mins" integer DEFAULT 30 NOT NULL,
    "optometrist" "text",
    "notes" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "appointments_appt_type_check" CHECK (("appt_type" = ANY (ARRAY['Eye Test'::"text", 'Contact Lens Fitting'::"text", 'Follow Up'::"text", 'Consultation'::"text", 'Other'::"text"]))),
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'confirmed'::"text", 'arrived'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"(),
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "table_name" "text",
    "row_id" "uuid",
    "action" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text",
    "body" "text",
    "cover_image" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "author" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "blog_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branch_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "from_branch" "uuid" NOT NULL,
    "to_branch" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty" integer NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "note" "text",
    "requested_by" "uuid" DEFAULT "auth"."uid"(),
    "approved_by" "uuid",
    "received_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    CONSTRAINT "branch_transfers_check" CHECK (("from_branch" <> "to_branch")),
    CONSTRAINT "branch_transfers_qty_check" CHECK (("qty" > 0)),
    CONSTRAINT "branch_transfers_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'in_transit'::"text", 'received'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."branch_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true,
    "email" "text",
    "udyam_no" "text",
    "image_path" "text",
    "image_alt" "text",
    "map_embed" "text"
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."branches"."image_path" IS 'Public storage path in site-images bucket: <org_id>/<uuid>.jpg';



COMMENT ON COLUMN "public"."branches"."image_alt" IS 'Alt text for the branch photo';



COMMENT ON COLUMN "public"."branches"."map_embed" IS 'Validated Google Maps embed URL (https://www.google.com/maps…); never raw HTML';



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "name" "text" NOT NULL,
    "manufacturer_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "manufacturer_source_ref" "text",
    "manufacturer_verified_at" timestamp with time zone,
    "manufacturer_verified_by" "uuid",
    CONSTRAINT "brands_manufacturer_status_check" CHECK (("manufacturer_status" = ANY (ARRAY['unverified'::"text", 'pending_review'::"text", 'verified'::"text", 'rejected'::"text", 'discontinued'::"text"]))),
    CONSTRAINT "brands_manufacturer_verified_evidence_check" CHECK ((("manufacturer_status" <> 'verified'::"text") OR ((NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_source_ref", ''::"text")), ''::"text") IS NOT NULL) AND ("manufacturer_verified_at" IS NOT NULL) AND ("manufacturer_verified_by" IS NOT NULL))))
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "lens_package_id" "uuid",
    "option_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "qty" integer DEFAULT 1 NOT NULL,
    "rx_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" DEFAULT "public"."current_org"(),
    "product_name" "text",
    "frame_price" numeric(10,2),
    "lens_package" "text",
    "lens_total" numeric(10,2),
    "total" numeric(10,2),
    "rx_data" "jsonb",
    "notified_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cart_items_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cashbook" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid",
    "direction" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "entry_no" integer DEFAULT 1 NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "method" "text" NOT NULL,
    "category" "text",
    "party" "text",
    "doc_code" "text",
    "reference" "text",
    "memo" "text",
    "sale_id" "uuid",
    "occurred_on" "date" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cashbook_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "cashbook_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"]))),
    CONSTRAINT "cashbook_method_check" CHECK (("method" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'card'::"text", 'bank'::"text", 'razorpay'::"text", 'other'::"text"]))),
    CONSTRAINT "cashbook_source_check" CHECK (("source" = ANY (ARRAY['sale_payment'::"text", 'online_payment'::"text", 'expense'::"text", 'purchase_payment'::"text", 'refund'::"text"])))
);


ALTER TABLE "public"."cashbook" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."counters" (
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "key" "text" NOT NULL,
    "value" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupon_uses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coupon_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "sale_id" "uuid",
    "discount" numeric(10,2) NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coupon_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'percent'::"text" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "min_order" numeric(10,2) DEFAULT 0 NOT NULL,
    "max_uses" integer,
    "uses" integer DEFAULT 0 NOT NULL,
    "per_customer" integer DEFAULT 1 NOT NULL,
    "valid_from" "date",
    "valid_until" "date",
    "applicable_to" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coupons_type_check" CHECK (("type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"])))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_note_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "credit_note_id" "uuid" NOT NULL,
    "original_line_id" "uuid",
    "description" "text" NOT NULL,
    "qty" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "taxable_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "cgst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "sgst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "igst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) NOT NULL,
    CONSTRAINT "credit_note_lines_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."credit_note_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "code" "text",
    "original_sale_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "refund_method" "text",
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_notes_refund_method_check" CHECK (("refund_method" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'card'::"text", 'bank'::"text", 'store_credit'::"text"]))),
    CONSTRAINT "credit_notes_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."credit_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "rx_reminder_enabled" boolean DEFAULT true NOT NULL,
    "rx_reminder_days_before" integer DEFAULT 30 NOT NULL,
    "birthday_enabled" boolean DEFAULT true NOT NULL,
    "birthday_coupon_pct" integer DEFAULT 10 NOT NULL,
    "order_updates_enabled" boolean DEFAULT true NOT NULL,
    "cart_recovery_enabled" boolean DEFAULT true NOT NULL,
    "cart_recovery_hours" integer DEFAULT 4 NOT NULL,
    "wa_provider" "text" DEFAULT 'meta'::"text" NOT NULL,
    "wa_phone_number_id" "text",
    "wa_access_token_set" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cron_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "messages_sent" integer DEFAULT 0 NOT NULL,
    "messages_failed" integer DEFAULT 0 NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "error" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."cron_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."cron_runs" IS 'Execution log for all scheduled automation jobs';



CREATE TABLE IF NOT EXISTS "public"."loyalty_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "ref_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_ledger" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."customer_loyalty_balance" WITH ("security_invoker"='true') AS
 SELECT "org_id",
    "customer_id",
    (COALESCE("sum"("delta"), (0)::bigint))::integer AS "points"
   FROM "public"."loyalty_ledger"
  GROUP BY "org_id", "customer_id";


ALTER VIEW "public"."customer_loyalty_balance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_notification_preferences" (
    "customer_id" "uuid" NOT NULL,
    "order_updates" boolean DEFAULT true NOT NULL,
    "prescription_reminders" boolean DEFAULT true NOT NULL,
    "loyalty_updates" boolean DEFAULT true NOT NULL,
    "appointment_updates" boolean DEFAULT true NOT NULL,
    "promotions" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "href" "text",
    "source_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "customer_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['order'::"text", 'prescription'::"text", 'appointment'::"text", 'loyalty'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."customer_notifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customer_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_number_seq" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."customer_orders" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "code",
    NULL::"text" AS "kind",
    NULL::"text" AS "status",
    NULL::"text" AS "payment_status",
    NULL::numeric(12,2) AS "grand_total",
    NULL::numeric(12,2) AS "paid_total",
    NULL::boolean AS "needs_lab",
    NULL::timestamp with time zone AS "created_at",
    NULL::"jsonb" AS "rx_snapshot",
    NULL::"text" AS "supply_type",
    NULL::"uuid" AS "customer_id",
    NULL::json[] AS "lines";


ALTER VIEW "public"."customer_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_wishlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_wishlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid",
    "customer_code" "text",
    "vision_id" "text",
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "whatsapp" "text",
    "email" "text",
    "referred_by_doctor" "text",
    "gender" "text",
    "dob" "date",
    "address_line1" "text",
    "address_line2" "text",
    "landmark" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "notes" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "referral_code" "text",
    "referred_by_customer" "uuid",
    "gstin" "text",
    "state_code" "text",
    "whatsapp_opt_in" boolean DEFAULT false NOT NULL,
    "whatsapp_opt_in_at" timestamp with time zone,
    CONSTRAINT "customers_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"])))),
    CONSTRAINT "customers_notes_check" CHECK (("char_length"("notes") <= 500))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."whatsapp_opt_in" IS 'Customer consented to receive WhatsApp marketing messages';



COMMENT ON COLUMN "public"."customers"."whatsapp_opt_in_at" IS 'Timestamp when customer gave consent';



CREATE TABLE IF NOT EXISTS "public"."day_closings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "closing_date" "date" NOT NULL,
    "opening_cash" numeric(12,2) DEFAULT 0 NOT NULL,
    "actual_cash" numeric(12,2) NOT NULL,
    "expected_cash" numeric(12,2) DEFAULT 0 NOT NULL,
    "cash_difference" numeric(12,2) DEFAULT 0 NOT NULL,
    "cash_sales" numeric(12,2) DEFAULT 0 NOT NULL,
    "upi_sales" numeric(12,2) DEFAULT 0 NOT NULL,
    "card_sales" numeric(12,2) DEFAULT 0 NOT NULL,
    "bank_sales" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_sales" numeric(12,2) DEFAULT 0 NOT NULL,
    "order_count" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "closed_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."day_closings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "doc_type" "text" NOT NULL,
    "ref_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "max_views" integer,
    "view_count" integer DEFAULT 0 NOT NULL,
    "last_viewed_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "send_count" integer DEFAULT 0 NOT NULL,
    "last_sent_at" timestamp with time zone,
    "pdf_path" "text",
    "pdf_generated_at" timestamp with time zone,
    "last_error" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "document_links_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['sale'::"text", 'rx'::"text", 'repair'::"text", 'lab'::"text", 'credit_note'::"text", 'receipt'::"text", 'appointment'::"text"])))
);


ALTER TABLE "public"."document_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" DEFAULT 'cash'::"text" NOT NULL,
    "reference" "text",
    "receipt_path" "text",
    "approved_by" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expenses_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'card'::"text", 'bank'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."eye_examination_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."eye_examination_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eye_examinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "examiner_name" "text",
    "va_od_dist_ua" "text",
    "va_os_dist_ua" "text",
    "va_od_near_ua" "text",
    "va_os_near_ua" "text",
    "va_od_dist_a" "text",
    "va_os_dist_a" "text",
    "va_od_near_a" "text",
    "va_os_near_a" "text",
    "ar_od_sph" numeric(5,2),
    "ar_od_cyl" numeric(5,2),
    "ar_od_axis" integer,
    "ar_os_sph" numeric(5,2),
    "ar_os_cyl" numeric(5,2),
    "ar_os_axis" integer,
    "od_sph" numeric(5,2),
    "od_cyl" numeric(5,2),
    "od_axis" integer,
    "od_add" numeric(4,2),
    "od_va" "text",
    "os_sph" numeric(5,2),
    "os_cyl" numeric(5,2),
    "os_axis" integer,
    "os_add" numeric(4,2),
    "os_va" "text",
    "pd_far" numeric(4,1),
    "pd_near" numeric(4,1),
    "cover_test" "text" DEFAULT 'orthophoria'::"text",
    "iop_od" numeric(4,1),
    "iop_os" numeric(4,1),
    "colour_vision" "text" DEFAULT 'normal'::"text",
    "confrontation" "text" DEFAULT 'full'::"text",
    "anterior_od" "text" DEFAULT 'clear'::"text",
    "anterior_os" "text" DEFAULT 'clear'::"text",
    "fundus_od" "text",
    "fundus_os" "text",
    "disc_od" "text",
    "disc_os" "text",
    "cup_disc_od" "text",
    "cup_disc_os" "text",
    "macula_od" "text",
    "macula_os" "text",
    "vessels_od" "text",
    "vessels_os" "text",
    "rx_type" "text",
    "recommended_index" numeric(4,2),
    "lens_recommendation" "text",
    "notes" "text",
    "next_review_months" integer DEFAULT 24,
    "prescription_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."eye_examinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_member_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "member_name" "text" NOT NULL,
    "member_phone" "text" NOT NULL,
    "relationship" "text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "family_member_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."family_member_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "primary_customer_id" "uuid" NOT NULL,
    "member_customer_id" "uuid" NOT NULL,
    "relationship" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "member_label" "text" NOT NULL,
    CONSTRAINT "family_member_not_self" CHECK (("primary_customer_id" <> "member_customer_id"))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gst_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "period_year" integer NOT NULL,
    "period_month" integer NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "output_cgst" numeric(12,2),
    "output_sgst" numeric(12,2),
    "output_igst" numeric(12,2),
    "input_cgst" numeric(12,2),
    "input_sgst" numeric(12,2),
    "input_igst" numeric(12,2),
    "net_liability" numeric(12,2),
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gst_periods_period_month_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12))),
    CONSTRAINT "gst_periods_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."gst_periods" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."household_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."household_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid",
    "supplier_id" "uuid",
    "supplier_name" "text" NOT NULL,
    "supplier_gstin" "text",
    "invoice_no" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "supply_type" "text" DEFAULT 'intrastate'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_on" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "due_date" "date",
    "po_ref" "text",
    "lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "taxable_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "paid_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_date" "date",
    "payment_mode" "text",
    "payment_ref" "text",
    "itc_eligible" boolean DEFAULT true NOT NULL,
    "itc_claimed" boolean DEFAULT false NOT NULL,
    "itc_claim_period" "text",
    "gstr2a_matched" boolean DEFAULT false NOT NULL,
    "attachment_path" "text",
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stock_posted_at" timestamp with time zone,
    CONSTRAINT "purchase_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "purchase_invoices_supply_type_check" CHECK (("supply_type" = ANY (ARRAY['intrastate'::"text", 'interstate'::"text"])))
);


ALTER TABLE "public"."purchase_invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchase_invoices"."lines" IS 'Array of {description, hsn, qty, rate, tax_pct, product_id?}. When product_id is set, receiving the invoice posts a stock movement.';



COMMENT ON COLUMN "public"."purchase_invoices"."stock_posted_at" IS 'Timestamp when stock was received against this invoice (idempotency guard).';



CREATE OR REPLACE VIEW "public"."itc_summary" WITH ("security_invoker"='true') AS
 SELECT "org_id",
    "to_char"(("invoice_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "period",
    ("count"(*))::integer AS "invoice_count",
    ("sum"("grand_total"))::numeric(14,2) AS "total_purchases",
    ("sum"(
        CASE
            WHEN "itc_eligible" THEN "cgst_amount"
            ELSE (0)::numeric
        END))::numeric(14,2) AS "eligible_cgst",
    ("sum"(
        CASE
            WHEN "itc_eligible" THEN "sgst_amount"
            ELSE (0)::numeric
        END))::numeric(14,2) AS "eligible_sgst",
    ("sum"(
        CASE
            WHEN "itc_eligible" THEN "igst_amount"
            ELSE (0)::numeric
        END))::numeric(14,2) AS "eligible_igst",
    ("sum"(
        CASE
            WHEN "itc_eligible" THEN (("cgst_amount" + "sgst_amount") + "igst_amount")
            ELSE (0)::numeric
        END))::numeric(14,2) AS "total_itc",
    ("sum"(
        CASE
            WHEN "itc_claimed" THEN (("cgst_amount" + "sgst_amount") + "igst_amount")
            ELSE (0)::numeric
        END))::numeric(14,2) AS "claimed_itc"
   FROM "public"."purchase_invoices"
  WHERE ("status" <> 'cancelled'::"text")
  GROUP BY "org_id", ("to_char"(("invoice_date")::timestamp with time zone, 'YYYY-MM'::"text"));


ALTER VIEW "public"."itc_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_events" (
    "id" bigint NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "lab_order_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "note" "text",
    "by_user" "uuid" DEFAULT "auth"."uid"(),
    "at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lab_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lab_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lab_events_id_seq" OWNED BY "public"."lab_events"."id";



CREATE TABLE IF NOT EXISTS "public"."lab_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "sale_line_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "code" "text",
    "status" "text" DEFAULT 'to_buy'::"text" NOT NULL,
    "lens_package_id" "uuid",
    "lens_desc" "text" NOT NULL,
    "lens_details" "text",
    "frame_desc" "text",
    "frame_product_id" "uuid",
    "rx_code" "text",
    "od_sph" numeric(4,2),
    "od_cyl" numeric(4,2),
    "od_axis" integer,
    "od_add" numeric(4,2),
    "os_sph" numeric(4,2),
    "os_cyl" numeric(4,2),
    "os_axis" integer,
    "os_add" numeric(4,2),
    "pd_far" numeric(4,1),
    "pd_near" numeric(4,1),
    "supplier_name" "text",
    "ordered_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "due_date" "date",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "assigned_to" "text",
    "qc_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "patient_customer_id" "uuid" NOT NULL,
    CONSTRAINT "lab_orders_priority_check" CHECK (("priority" = ANY (ARRAY['normal'::"text", 'urgent'::"text"]))),
    CONSTRAINT "lab_orders_status_check" CHECK (("status" = ANY (ARRAY['to_buy'::"text", 'ordered'::"text", 'received'::"text", 'edging'::"text", 'fitting'::"text", 'qc'::"text", 'ready'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."lab_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lens_compatibility_evaluation_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "evaluation_run_id" "uuid" NOT NULL,
    "lens_package_id" "uuid" NOT NULL,
    "manufacturer_sku_snapshot" "text",
    "candidate_position" integer NOT NULL,
    "eligible" boolean NOT NULL,
    "match_type" "text" NOT NULL,
    "matched_rule_id" "uuid",
    "matched_option_combination_id" "uuid",
    "preference_score" numeric(8,2),
    "od_result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "os_result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reason_details" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lens_compatibility_evaluation_candidat_candidate_position_check" CHECK (("candidate_position" > 0)),
    CONSTRAINT "lens_compatibility_evaluation_candidates_check" CHECK (((("eligible" = true) AND ("match_type" = ANY (ARRAY['exact'::"text", 'nearest_eligible'::"text"]))) OR (("eligible" = false) AND ("match_type" = 'ineligible'::"text")))),
    CONSTRAINT "lens_compatibility_evaluation_candidates_match_type_check" CHECK (("match_type" = ANY (ARRAY['exact'::"text", 'nearest_eligible'::"text", 'ineligible'::"text"]))),
    CONSTRAINT "lens_compatibility_evaluation_candidates_od_result_check" CHECK (("jsonb_typeof"("od_result") = 'object'::"text")),
    CONSTRAINT "lens_compatibility_evaluation_candidates_os_result_check" CHECK (("jsonb_typeof"("os_result") = 'object'::"text")),
    CONSTRAINT "lens_compatibility_evaluation_candidates_reason_details_check" CHECK (("jsonb_typeof"("reason_details") = 'array'::"text"))
);


ALTER TABLE "public"."lens_compatibility_evaluation_candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."lens_compatibility_evaluation_candidates" IS 'Per-package OD/OS pass/fail evidence and reason details for each PALRE run.';



CREATE TABLE IF NOT EXISTS "public"."lens_compatibility_evaluation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "prescription_id" "uuid" NOT NULL,
    "design_family" "text" NOT NULL,
    "result_status" "text" NOT NULL,
    "preferred_index" numeric(4,2),
    "measurements" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "engine_version" "text" DEFAULT 'palre-3.2.0'::"text" NOT NULL,
    "evaluated_by" "uuid" NOT NULL,
    "evaluated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lens_compatibility_evaluation_runs_design_family_check" CHECK (("design_family" = ANY (ARRAY['SV'::"text", 'BF'::"text", 'PROG'::"text", 'OCC'::"text"]))),
    CONSTRAINT "lens_compatibility_evaluation_runs_measurements_check" CHECK (("jsonb_typeof"("measurements") = 'object'::"text")),
    CONSTRAINT "lens_compatibility_evaluation_runs_preferred_index_check" CHECK ((("preferred_index" IS NULL) OR (("preferred_index" >= 1.00) AND ("preferred_index" <= 2.00)))),
    CONSTRAINT "lens_compatibility_evaluation_runs_result_status_check" CHECK (("result_status" = ANY (ARRAY['exact_match'::"text", 'nearest_eligible_match'::"text", 'no_eligible_match'::"text"])))
);


ALTER TABLE "public"."lens_compatibility_evaluation_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."lens_compatibility_evaluation_runs" IS 'Append-only PALRE compatibility runs linked to the existing prescription master.';



CREATE TABLE IF NOT EXISTS "public"."lens_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "grp" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_pct" numeric(4,1) DEFAULT 5 NOT NULL,
    "badge" "text",
    "designs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "lens_options_grp_check" CHECK (("grp" = ANY (ARRAY['index'::"text", 'addon'::"text"]))),
    CONSTRAINT "lens_options_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'draft'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."lens_options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lens_options"."images" IS 'Public storage paths in product-images bucket: <org_id>/<uuid>.jpg';



CREATE TABLE IF NOT EXISTS "public"."lens_package_compatibility_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "lens_package_id" "uuid" NOT NULL,
    "rule_code" "text" NOT NULL,
    "design_family" "text" NOT NULL,
    "sph_min" numeric(6,2),
    "sph_max" numeric(6,2),
    "cyl_min" numeric(6,2),
    "cyl_max" numeric(6,2),
    "cylinder_convention" "text" NOT NULL,
    "add_min" numeric(5,2),
    "add_max" numeric(5,2),
    "required_measurements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "required_rx_fields" "text"[] DEFAULT ARRAY['od.sph'::"text", 'os.sph'::"text"] NOT NULL,
    "manufacturer_constraints" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "verification_status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "manufacturer_source_ref" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "rule_version" integer DEFAULT 1 NOT NULL,
    "effective_from" "date",
    "effective_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "lens_package_compatibility_rules_check" CHECK ((("sph_min" IS NULL) OR ("sph_max" IS NULL) OR ("sph_min" <= "sph_max"))),
    CONSTRAINT "lens_package_compatibility_rules_check1" CHECK ((("cyl_min" IS NULL) OR ("cyl_max" IS NULL) OR ("cyl_min" <= "cyl_max"))),
    CONSTRAINT "lens_package_compatibility_rules_check2" CHECK ((("add_min" IS NULL) OR ("add_max" IS NULL) OR ("add_min" <= "add_max"))),
    CONSTRAINT "lens_package_compatibility_rules_check3" CHECK ((("effective_to" IS NULL) OR ("effective_from" IS NULL) OR ("effective_to" >= "effective_from"))),
    CONSTRAINT "lens_package_compatibility_rules_check4" CHECK ((("verification_status" <> 'verified'::"text") OR ((NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_source_ref", ''::"text")), ''::"text") IS NOT NULL) AND ("verified_at" IS NOT NULL) AND ("verified_by" IS NOT NULL)))),
    CONSTRAINT "lens_package_compatibility_rules_cylinder_convention_check" CHECK (("cylinder_convention" = ANY (ARRAY['minus'::"text", 'plus'::"text"]))),
    CONSTRAINT "lens_package_compatibility_rules_design_family_check" CHECK (("design_family" = ANY (ARRAY['SV'::"text", 'BF'::"text", 'PROG'::"text", 'OCC'::"text"]))),
    CONSTRAINT "lens_package_compatibility_rules_rule_version_check" CHECK (("rule_version" > 0)),
    CONSTRAINT "lens_package_compatibility_rules_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending_review'::"text", 'verified'::"text", 'rejected'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."lens_package_compatibility_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."lens_package_compatibility_rules" IS 'Manufacturer-source-backed, versioned clinical compatibility rules; no heuristic defaults.';



CREATE TABLE IF NOT EXISTS "public"."lens_package_option_combination_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "combination_id" "uuid" NOT NULL,
    "package_option_eligibility_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lens_package_option_combination_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."lens_package_option_combination_items" IS 'Members of a verified manufacturer option combination, referencing package-specific verified eligibility rows.';



CREATE TABLE IF NOT EXISTS "public"."lens_package_option_combinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "lens_package_id" "uuid" NOT NULL,
    "combination_code" "text" NOT NULL,
    "verification_status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "manufacturer_source_ref" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lens_package_option_combinations_check" CHECK ((("verification_status" <> 'verified'::"text") OR ((NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_source_ref", ''::"text")), ''::"text") IS NOT NULL) AND ("verified_at" IS NOT NULL) AND ("verified_by" IS NOT NULL)))),
    CONSTRAINT "lens_package_option_combinations_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending_review'::"text", 'verified'::"text", 'rejected'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."lens_package_option_combinations" OWNER TO "postgres";


COMMENT ON TABLE "public"."lens_package_option_combinations" IS 'Manufacturer-verified combinations of index/coating/add-on options for a lens package.';



CREATE TABLE IF NOT EXISTS "public"."lens_package_option_eligibility" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "lens_package_id" "uuid" NOT NULL,
    "lens_option_id" "uuid" NOT NULL,
    "inclusion_type" "text" DEFAULT 'optional'::"text" NOT NULL,
    "price_override" numeric(10,2),
    "verification_status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "manufacturer_source_ref" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lens_package_option_eligibility_check" CHECK ((("verification_status" <> 'verified'::"text") OR ((NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_source_ref", ''::"text")), ''::"text") IS NOT NULL) AND ("verified_at" IS NOT NULL) AND ("verified_by" IS NOT NULL)))),
    CONSTRAINT "lens_package_option_eligibility_inclusion_type_check" CHECK (("inclusion_type" = ANY (ARRAY['included'::"text", 'optional'::"text", 'not_available'::"text"]))),
    CONSTRAINT "lens_package_option_eligibility_price_override_check" CHECK ((("price_override" IS NULL) OR ("price_override" >= (0)::numeric))),
    CONSTRAINT "lens_package_option_eligibility_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending_review'::"text", 'verified'::"text", 'rejected'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."lens_package_option_eligibility" OWNER TO "postgres";


COMMENT ON TABLE "public"."lens_package_option_eligibility" IS 'Verified package-specific index/coating/add-on eligibility; generic options are not proof.';



CREATE TABLE IF NOT EXISTS "public"."lens_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "design" "text" NOT NULL,
    "segment" "text",
    "short_desc" "text",
    "base_price" numeric(10,2) NOT NULL,
    "mrp" numeric(10,2),
    "tax_pct" numeric(4,1) DEFAULT 5 NOT NULL,
    "features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "indexes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "coatings" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sph_min" numeric(4,2),
    "sph_max" numeric(4,2),
    "cyl_max" numeric(4,2),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "manufacturer_brand_id" "uuid",
    "manufacturer_sku" "text",
    "manufacturer_design_code" "text",
    "material_code" "text",
    "catalog_verification_status" "text" DEFAULT 'not_verified'::"text" NOT NULL,
    "manufacturer_source_ref" "text",
    "specification_verified_at" timestamp with time zone,
    "specification_verified_by" "uuid",
    "catalog_version" integer DEFAULT 1 NOT NULL,
    "palre_tier" "text",
    "min_sph" numeric(5,2) DEFAULT '-20.0'::numeric,
    "max_sph" numeric(5,2) DEFAULT 20.0,
    "min_cyl" numeric(5,2) DEFAULT '-6.0'::numeric,
    "max_cyl" numeric(5,2) DEFAULT 0.0,
    "min_add" numeric(4,2) DEFAULT 0.0,
    "max_add" numeric(4,2) DEFAULT 4.0,
    "available_indexes" "text"[] DEFAULT ARRAY['1.56'::"text", '1.60'::"text", '1.67'::"text"],
    "included_coatings" "text"[] DEFAULT ARRAY['ar'::"text"],
    "min_age" integer DEFAULT 0,
    "max_age" integer DEFAULT 120,
    "images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "supplier_id" "uuid",
    "cost_price" numeric(12,2),
    "tier" "text",
    "min_frame_height" numeric(4,1),
    "min_frame_width" numeric(4,1),
    CONSTRAINT "lens_packages_catalog_verification_status_check" CHECK (("catalog_verification_status" = ANY (ARRAY['not_verified'::"text", 'pending_review'::"text", 'verified'::"text", 'rejected'::"text", 'discontinued'::"text"]))),
    CONSTRAINT "lens_packages_catalog_version_check" CHECK (("catalog_version" > 0)),
    CONSTRAINT "lens_packages_design_palre_check" CHECK (("design" = ANY (ARRAY['single_vision'::"text", 'progressive'::"text", 'bifocal'::"text", 'reading'::"text", 'non_prescription'::"text", 'plano'::"text", 'occupational'::"text"]))),
    CONSTRAINT "lens_packages_palre_tier_check" CHECK ((("palre_tier" IS NULL) OR ("palre_tier" = ANY (ARRAY['good'::"text", 'better'::"text", 'best'::"text", 'premium'::"text"])))),
    CONSTRAINT "lens_packages_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'draft'::"text", 'inactive'::"text"]))),
    CONSTRAINT "lens_packages_tier_check" CHECK (("tier" = ANY (ARRAY['good'::"text", 'better'::"text", 'best'::"text", 'premium'::"text"]))),
    CONSTRAINT "lens_packages_verified_evidence_check" CHECK ((("catalog_verification_status" <> 'verified'::"text") OR (("manufacturer_brand_id" IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_sku", ''::"text")), ''::"text") IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_design_code", ''::"text")), ''::"text") IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE("manufacturer_source_ref", ''::"text")), ''::"text") IS NOT NULL) AND ("specification_verified_at" IS NOT NULL) AND ("specification_verified_by" IS NOT NULL))))
);


ALTER TABLE "public"."lens_packages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lens_packages"."design" IS 'single_vision | progressive | bifocal | reading | plano | occupational';



COMMENT ON COLUMN "public"."lens_packages"."catalog_verification_status" IS 'PALRE gate: only verified manufacturer catalogue records may be recommended.';



COMMENT ON COLUMN "public"."lens_packages"."palre_tier" IS 'Optional curated presentation tier. NULL is valid; never infer tier from price.';



COMMENT ON COLUMN "public"."lens_packages"."available_indexes" IS 'Array of lens index values this package is available in';



COMMENT ON COLUMN "public"."lens_packages"."included_coatings" IS 'Coatings already included in base_price (ar, scratch, blue_light, uv400, etc.)';



COMMENT ON COLUMN "public"."lens_packages"."images" IS 'Public storage paths in product-images bucket: <org_id>/<uuid>.jpg';



CREATE TABLE IF NOT EXISTS "public"."loyalty_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "earn_rate" integer DEFAULT 10 NOT NULL,
    "redeem_rate" integer DEFAULT 100 NOT NULL,
    "min_redeem" integer DEFAULT 100 NOT NULL,
    "max_redeem_pct" integer DEFAULT 20 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "key" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "body_auto" "text" NOT NULL,
    "body_staff" "text" NOT NULL,
    "meta_template" "text",
    "variables" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "description" "text",
    "image_url" "text",
    "badge" "text",
    "coupon_code" "text",
    "bg_color" "text" DEFAULT '#0B1B36'::"text",
    "text_color" "text" DEFAULT '#FFFFFF'::"text",
    "cta_label" "text" DEFAULT 'Shop Now'::"text",
    "cta_href" "text" DEFAULT '/eyeglasses'::"text",
    "valid_from" "date",
    "valid_until" "date",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."online_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "sale_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "razorpay_order_id" "text" NOT NULL,
    "razorpay_payment_id" "text",
    "razorpay_signature" "text",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "online_payments_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'paid'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."online_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "po_no" "text" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "supplier_name" "text" NOT NULL,
    "supplier_gstin" "text",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "expected_date" "date",
    "supply_type" "text" DEFAULT 'intrastate'::"text" NOT NULL,
    "lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "taxable_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "approved_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "invoice_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'partially_received'::"text", 'received'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "purchase_orders_supply_type_check" CHECK (("supply_type" = ANY (ARRAY['intrastate'::"text", 'interstate'::"text"])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchase_orders"."lines" IS 'Array of {product_id, sku, description, hsn, qty, rate, tax_pct, received_qty}. received_qty is the quantity already booked by goods receipts.';



CREATE OR REPLACE VIEW "public"."open_po_value" AS
 SELECT "org_id",
    "branch_id",
    "supplier_id",
    ("count"(*))::integer AS "open_po_count",
    ("sum"("grand_total"))::numeric(14,2) AS "ordered_value"
   FROM "public"."purchase_orders"
  WHERE ("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'partially_received'::"text"]))
  GROUP BY "org_id", "branch_id", "supplier_id";


ALTER VIEW "public"."open_po_value" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_domains" (
    "domain" "text" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "org_domains_domain_check" CHECK ((("domain" = "lower"("domain")) AND ("domain" ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'::"text")))
);


ALTER TABLE "public"."org_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_settings" (
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL
);


ALTER TABLE "public"."org_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."palre_fulfilment_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "lens_package_id" "uuid" NOT NULL,
    "prescription_fingerprint" "text" NOT NULL,
    "branch_id" "uuid",
    "source_system" "text" NOT NULL,
    "match_scope" "text" NOT NULL,
    "status" "text" NOT NULL,
    "od_available" boolean,
    "os_available" boolean,
    "available_quantity" integer,
    "lead_time_days" integer,
    "source_snapshot_ref" "text" NOT NULL,
    "snapshot_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "palre_fulfilment_snapshots_available_quantity_check" CHECK ((("available_quantity" IS NULL) OR ("available_quantity" >= 0))),
    CONSTRAINT "palre_fulfilment_snapshots_check" CHECK (("expires_at" > "snapshot_at")),
    CONSTRAINT "palre_fulfilment_snapshots_lead_time_days_check" CHECK ((("lead_time_days" IS NULL) OR ("lead_time_days" >= 0))),
    CONSTRAINT "palre_fulfilment_snapshots_match_scope_check" CHECK (("match_scope" = ANY (ARRAY['exact_prescription'::"text", 'package_only'::"text"]))),
    CONSTRAINT "palre_fulfilment_snapshots_source_system_check" CHECK (("source_system" = 'lpims'::"text")),
    CONSTRAINT "palre_fulfilment_snapshots_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'partial'::"text", 'not_available'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."palre_fulfilment_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."palre_fulfilment_snapshots" IS 'Prescription-specific LPIMS fulfilment snapshots; package-only snapshots are never shown as confirmed exact availability.';



CREATE TABLE IF NOT EXISTS "public"."palre_recommendation_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "recommendation_run_id" "uuid" NOT NULL,
    "lens_package_id" "uuid" NOT NULL,
    "candidate_position" integer NOT NULL,
    "tier" "text",
    "match_type" "text" NOT NULL,
    "candidate_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "palre_recommendation_candidates_candidate_position_check" CHECK (("candidate_position" > 0)),
    CONSTRAINT "palre_recommendation_candidates_candidate_snapshot_check" CHECK (("jsonb_typeof"("candidate_snapshot") = 'object'::"text")),
    CONSTRAINT "palre_recommendation_candidates_match_type_check" CHECK (("match_type" = ANY (ARRAY['exact'::"text", 'nearest_eligible'::"text"]))),
    CONSTRAINT "palre_recommendation_candidates_tier_check" CHECK ((("tier" IS NULL) OR ("tier" = ANY (ARRAY['good'::"text", 'better'::"text", 'best'::"text", 'premium'::"text"]))))
);


ALTER TABLE "public"."palre_recommendation_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."palre_recommendation_events" (
    "id" bigint NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "recommendation_run_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "palre_recommendation_events_event_payload_check" CHECK (("jsonb_typeof"("event_payload") = 'object'::"text"))
);


ALTER TABLE "public"."palre_recommendation_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."palre_recommendation_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."palre_recommendation_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."palre_recommendation_events_id_seq" OWNED BY "public"."palre_recommendation_events"."id";



CREATE TABLE IF NOT EXISTS "public"."palre_recommendation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "prescription_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "compatibility_run_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "recommendation_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "engine_version" "text" DEFAULT 'palre-3.3.0'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "palre_recommendation_runs_recommendation_snapshot_check" CHECK (("jsonb_typeof"("recommendation_snapshot") = 'object'::"text")),
    CONSTRAINT "palre_recommendation_runs_status_check" CHECK (("status" = ANY (ARRAY['awaiting_optometrist_review'::"text", 'no_eligible_match'::"text", 'superseded'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."palre_recommendation_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."palre_recommendation_runs" IS 'Versioned PALRE recommendation snapshots awaiting mandatory optometrist review.';



CREATE OR REPLACE VIEW "public"."palre_verified_lens_catalogue" WITH ("security_invoker"='true') AS
 SELECT "lp"."id",
    "lp"."org_id",
    "lp"."code",
    "lp"."name",
    "lp"."design",
    "lp"."segment",
    "lp"."base_price",
    "lp"."mrp",
    "lp"."tax_pct",
    "lp"."manufacturer_brand_id",
    "b"."name" AS "manufacturer_name",
    "lp"."manufacturer_sku",
    "lp"."manufacturer_design_code",
    "lp"."material_code",
    "lp"."catalog_version"
   FROM ("public"."lens_packages" "lp"
     JOIN "public"."brands" "b" ON ((("b"."id" = "lp"."manufacturer_brand_id") AND ("b"."org_id" = "lp"."org_id"))))
  WHERE (("lp"."status" = 'active'::"text") AND ("lp"."catalog_verification_status" = 'verified'::"text") AND ("b"."manufacturer_status" = 'verified'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."lens_package_compatibility_rules" "cr"
          WHERE (("cr"."org_id" = "lp"."org_id") AND ("cr"."lens_package_id" = "lp"."id") AND ("cr"."verification_status" = 'verified'::"text") AND ("cr"."manufacturer_source_ref" IS NOT NULL) AND ("cr"."verified_at" IS NOT NULL) AND ("cr"."verified_by" IS NOT NULL) AND (("cr"."effective_from" IS NULL) OR ("cr"."effective_from" <= CURRENT_DATE)) AND (("cr"."effective_to" IS NULL) OR ("cr"."effective_to" >= CURRENT_DATE))))));


ALTER VIEW "public"."palre_verified_lens_catalogue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "method" "text" NOT NULL,
    "reference" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_method_check" CHECK (("method" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'card'::"text", 'bank'::"text", 'razorpay'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_catalog" (
    "key" "text" NOT NULL,
    "description" "text" NOT NULL,
    "default_roles" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."permission_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prescription_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "prescription_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "performed_by" "uuid",
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    CONSTRAINT "prescription_audit_log_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'approved'::"text", 'rejected'::"text", 'corrected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."prescription_audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."prescription_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."prescription_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prescriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "rx_code" "text",
    "rx_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_till" "date",
    "examined_by" "text",
    "rx_type" "text" DEFAULT 'Spectacle'::"text" NOT NULL,
    "purpose" "text" DEFAULT 'Distance'::"text" NOT NULL,
    "od_sph" numeric(4,2),
    "od_cyl" numeric(4,2),
    "od_axis" integer,
    "od_add" numeric(4,2),
    "od_va_dist" "text",
    "od_va_near" "text",
    "os_sph" numeric(4,2),
    "os_cyl" numeric(4,2),
    "os_axis" integer,
    "os_add" numeric(4,2),
    "os_va_dist" "text",
    "os_va_near" "text",
    "pd_far" numeric(4,1),
    "pd_near" numeric(4,1),
    "remarks" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "image_path" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cylinder_convention" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "family_member_id" "uuid",
    "external_practice" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "od_prism" numeric(4,2),
    "od_base" "text",
    "os_prism" numeric(4,2),
    "os_base" "text",
    "segment_height" numeric(4,1),
    "fitting_height" numeric(4,1),
    "monocular_pd_far" numeric(4,1),
    "monocular_pd_near" numeric(4,1),
    CONSTRAINT "prescriptions_cylinder_convention_check" CHECK (("cylinder_convention" = ANY (ARRAY['unknown'::"text", 'minus'::"text", 'plus'::"text"]))),
    CONSTRAINT "prescriptions_od_axis_check" CHECK ((("od_axis" >= 0) AND ("od_axis" <= 180))),
    CONSTRAINT "prescriptions_od_base_check" CHECK (("od_base" = ANY (ARRAY['BU'::"text", 'BD'::"text", 'BI'::"text", 'BO'::"text"]))),
    CONSTRAINT "prescriptions_os_axis_check" CHECK ((("os_axis" >= 0) AND ("os_axis" <= 180))),
    CONSTRAINT "prescriptions_os_base_check" CHECK (("os_base" = ANY (ARRAY['BU'::"text", 'BD'::"text", 'BI'::"text", 'BO'::"text"]))),
    CONSTRAINT "prescriptions_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'correction_requested'::"text"]))),
    CONSTRAINT "prescriptions_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'ocr'::"text", 'external'::"text"])))
);


ALTER TABLE "public"."prescriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."prescriptions"."cylinder_convention" IS 'PALRE safety field. Existing prescriptions default to unknown and cannot be evaluated against manufacturer CYL ranges until explicitly confirmed.';



CREATE TABLE IF NOT EXISTS "public"."product_costs" (
    "product_id" "uuid" NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "cost_price" numeric(10,2),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_costs_cost_price_check" CHECK ((("cost_price" IS NULL) OR ("cost_price" >= (0)::numeric)))
);


ALTER TABLE "public"."product_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "reviewer_name" "text" NOT NULL,
    "reviewer_email" "text",
    "rating" integer NOT NULL,
    "title" "text",
    "body" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "verified_purchase" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "product_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_review_summary" AS
 SELECT "product_id",
    ("count"(*))::integer AS "total_reviews",
    "round"("avg"("rating"), 1) AS "avg_rating",
    ("count"(*) FILTER (WHERE ("rating" = 5)))::integer AS "r5",
    ("count"(*) FILTER (WHERE ("rating" = 4)))::integer AS "r4",
    ("count"(*) FILTER (WHERE ("rating" = 3)))::integer AS "r3",
    ("count"(*) FILTER (WHERE ("rating" = 2)))::integer AS "r2",
    ("count"(*) FILTER (WHERE ("rating" = 1)))::integer AS "r1"
   FROM "public"."product_reviews"
  WHERE ("status" = 'approved'::"text")
  GROUP BY "product_id";


ALTER VIEW "public"."product_review_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_view_counts" (
    "product_id" "uuid" NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "today_views" integer DEFAULT 0 NOT NULL,
    "counted_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_view_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "kind" "text" NOT NULL,
    "sku" "text",
    "barcode" "text",
    "brand_id" "uuid",
    "model" "text" NOT NULL,
    "collection" "text",
    "gender" "text" DEFAULT 'unisex'::"text" NOT NULL,
    "mrp" numeric(10,2),
    "selling_price" numeric(10,2) NOT NULL,
    "tax_pct" numeric(4,1) DEFAULT 5 NOT NULL,
    "power_eligible" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "visible_on_website" boolean DEFAULT false NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "new_arrival" boolean DEFAULT false NOT NULL,
    "bestseller" boolean DEFAULT false NOT NULL,
    "short_desc" "text",
    "description" "text",
    "images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "attrs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hsn" "text",
    "price_mode" "text" DEFAULT 'inclusive'::"text" NOT NULL,
    "on_display" boolean DEFAULT true NOT NULL,
    "display_section" "text" DEFAULT 'shelf'::"text" NOT NULL,
    "shelf_location" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "products_check" CHECK (((NOT "power_eligible") OR ("kind" = ANY (ARRAY['frame'::"text", 'sunglass'::"text"])))),
    CONSTRAINT "products_display_section_check" CHECK (("display_section" = ANY (ARRAY['window'::"text", 'counter'::"text", 'wall'::"text", 'shelf'::"text", 'back_store'::"text"]))),
    CONSTRAINT "products_gender_check" CHECK (("gender" = ANY (ARRAY['men'::"text", 'women'::"text", 'unisex'::"text", 'kids'::"text"]))),
    CONSTRAINT "products_kind_check" CHECK (("kind" = ANY (ARRAY['frame'::"text", 'sunglass'::"text", 'contact_lens'::"text", 'accessory'::"text"]))),
    CONSTRAINT "products_price_mode_check" CHECK (("price_mode" = ANY (ARRAY['inclusive'::"text", 'exclusive'::"text"]))),
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'draft'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_branches" (
    "profile_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"(),
    "full_name" "text",
    "role_key" "text" DEFAULT 'staff'::"text" NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid",
    "phone" "text",
    "deactivated" boolean DEFAULT false NOT NULL,
    "branch_reviewed" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profiles_role_key_chk" CHECK (("role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'branch_manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock" (
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty" integer DEFAULT 0 NOT NULL,
    "reorder_level" integer DEFAULT 0 NOT NULL,
    "reserved_qty" integer DEFAULT 0 NOT NULL,
    "available_qty" integer GENERATED ALWAYS AS (("qty" - "reserved_qty")) STORED,
    CONSTRAINT "stock_qty_check" CHECK (("qty" >= 0))
);


ALTER TABLE "public"."stock" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_catalog" AS
 SELECT "p"."id",
    "p"."org_id",
    "p"."kind",
    "p"."sku",
    "b"."name" AS "brand",
    "p"."model",
    "p"."collection",
    "p"."gender",
    "p"."selling_price",
    "p"."mrp",
    "p"."power_eligible",
    "p"."featured",
    "p"."new_arrival",
    "p"."bestseller",
    "p"."short_desc",
    "p"."description",
    "p"."images",
    "p"."attrs",
    (COALESCE(( SELECT "sum"("s"."qty") AS "sum"
           FROM "public"."stock" "s"
          WHERE ("s"."product_id" = "p"."id")), (0)::bigint) > 0) AS "in_stock",
    (COALESCE(( SELECT "sum"("s"."qty") AS "sum"
           FROM "public"."stock" "s"
          WHERE ("s"."product_id" = "p"."id")), (0)::bigint))::integer AS "stock_qty",
    COALESCE("v"."today_views", 0) AS "today_views"
   FROM (("public"."products" "p"
     LEFT JOIN "public"."brands" "b" ON (("b"."id" = "p"."brand_id")))
     LEFT JOIN "public"."product_view_counts" "v" ON (("v"."product_id" = "p"."id")))
  WHERE ("p"."visible_on_website" AND ("p"."status" = 'active'::"text") AND ("p"."org_id" = "public"."request_org"()));


ALTER VIEW "public"."public_catalog" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_site_settings" AS
 SELECT "key",
    "value"
   FROM "public"."org_settings"
  WHERE (("org_id" = "public"."request_org"()) AND ("key" = ANY (ARRAY['whatsapp_number'::"text", 'instagram'::"text", 'analytics_id'::"text"])));


ALTER VIEW "public"."public_site_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "hsn" "text",
    "qty" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "tax_pct" numeric(4,1) DEFAULT 18 NOT NULL,
    "taxable_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) NOT NULL
);


ALTER TABLE "public"."purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "note" "text",
    "received_by" "uuid" DEFAULT "auth"."uid"(),
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."purchase_order_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "hits" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referee_id" "uuid",
    "referee_email" "text",
    "referral_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "referrer_points" integer DEFAULT 200 NOT NULL,
    "referee_discount" integer DEFAULT 100 NOT NULL,
    "converted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "referrals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'converted'::"text", 'rewarded'::"text"])))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repair_events" (
    "id" bigint NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "repair_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "note" "text",
    "by_user" "uuid" DEFAULT "auth"."uid"(),
    "at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."repair_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."repair_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."repair_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."repair_events_id_seq" OWNED BY "public"."repair_events"."id";



CREATE TABLE IF NOT EXISTS "public"."repairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "code" "text",
    "customer_id" "uuid",
    "referred_by" "text",
    "item_brand" "text",
    "item_model" "text",
    "item_type" "text",
    "item_color" "text",
    "frame_no" "text",
    "problem" "text" NOT NULL,
    "technician_notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "assigned_to" "text",
    "due_date" "date",
    "repair_charges" numeric(10,2) DEFAULT 0 NOT NULL,
    "parts_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_pct" numeric(4,1) DEFAULT 0 NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "paid" boolean DEFAULT false NOT NULL,
    "paid_method" "text",
    "sale_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "after_images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "photo_consent" boolean DEFAULT false NOT NULL,
    "photo_consent_at" timestamp with time zone,
    CONSTRAINT "repairs_item_type_check" CHECK (("item_type" = ANY (ARRAY['Spectacle Frame'::"text", 'Sunglasses'::"text", 'Contact Lens Pack'::"text", 'Accessory'::"text", 'Other'::"text"]))),
    CONSTRAINT "repairs_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "repairs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'ready'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."repairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "org_id" "uuid" NOT NULL,
    "role_key" "text" NOT NULL,
    "permission" "text" NOT NULL,
    "allowed" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "role_permissions_role_key_check" CHECK (("role_key" = ANY (ARRAY['branch_manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sale_events" (
    "id" bigint NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "note" "text",
    "by_user" "uuid" DEFAULT "auth"."uid"(),
    "at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sale_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sale_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sale_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sale_events_id_seq" OWNED BY "public"."sale_events"."id";



CREATE TABLE IF NOT EXISTS "public"."sale_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "line_no" integer NOT NULL,
    "line_type" "text" NOT NULL,
    "product_id" "uuid",
    "lens_package_id" "uuid",
    "option_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "description" "text" NOT NULL,
    "details" "text",
    "qty" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "discount_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "tax_pct" numeric(4,1) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) NOT NULL,
    "hsn" "text",
    "price_mode" "text" DEFAULT 'inclusive'::"text" NOT NULL,
    "taxable_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "cgst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "sgst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "igst_amt" numeric(12,2) DEFAULT 0 NOT NULL,
    "warranty_until" "date",
    "warranty_terms" "text",
    "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "cgst" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_tax" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "sale_lines_line_type_check" CHECK (("line_type" = ANY (ARRAY['product'::"text", 'accessory'::"text", 'lens'::"text", 'service'::"text"]))),
    CONSTRAINT "sale_lines_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."sale_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "code" "text",
    "customer_id" "uuid" NOT NULL,
    "prescription_id" "uuid",
    "rx_snapshot" "jsonb",
    "source_quotation_id" "uuid",
    "status" "text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_included" numeric(12,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "paid_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "needs_lab" boolean DEFAULT false NOT NULL,
    "valid_until" "date",
    "notes" "text",
    "salesperson" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gst_applied" boolean DEFAULT true NOT NULL,
    "supply_type" "text" DEFAULT 'intrastate'::"text" NOT NULL,
    "state_of_supply" "text" DEFAULT "public"."org_default_text"('default_state'::"text", ''::"text") NOT NULL,
    "recipient_gstin" "text",
    "taxable_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "patient_customer_id" "uuid" NOT NULL,
    "rx_consent" boolean DEFAULT false NOT NULL,
    "rx_consent_at" timestamp with time zone,
    "idempotency_key" "uuid",
    CONSTRAINT "sales_kind_check" CHECK (("kind" = ANY (ARRAY['quotation'::"text", 'order'::"text"]))),
    CONSTRAINT "sales_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'partial'::"text", 'paid'::"text"]))),
    CONSTRAINT "sales_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'converted'::"text", 'rejected'::"text", 'lab_pending'::"text", 'in_workshop'::"text", 'qc'::"text", 'ready'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "sales_supply_type_check" CHECK (("supply_type" = ANY (ARRAY['intrastate'::"text", 'interstate'::"text"])))
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_domains" (
    "host" "text" NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."site_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "slug" "text" NOT NULL,
    "kind" "text" DEFAULT 'page'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "hero_image" "text",
    "body" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "show_in_nav" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_pages_kind_check" CHECK (("kind" = ANY (ARRAY['page'::"text", 'guide'::"text", 'config'::"text"])))
);


ALTER TABLE "public"."site_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "reason" "text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    CONSTRAINT "staff_assignments_check" CHECK ((("ends_at" > "starts_at") AND ("ends_at" <= ("starts_at" + '90 days'::interval)))),
    CONSTRAINT "staff_assignments_reason_check" CHECK (("length"(TRIM(BOTH FROM "reason")) > 2))
);


ALTER TABLE "public"."staff_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "email" "text" NOT NULL,
    "role_key" "text" NOT NULL,
    "branch_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "invited_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_user_id" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "branch_id" "uuid",
    "accepted_by" "uuid",
    CONSTRAINT "staff_invitations_role_key_check" CHECK (("role_key" = ANY (ARRAY['admin'::"text", 'branch_manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."staff_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" bigint NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stock_movements_delta_check" CHECK (("delta" <> 0)),
    CONSTRAINT "stock_movements_reason_check" CHECK (("reason" = ANY (ARRAY['opening'::"text", 'purchase'::"text", 'sale'::"text", 'return'::"text", 'adjustment'::"text", 'damage'::"text", 'transfer_in'::"text", 'transfer_out'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."stock_movements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stock_movements_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stock_movements_id_seq" OWNED BY "public"."stock_movements"."id";



CREATE TABLE IF NOT EXISTS "public"."stock_transfer_lines" (
    "transfer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty" integer NOT NULL,
    CONSTRAINT "stock_transfer_lines_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."stock_transfer_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "from_branch" "uuid" NOT NULL,
    "to_branch" "uuid" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "note" "text",
    "requested_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "approved_by" "uuid",
    "received_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_transfers_check" CHECK (("from_branch" <> "to_branch")),
    CONSTRAINT "stock_transfers_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'in_transit'::"text", 'received'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."stock_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "name" "text" NOT NULL,
    "gstin" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "state" "text" DEFAULT "public"."org_default_text"('default_state'::"text", ''::"text") NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "contact_person" "text",
    "bank_name" "text",
    "bank_account" "text",
    "bank_ifsc" "text",
    CONSTRAINT "suppliers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'permanent'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "reason" "text",
    "granted_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_branches_check" CHECK ((("kind" = 'temporary'::"text") = ("expires_at" IS NOT NULL))),
    CONSTRAINT "user_branches_kind_check" CHECK (("kind" = ANY (ARRAY['permanent'::"text", 'temporary'::"text"])))
);


ALTER TABLE "public"."user_branches" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."vision_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."vision_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "section" "text" NOT NULL,
    "title" "text",
    "subtitle" "text",
    "body" "text",
    "image_path" "text",
    "video_url" "text",
    "link" "text",
    "badge" "text",
    "cta_label" "text",
    "cta_link" "text",
    "bg_color" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "valid_from" "date",
    "valid_until" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "key" "text",
    "icon" "text",
    "image_alt" "text",
    "parent_key" "text",
    "cta2_label" "text",
    "cta2_link" "text"
);


ALTER TABLE "public"."website_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "key" "text" NOT NULL,
    "title" "text",
    "subtitle" "text",
    "image_path" "text",
    "image_alt" "text",
    "bg_color" "text",
    "cta_label" "text",
    "cta_link" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."website_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."current_org"() NOT NULL,
    "customer_id" "uuid",
    "phone" "text" NOT NULL,
    "template" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "wa_message_id" "text",
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_log" IS 'Log of every WhatsApp message sent by automation';



ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lab_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lab_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."palre_recommendation_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."palre_recommendation_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."repair_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."repair_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sale_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sale_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stock_movements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stock_movements_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_org_id_slug_key" UNIQUE ("org_id", "slug");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch_transfers"
    ADD CONSTRAINT "branch_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_customer_id_product_id_lens_package_id_key" UNIQUE ("customer_id", "product_id", "lens_package_id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cashbook"
    ADD CONSTRAINT "cashbook_org_id_source_source_id_entry_no_key" UNIQUE ("org_id", "source", "source_id", "entry_no");



ALTER TABLE ONLY "public"."cashbook"
    ADD CONSTRAINT "cashbook_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."counters"
    ADD CONSTRAINT "counters_pkey" PRIMARY KEY ("org_id", "key");



ALTER TABLE ONLY "public"."coupon_uses"
    ADD CONSTRAINT "coupon_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_note_lines"
    ADD CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_settings"
    ADD CONSTRAINT "crm_settings_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."crm_settings"
    ADD CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cron_runs"
    ADD CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_notification_preferences"
    ADD CONSTRAINT "customer_notification_preferences_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."customer_notifications"
    ADD CONSTRAINT "customer_notifications_customer_id_source_key_key" UNIQUE ("customer_id", "source_key");



ALTER TABLE ONLY "public"."customer_notifications"
    ADD CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_wishlist"
    ADD CONSTRAINT "customer_wishlist_customer_id_product_id_key" UNIQUE ("customer_id", "product_id");



ALTER TABLE ONLY "public"."customer_wishlist"
    ADD CONSTRAINT "customer_wishlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_org_id_customer_code_key" UNIQUE ("org_id", "customer_code");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_org_id_vision_id_key" UNIQUE ("org_id", "vision_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."day_closings"
    ADD CONSTRAINT "day_closings_org_id_branch_id_closing_date_key" UNIQUE ("org_id", "branch_id", "closing_date");



ALTER TABLE ONLY "public"."day_closings"
    ADD CONSTRAINT "day_closings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_links"
    ADD CONSTRAINT "document_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eye_examinations"
    ADD CONSTRAINT "eye_examinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_member_requests"
    ADD CONSTRAINT "family_member_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_member_unique" UNIQUE ("primary_customer_id", "member_customer_id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gst_periods"
    ADD CONSTRAINT "gst_periods_org_id_period_year_period_month_key" UNIQUE ("org_id", "period_year", "period_month");



ALTER TABLE ONLY "public"."gst_periods"
    ADD CONSTRAINT "gst_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_events"
    ADD CONSTRAINT "lab_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_org_id_evaluation_run_id_cand_key" UNIQUE ("org_id", "evaluation_run_id", "candidate_position");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_org_id_evaluation_run_id_lens_key" UNIQUE ("org_id", "evaluation_run_id", "lens_package_id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_runs"
    ADD CONSTRAINT "lens_compatibility_evaluation_runs_org_id_id_key" UNIQUE ("org_id", "id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_runs"
    ADD CONSTRAINT "lens_compatibility_evaluation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_options"
    ADD CONSTRAINT "lens_options_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."lens_options"
    ADD CONSTRAINT "lens_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_package_compatibility_rules"
    ADD CONSTRAINT "lens_package_compatibility_ru_org_id_lens_package_id_rule_c_key" UNIQUE ("org_id", "lens_package_id", "rule_code", "rule_version");



ALTER TABLE ONLY "public"."lens_package_compatibility_rules"
    ADD CONSTRAINT "lens_package_compatibility_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_package_option_combination_items"
    ADD CONSTRAINT "lens_package_option_combinati_org_id_combination_id_package_key" UNIQUE ("org_id", "combination_id", "package_option_eligibility_id");



ALTER TABLE ONLY "public"."lens_package_option_combinations"
    ADD CONSTRAINT "lens_package_option_combinati_org_id_lens_package_id_combin_key" UNIQUE ("org_id", "lens_package_id", "combination_code");



ALTER TABLE ONLY "public"."lens_package_option_combination_items"
    ADD CONSTRAINT "lens_package_option_combination_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_package_option_combinations"
    ADD CONSTRAINT "lens_package_option_combinations_org_id_id_key" UNIQUE ("org_id", "id");



ALTER TABLE ONLY "public"."lens_package_option_combinations"
    ADD CONSTRAINT "lens_package_option_combinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_package_option_eligibility"
    ADD CONSTRAINT "lens_package_option_eligibili_org_id_lens_package_id_lens_o_key" UNIQUE ("org_id", "lens_package_id", "lens_option_id");



ALTER TABLE ONLY "public"."lens_package_option_eligibility"
    ADD CONSTRAINT "lens_package_option_eligibility_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lens_packages"
    ADD CONSTRAINT "lens_packages_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."lens_packages"
    ADD CONSTRAINT "lens_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rules"
    ADD CONSTRAINT "loyalty_rules_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."loyalty_rules"
    ADD CONSTRAINT "loyalty_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_org_id_key_key" UNIQUE ("org_id", "key");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."online_payments"
    ADD CONSTRAINT "online_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_domains"
    ADD CONSTRAINT "org_domains_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."org_settings"
    ADD CONSTRAINT "org_settings_pkey" PRIMARY KEY ("org_id", "key");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."palre_fulfilment_snapshots"
    ADD CONSTRAINT "palre_fulfilment_snapshots_org_id_id_key" UNIQUE ("org_id", "id");



ALTER TABLE ONLY "public"."palre_fulfilment_snapshots"
    ADD CONSTRAINT "palre_fulfilment_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."palre_recommendation_candidates"
    ADD CONSTRAINT "palre_recommendation_candidat_org_id_recommendation_run_id__key" UNIQUE ("org_id", "recommendation_run_id", "lens_package_id");



ALTER TABLE ONLY "public"."palre_recommendation_candidates"
    ADD CONSTRAINT "palre_recommendation_candidat_org_id_recommendation_run_id_key1" UNIQUE ("org_id", "recommendation_run_id", "candidate_position");



ALTER TABLE ONLY "public"."palre_recommendation_candidates"
    ADD CONSTRAINT "palre_recommendation_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."palre_recommendation_events"
    ADD CONSTRAINT "palre_recommendation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."palre_recommendation_runs"
    ADD CONSTRAINT "palre_recommendation_runs_org_id_id_key" UNIQUE ("org_id", "id");



ALTER TABLE ONLY "public"."palre_recommendation_runs"
    ADD CONSTRAINT "palre_recommendation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_catalog"
    ADD CONSTRAINT "permission_catalog_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."prescription_audit_log"
    ADD CONSTRAINT "prescription_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_org_id_rx_code_key" UNIQUE ("org_id", "rx_code");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_view_counts"
    ADD CONSTRAINT "product_view_counts_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_org_id_barcode_key" UNIQUE ("org_id", "barcode");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_org_id_sku_key" UNIQUE ("org_id", "sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_branches"
    ADD CONSTRAINT "profile_branches_pkey" PRIMARY KEY ("profile_id", "branch_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_org_id_supplier_id_invoice_no_key" UNIQUE ("org_id", "supplier_id", "invoice_no");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_receipts"
    ADD CONSTRAINT "purchase_order_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_org_id_po_no_key" UNIQUE ("org_id", "po_no");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key", "window_start");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."repair_events"
    ADD CONSTRAINT "repair_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("org_id", "role_key", "permission");



ALTER TABLE ONLY "public"."sale_events"
    ADD CONSTRAINT "sale_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_lines"
    ADD CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_domains"
    ADD CONSTRAINT "site_domains_pkey" PRIMARY KEY ("host");



ALTER TABLE ONLY "public"."site_pages"
    ADD CONSTRAINT "site_pages_org_id_slug_key" UNIQUE ("org_id", "slug");



ALTER TABLE ONLY "public"."site_pages"
    ADD CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock"
    ADD CONSTRAINT "stock_pkey" PRIMARY KEY ("branch_id", "product_id");



ALTER TABLE ONLY "public"."stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("transfer_id", "product_id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branches"
    ADD CONSTRAINT "user_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branches"
    ADD CONSTRAINT "user_branches_user_id_branch_id_key" UNIQUE ("user_id", "branch_id");



ALTER TABLE ONLY "public"."website_content"
    ADD CONSTRAINT "website_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_sections"
    ADD CONSTRAINT "website_sections_org_id_key_key" UNIQUE ("org_id", "key");



ALTER TABLE ONLY "public"."website_sections"
    ADD CONSTRAINT "website_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_log"
    ADD CONSTRAINT "whatsapp_log_pkey" PRIMARY KEY ("id");



CREATE INDEX "appointments_org_id_appt_date_status_idx" ON "public"."appointments" USING "btree" ("org_id", "appt_date", "status");



CREATE INDEX "appointments_org_id_customer_id_idx" ON "public"."appointments" USING "btree" ("org_id", "customer_id");



CREATE UNIQUE INDEX "brands_org_id_id_uq" ON "public"."brands" USING "btree" ("org_id", "id");



CREATE INDEX "cashbook_day_idx" ON "public"."cashbook" USING "btree" ("org_id", "occurred_on" DESC);



CREATE INDEX "cashbook_method_idx" ON "public"."cashbook" USING "btree" ("org_id", "method", "occurred_on" DESC);



CREATE INDEX "cashbook_source_idx" ON "public"."cashbook" USING "btree" ("org_id", "source", "source_id");



CREATE INDEX "customer_notifications_feed_idx" ON "public"."customer_notifications" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "customers_auth_uid" ON "public"."customers" USING "btree" ("auth_user_id");



CREATE UNIQUE INDEX "customers_auth_user_uq" ON "public"."customers" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "customers_email_unique" ON "public"."customers" USING "btree" ("org_id", "email") WHERE ("email" IS NOT NULL);



CREATE INDEX "customers_org_id_full_name_idx" ON "public"."customers" USING "btree" ("org_id", "full_name");



CREATE INDEX "customers_org_id_phone_idx" ON "public"."customers" USING "btree" ("org_id", "phone");



CREATE INDEX "customers_org_phone_idx" ON "public"."customers" USING "btree" ("org_id", "phone");



CREATE UNIQUE INDEX "customers_phone_unique" ON "public"."customers" USING "btree" ("org_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "expenses_org_id_expense_date_idx" ON "public"."expenses" USING "btree" ("org_id", "expense_date" DESC);



CREATE INDEX "family_member_requests_customer_idx" ON "public"."family_member_requests" USING "btree" ("customer_id", "created_at" DESC);



CREATE UNIQUE INDEX "family_member_requests_one_pending_idx" ON "public"."family_member_requests" USING "btree" ("customer_id", "member_phone") WHERE ("status" = 'pending'::"text");



CREATE INDEX "family_members_primary_idx" ON "public"."family_members" USING "btree" ("primary_customer_id", "is_active");



CREATE INDEX "idx_assign_profile" ON "public"."staff_assignments" USING "btree" ("profile_id", "branch_id");



CREATE INDEX "idx_doclinks_customer" ON "public"."document_links" USING "btree" ("customer_id");



CREATE INDEX "idx_doclinks_ref" ON "public"."document_links" USING "btree" ("doc_type", "ref_id", "created_at" DESC);



CREATE INDEX "idx_loyalty_created" ON "public"."loyalty_ledger" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_loyalty_customer" ON "public"."loyalty_ledger" USING "btree" ("customer_id");



CREATE INDEX "idx_prescriptions_family" ON "public"."prescriptions" USING "btree" ("family_member_id");



CREATE INDEX "idx_prescriptions_review_status" ON "public"."prescriptions" USING "btree" ("org_id", "review_status");



CREATE INDEX "idx_prescriptions_valid_till" ON "public"."prescriptions" USING "btree" ("org_id", "valid_till");



CREATE INDEX "idx_profile_branches_branch" ON "public"."profile_branches" USING "btree" ("branch_id");



CREATE INDEX "idx_sale_events_sale" ON "public"."sale_events" USING "btree" ("sale_id", "at");



CREATE INDEX "idx_transfers_branches" ON "public"."branch_transfers" USING "btree" ("from_branch", "to_branch", "status");



CREATE INDEX "idx_wa_log_category" ON "public"."whatsapp_log" USING "btree" ("category", "sent_at" DESC);



CREATE INDEX "idx_wa_log_customer" ON "public"."whatsapp_log" USING "btree" ("customer_id");



CREATE INDEX "lab_orders_org_id_status_idx" ON "public"."lab_orders" USING "btree" ("org_id", "status");



CREATE INDEX "lab_orders_patient_customer_idx" ON "public"."lab_orders" USING "btree" ("patient_customer_id");



CREATE INDEX "lab_orders_sale_id_idx" ON "public"."lab_orders" USING "btree" ("sale_id");



CREATE UNIQUE INDEX "lens_options_org_id_id_uq" ON "public"."lens_options" USING "btree" ("org_id", "id");



CREATE INDEX "lens_package_compatibility_lookup_idx" ON "public"."lens_package_compatibility_rules" USING "btree" ("org_id", "lens_package_id", "design_family", "verification_status");



CREATE UNIQUE INDEX "lens_package_compatibility_rules_org_id_id_uq" ON "public"."lens_package_compatibility_rules" USING "btree" ("org_id", "id");



CREATE INDEX "lens_package_option_eligibility_lookup_idx" ON "public"."lens_package_option_eligibility" USING "btree" ("org_id", "lens_package_id", "verification_status");



CREATE UNIQUE INDEX "lens_package_option_eligibility_org_id_id_uq" ON "public"."lens_package_option_eligibility" USING "btree" ("org_id", "id");



CREATE UNIQUE INDEX "lens_packages_manufacturer_sku_uq" ON "public"."lens_packages" USING "btree" ("org_id", "manufacturer_brand_id", "lower"(TRIM(BOTH FROM "manufacturer_sku"))) WHERE (("manufacturer_brand_id" IS NOT NULL) AND ("manufacturer_sku" IS NOT NULL) AND (TRIM(BOTH FROM "manufacturer_sku") <> ''::"text"));



CREATE UNIQUE INDEX "lens_packages_org_id_id_uq" ON "public"."lens_packages" USING "btree" ("org_id", "id");



CREATE INDEX "lens_packages_palre_gate_idx" ON "public"."lens_packages" USING "btree" ("org_id", "catalog_verification_status", "status", "design");



CREATE INDEX "loyalty_ledger_org_id_customer_id_created_at_idx" ON "public"."loyalty_ledger" USING "btree" ("org_id", "customer_id", "created_at" DESC);



CREATE UNIQUE INDEX "online_payments_payment_id_uq" ON "public"."online_payments" USING "btree" ("razorpay_payment_id") WHERE ("razorpay_payment_id" IS NOT NULL);



CREATE INDEX "palre_evaluation_candidates_run_idx" ON "public"."lens_compatibility_evaluation_candidates" USING "btree" ("org_id", "evaluation_run_id", "candidate_position");



CREATE INDEX "palre_evaluation_runs_rx_idx" ON "public"."lens_compatibility_evaluation_runs" USING "btree" ("org_id", "prescription_id", "evaluated_at" DESC);



CREATE INDEX "palre_fulfilment_lookup_idx" ON "public"."palre_fulfilment_snapshots" USING "btree" ("org_id", "prescription_fingerprint", "lens_package_id", "snapshot_at" DESC);



CREATE INDEX "palre_option_combination_items_parent_idx" ON "public"."lens_package_option_combination_items" USING "btree" ("org_id", "combination_id");



CREATE INDEX "palre_option_combinations_package_idx" ON "public"."lens_package_option_combinations" USING "btree" ("org_id", "lens_package_id", "verification_status");



CREATE INDEX "palre_recommendation_candidates_run_idx" ON "public"."palre_recommendation_candidates" USING "btree" ("org_id", "recommendation_run_id", "candidate_position");



CREATE INDEX "palre_recommendation_runs_review_idx" ON "public"."palre_recommendation_runs" USING "btree" ("org_id", "status", "created_at" DESC);



CREATE INDEX "pi_org_date" ON "public"."purchase_invoices" USING "btree" ("org_id", "invoice_date" DESC);



CREATE INDEX "pi_org_status" ON "public"."purchase_invoices" USING "btree" ("org_id", "status");



CREATE INDEX "po_org_date" ON "public"."purchase_orders" USING "btree" ("org_id", "order_date" DESC);



CREATE INDEX "po_org_status" ON "public"."purchase_orders" USING "btree" ("org_id", "status");



CREATE INDEX "po_org_supplier" ON "public"."purchase_orders" USING "btree" ("org_id", "supplier_id");



CREATE INDEX "por_org_po" ON "public"."purchase_order_receipts" USING "btree" ("org_id", "po_id");



CREATE INDEX "prescriptions_org_id_customer_id_rx_date_idx" ON "public"."prescriptions" USING "btree" ("org_id", "customer_id", "rx_date" DESC);



CREATE UNIQUE INDEX "prescriptions_org_id_id_uq" ON "public"."prescriptions" USING "btree" ("org_id", "id");



CREATE INDEX "product_reviews_product_id_status_idx" ON "public"."product_reviews" USING "btree" ("product_id", "status");



CREATE INDEX "products_org_id_kind_status_idx" ON "public"."products" USING "btree" ("org_id", "kind", "status");



CREATE INDEX "repairs_org_id_customer_id_idx" ON "public"."repairs" USING "btree" ("org_id", "customer_id");



CREATE INDEX "repairs_org_id_status_idx" ON "public"."repairs" USING "btree" ("org_id", "status");



CREATE INDEX "sales_org_id_customer_id_idx" ON "public"."sales" USING "btree" ("org_id", "customer_id");



CREATE UNIQUE INDEX "sales_org_id_idem_key" ON "public"."sales" USING "btree" ("org_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "sales_org_id_kind_created_at_idx" ON "public"."sales" USING "btree" ("org_id", "kind", "created_at" DESC);



CREATE INDEX "sales_patient_customer_idx" ON "public"."sales" USING "btree" ("patient_customer_id");



CREATE UNIQUE INDEX "site_domains_one_default" ON "public"."site_domains" USING "btree" ("org_id") WHERE "is_default";



CREATE UNIQUE INDEX "staff_inv_open" ON "public"."staff_invitations" USING "btree" ("org_id", "lower"("email")) WHERE (("accepted_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "suppliers_org" ON "public"."suppliers" USING "btree" ("org_id", "status");



CREATE UNIQUE INDEX "uq_invite_open" ON "public"."staff_invitations" USING "btree" ("org_id", "lower"("email")) WHERE (("accepted_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "user_branches_user" ON "public"."user_branches" USING "btree" ("user_id");



CREATE UNIQUE INDEX "website_content_key_uniq" ON "public"."website_content" USING "btree" ("org_id", "section", "key");



CREATE INDEX "website_content_org_id_section_is_active_display_order_idx" ON "public"."website_content" USING "btree" ("org_id", "section", "is_active", "display_order");



CREATE INDEX "website_content_parent" ON "public"."website_content" USING "btree" ("org_id", "section", "parent_key", "display_order");



CREATE INDEX "website_sections_order" ON "public"."website_sections" USING "btree" ("org_id", "enabled", "display_order");



CREATE OR REPLACE VIEW "public"."customer_orders" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "s"."code",
    "s"."kind",
    "s"."status",
    "s"."payment_status",
    "s"."grand_total",
    "s"."paid_total",
    "s"."needs_lab",
    "s"."created_at",
    "s"."rx_snapshot",
    "s"."supply_type",
    "s"."customer_id",
    "array_agg"("json_build_object"('description', "l"."description", 'details', "l"."details", 'qty', "l"."qty", 'line_total', "l"."line_total", 'line_type', "l"."line_type") ORDER BY "l"."line_no") AS "lines"
   FROM ("public"."sales" "s"
     JOIN "public"."sale_lines" "l" ON (("l"."sale_id" = "s"."id")))
  WHERE ("s"."kind" = 'order'::"text")
  GROUP BY "s"."id";



CREATE OR REPLACE TRIGGER "customer_referral_code" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_referral_code"();



CREATE OR REPLACE TRIGGER "family_member_org_guard" BEFORE INSERT OR UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."validate_family_member_org"();



CREATE OR REPLACE TRIGGER "family_member_requests_audit" AFTER INSERT OR UPDATE ON "public"."family_member_requests" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "family_members_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "palre_compatibility_design_family" BEFORE INSERT OR UPDATE ON "public"."lens_package_compatibility_rules" FOR EACH ROW EXECUTE FUNCTION "public"."palre_validate_compatibility_design_family"();



CREATE OR REPLACE TRIGGER "palre_compatibility_immutable" BEFORE DELETE OR UPDATE ON "public"."lens_package_compatibility_rules" FOR EACH ROW EXECUTE FUNCTION "public"."palre_guard_verified_catalogue_evidence"();



CREATE OR REPLACE TRIGGER "palre_option_combination_item_immutable" BEFORE DELETE OR UPDATE ON "public"."lens_package_option_combination_items" FOR EACH ROW EXECUTE FUNCTION "public"."palre_guard_verified_option_combination"();



CREATE OR REPLACE TRIGGER "palre_option_combination_item_validate" BEFORE INSERT OR UPDATE ON "public"."lens_package_option_combination_items" FOR EACH ROW EXECUTE FUNCTION "public"."palre_validate_option_combination"();



CREATE OR REPLACE TRIGGER "palre_option_combination_parent_immutable" BEFORE DELETE OR UPDATE ON "public"."lens_package_option_combinations" FOR EACH ROW EXECUTE FUNCTION "public"."palre_guard_verified_option_combination"();



CREATE OR REPLACE TRIGGER "palre_option_combination_parent_validate" BEFORE INSERT OR UPDATE ON "public"."lens_package_option_combinations" FOR EACH ROW EXECUTE FUNCTION "public"."palre_validate_option_combination"();



CREATE OR REPLACE TRIGGER "palre_option_eligibility_immutable" BEFORE DELETE OR UPDATE ON "public"."lens_package_option_eligibility" FOR EACH ROW EXECUTE FUNCTION "public"."palre_guard_verified_catalogue_evidence"();



CREATE OR REPLACE TRIGGER "palre_recommendation_events_immutable" BEFORE DELETE OR UPDATE ON "public"."palre_recommendation_events" FOR EACH ROW EXECUTE FUNCTION "public"."palre_recommendation_event_no_mutation"();



CREATE OR REPLACE TRIGGER "pi_touch" BEFORE UPDATE ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."touch_pi_updated"();



CREATE OR REPLACE TRIGGER "portal_appointment_created" AFTER INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."portal_notify_appointment"();



CREATE OR REPLACE TRIGGER "portal_appointment_status" AFTER UPDATE OF "status" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."portal_notify_appointment"();



CREATE OR REPLACE TRIGGER "portal_loyalty_event" AFTER INSERT ON "public"."loyalty_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."portal_notify_loyalty"();



CREATE OR REPLACE TRIGGER "portal_order_created" AFTER INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."portal_notify_order"();



CREATE OR REPLACE TRIGGER "portal_order_status" AFTER UPDATE OF "status" ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."portal_notify_order"();



CREATE OR REPLACE TRIGGER "portal_prescription_event" AFTER INSERT ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."portal_notify_prescription"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."cashbook" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."day_closings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."eye_examinations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."lab_orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."palre_fulfilment_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."profile_branches" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchase_order_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."repairs" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."stock" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_00_branch_scope" BEFORE INSERT OR DELETE OR UPDATE ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_scope"();



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."credit_note_lines" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('credit_notes.issue');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('credit_notes.issue');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."day_closings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('finance.manage');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('expenses.manage');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."gst_periods" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('finance.manage');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('purchases.manage');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('purchases.manage');



CREATE OR REPLACE TRIGGER "trg_01_perm" BEFORE INSERT OR DELETE OR UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_permission"('purchases.manage');



CREATE OR REPLACE TRIGGER "trg_apply_movement" AFTER INSERT ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."apply_movement"();



CREATE OR REPLACE TRIGGER "trg_assign_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_audit_immutable" BEFORE DELETE OR UPDATE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."audit_immutable"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."cashbook" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."day_closings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."eye_examinations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."lab_orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."repairs" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."stock" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_branch_guard" BEFORE INSERT OR UPDATE ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_branch_write"();



CREATE OR REPLACE TRIGGER "trg_cashbook_credit_note" AFTER INSERT OR UPDATE ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."cashbook_from_credit_note"();



CREATE OR REPLACE TRIGGER "trg_cashbook_expense" AFTER INSERT ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."cashbook_from_expense"();



CREATE OR REPLACE TRIGGER "trg_cashbook_online" AFTER INSERT ON "public"."online_payments" FOR EACH ROW EXECUTE FUNCTION "public"."cashbook_from_online"();



CREATE OR REPLACE TRIGGER "trg_cashbook_payment" AFTER INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."cashbook_from_payment"();



CREATE OR REPLACE TRIGGER "trg_cashbook_purchase" AFTER INSERT OR UPDATE ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."cashbook_from_purchase"();



CREATE OR REPLACE TRIGGER "trg_cn_before" BEFORE INSERT ON "public"."credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."credit_notes_before"();



CREATE OR REPLACE TRIGGER "trg_customers_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_customers_codes" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."customers_assign_codes"();



CREATE OR REPLACE TRIGGER "trg_customers_protect_cols" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."customers_protect_cols"();



CREATE OR REPLACE TRIGGER "trg_doclinks_audit" AFTER INSERT OR UPDATE OF "revoked_at", "send_count" ON "public"."document_links" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_domains_audit" AFTER INSERT OR DELETE ON "public"."org_domains" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_invite_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_lab_audit" AFTER INSERT OR UPDATE ON "public"."lab_orders" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_lab_before" BEFORE INSERT OR UPDATE ON "public"."lab_orders" FOR EACH ROW EXECUTE FUNCTION "public"."lab_before"();



CREATE OR REPLACE TRIGGER "trg_lab_orders_patient" BEFORE INSERT ON "public"."lab_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fill_patient_customer_id"();



CREATE OR REPLACE TRIGGER "trg_lens_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."lens_packages" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_lens_options_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."lens_options" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_org_perm_seed" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."trg_org_seed_permissions"();



CREATE OR REPLACE TRIGGER "trg_payments_apply" AFTER INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."payments_apply"();



CREATE OR REPLACE TRIGGER "trg_payments_audit" AFTER INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_po_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_po_no" BEFORE INSERT ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."purchase_orders_no"();



CREATE OR REPLACE TRIGGER "trg_po_touch" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_po_updated"();



CREATE OR REPLACE TRIGGER "trg_product_costs_guard" BEFORE INSERT OR UPDATE ON "public"."product_costs" FOR EACH ROW EXECUTE FUNCTION "public"."product_costs_guard"();



CREATE OR REPLACE TRIGGER "trg_products_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_products_before" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."products_before"();



CREATE OR REPLACE TRIGGER "trg_profiles_audit" AFTER INSERT OR DELETE OR UPDATE OF "role_key", "branch_id", "is_approved", "deactivated", "org_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_repairs_audit" AFTER INSERT OR UPDATE ON "public"."repairs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_repairs_before" BEFORE INSERT OR UPDATE ON "public"."repairs" FOR EACH ROW EXECUTE FUNCTION "public"."repairs_before"();



CREATE OR REPLACE TRIGGER "trg_roleperm_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_rx_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_rx_code" BEFORE INSERT ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."prescriptions_assign_code"();



CREATE OR REPLACE TRIGGER "trg_rx_values" BEFORE INSERT OR UPDATE ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."prescriptions_check_values"();



CREATE OR REPLACE TRIGGER "trg_sales_audit" AFTER INSERT OR UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_sales_before" BEFORE INSERT OR UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."sales_before"();



CREATE OR REPLACE TRIGGER "trg_sales_events" AFTER INSERT OR UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."sale_events_track"();



CREATE OR REPLACE TRIGGER "trg_sales_patient" BEFORE INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."fill_patient_customer_id"();



CREATE OR REPLACE TRIGGER "trg_sp_touch" BEFORE UPDATE ON "public"."site_pages" FOR EACH ROW EXECUTE FUNCTION "public"."sp_touch"();



CREATE OR REPLACE TRIGGER "trg_staff_inv_audit" AFTER INSERT OR UPDATE ON "public"."staff_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_stock_transfers_audit" AFTER INSERT OR UPDATE ON "public"."stock_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_transfer_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."branch_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



CREATE OR REPLACE TRIGGER "trg_user_branches_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_branches" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."branch_transfers"
    ADD CONSTRAINT "branch_transfers_from_branch_fkey" FOREIGN KEY ("from_branch") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."branch_transfers"
    ADD CONSTRAINT "branch_transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."branch_transfers"
    ADD CONSTRAINT "branch_transfers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."branch_transfers"
    ADD CONSTRAINT "branch_transfers_to_branch_fkey" FOREIGN KEY ("to_branch") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_lens_package_id_fkey" FOREIGN KEY ("lens_package_id") REFERENCES "public"."lens_packages"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cashbook"
    ADD CONSTRAINT "cashbook_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."cashbook"
    ADD CONSTRAINT "cashbook_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."cashbook"
    ADD CONSTRAINT "cashbook_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."coupon_uses"
    ADD CONSTRAINT "coupon_uses_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id");



ALTER TABLE ONLY "public"."coupon_uses"
    ADD CONSTRAINT "coupon_uses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."coupon_uses"
    ADD CONSTRAINT "coupon_uses_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."credit_note_lines"
    ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_note_lines"
    ADD CONSTRAINT "credit_note_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."credit_note_lines"
    ADD CONSTRAINT "credit_note_lines_original_line_id_fkey" FOREIGN KEY ("original_line_id") REFERENCES "public"."sale_lines"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_original_sale_id_fkey" FOREIGN KEY ("original_sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."crm_settings"
    ADD CONSTRAINT "crm_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."customer_notification_preferences"
    ADD CONSTRAINT "customer_notification_preferences_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_notifications"
    ADD CONSTRAINT "customer_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_notifications"
    ADD CONSTRAINT "customer_notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wishlist"
    ADD CONSTRAINT "customer_wishlist_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_wishlist"
    ADD CONSTRAINT "customer_wishlist_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_referred_by_customer_fkey" FOREIGN KEY ("referred_by_customer") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."day_closings"
    ADD CONSTRAINT "day_closings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."day_closings"
    ADD CONSTRAINT "day_closings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."document_links"
    ADD CONSTRAINT "document_links_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."document_links"
    ADD CONSTRAINT "document_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."eye_examinations"
    ADD CONSTRAINT "eye_examinations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id");



ALTER TABLE ONLY "public"."eye_examinations"
    ADD CONSTRAINT "eye_examinations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."eye_examinations"
    ADD CONSTRAINT "eye_examinations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."eye_examinations"
    ADD CONSTRAINT "eye_examinations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."eye_examinations"
    ADD CONSTRAINT "eye_examinations_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id");



ALTER TABLE ONLY "public"."family_member_requests"
    ADD CONSTRAINT "family_member_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_member_requests"
    ADD CONSTRAINT "family_member_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_member_requests"
    ADD CONSTRAINT "family_member_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_member_customer_id_fkey" FOREIGN KEY ("member_customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_primary_customer_id_fkey" FOREIGN KEY ("primary_customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gst_periods"
    ADD CONSTRAINT "gst_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lab_events"
    ADD CONSTRAINT "lab_events_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lab_events"
    ADD CONSTRAINT "lab_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_frame_product_id_fkey" FOREIGN KEY ("frame_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_lens_package_id_fkey" FOREIGN KEY ("lens_package_id") REFERENCES "public"."lens_packages"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_patient_customer_id_fkey" FOREIGN KEY ("patient_customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_sale_line_id_fkey" FOREIGN KEY ("sale_line_id") REFERENCES "public"."sale_lines"("id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_can_org_id_evaluation_run_id_fkey" FOREIGN KEY ("org_id", "evaluation_run_id") REFERENCES "public"."lens_compatibility_evaluation_runs"("org_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_candi_org_id_lens_package_id_fkey" FOREIGN KEY ("org_id", "lens_package_id") REFERENCES "public"."lens_packages"("org_id", "id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_candi_org_id_matched_rule_id_fkey" FOREIGN KEY ("org_id", "matched_rule_id") REFERENCES "public"."lens_package_compatibility_rules"("org_id", "id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_candidates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_candidates"
    ADD CONSTRAINT "lens_compatibility_evaluation_org_id_matched_option_combin_fkey" FOREIGN KEY ("org_id", "matched_option_combination_id") REFERENCES "public"."lens_package_option_combinations"("org_id", "id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_runs"
    ADD CONSTRAINT "lens_compatibility_evaluation_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_compatibility_evaluation_runs"
    ADD CONSTRAINT "lens_compatibility_evaluation_runs_org_id_prescription_id_fkey" FOREIGN KEY ("org_id", "prescription_id") REFERENCES "public"."prescriptions"("org_id", "id");



ALTER TABLE ONLY "public"."lens_options"
    ADD CONSTRAINT "lens_options_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_package_compatibility_rules"
    ADD CONSTRAINT "lens_package_compatibility_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_package_compatibility_rules"
    ADD CONSTRAINT "lens_package_compatibility_rules_org_id_lens_package_id_fkey" FOREIGN KEY ("org_id", "lens_package_id") REFERENCES "public"."lens_packages"("org_id", "id");



ALTER TABLE ONLY "public"."lens_package_option_combination_items"
    ADD CONSTRAINT "lens_package_option_combinati_org_id_package_option_eligib_fkey" FOREIGN KEY ("org_id", "package_option_eligibility_id") REFERENCES "public"."lens_package_option_eligibility"("org_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lens_package_option_combination_items"
    ADD CONSTRAINT "lens_package_option_combination_item_org_id_combination_id_fkey" FOREIGN KEY ("org_id", "combination_id") REFERENCES "public"."lens_package_option_combinations"("org_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lens_package_option_combination_items"
    ADD CONSTRAINT "lens_package_option_combination_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_package_option_combinations"
    ADD CONSTRAINT "lens_package_option_combinations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_package_option_combinations"
    ADD CONSTRAINT "lens_package_option_combinations_org_id_lens_package_id_fkey" FOREIGN KEY ("org_id", "lens_package_id") REFERENCES "public"."lens_packages"("org_id", "id");



ALTER TABLE ONLY "public"."lens_package_option_eligibility"
    ADD CONSTRAINT "lens_package_option_eligibility_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_package_option_eligibility"
    ADD CONSTRAINT "lens_package_option_eligibility_org_id_lens_option_id_fkey" FOREIGN KEY ("org_id", "lens_option_id") REFERENCES "public"."lens_options"("org_id", "id");



ALTER TABLE ONLY "public"."lens_package_option_eligibility"
    ADD CONSTRAINT "lens_package_option_eligibility_org_id_lens_package_id_fkey" FOREIGN KEY ("org_id", "lens_package_id") REFERENCES "public"."lens_packages"("org_id", "id");



ALTER TABLE ONLY "public"."lens_packages"
    ADD CONSTRAINT "lens_packages_manufacturer_brand_tenant_fk" FOREIGN KEY ("org_id", "manufacturer_brand_id") REFERENCES "public"."brands"("org_id", "id");



ALTER TABLE ONLY "public"."lens_packages"
    ADD CONSTRAINT "lens_packages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."lens_packages"
    ADD CONSTRAINT "lens_packages_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."loyalty_ledger"
    ADD CONSTRAINT "loyalty_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."loyalty_rules"
    ADD CONSTRAINT "loyalty_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."online_payments"
    ADD CONSTRAINT "online_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."online_payments"
    ADD CONSTRAINT "online_payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."online_payments"
    ADD CONSTRAINT "online_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."org_domains"
    ADD CONSTRAINT "org_domains_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_settings"
    ADD CONSTRAINT "org_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."palre_fulfilment_snapshots"
    ADD CONSTRAINT "palre_fulfilment_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."palre_fulfilment_snapshots"
    ADD CONSTRAINT "palre_fulfilment_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."palre_fulfilment_snapshots"
    ADD CONSTRAINT "palre_fulfilment_snapshots_org_id_lens_package_id_fkey" FOREIGN KEY ("org_id", "lens_package_id") REFERENCES "public"."lens_packages"("org_id", "id");



ALTER TABLE ONLY "public"."palre_recommendation_candidates"
    ADD CONSTRAINT "palre_recommendation_candidat_org_id_recommendation_run_id_fkey" FOREIGN KEY ("org_id", "recommendation_run_id") REFERENCES "public"."palre_recommendation_runs"("org_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."palre_recommendation_candidates"
    ADD CONSTRAINT "palre_recommendation_candidates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."palre_recommendation_candidates"
    ADD CONSTRAINT "palre_recommendation_candidates_org_id_lens_package_id_fkey" FOREIGN KEY ("org_id", "lens_package_id") REFERENCES "public"."lens_packages"("org_id", "id");



ALTER TABLE ONLY "public"."palre_recommendation_events"
    ADD CONSTRAINT "palre_recommendation_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."palre_recommendation_events"
    ADD CONSTRAINT "palre_recommendation_events_org_id_recommendation_run_id_fkey" FOREIGN KEY ("org_id", "recommendation_run_id") REFERENCES "public"."palre_recommendation_runs"("org_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."palre_recommendation_runs"
    ADD CONSTRAINT "palre_recommendation_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."palre_recommendation_runs"
    ADD CONSTRAINT "palre_recommendation_runs_org_id_prescription_id_fkey" FOREIGN KEY ("org_id", "prescription_id") REFERENCES "public"."prescriptions"("org_id", "id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prescription_audit_log"
    ADD CONSTRAINT "prescription_audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."prescription_audit_log"
    ADD CONSTRAINT "prescription_audit_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."prescription_audit_log"
    ADD CONSTRAINT "prescription_audit_log_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_view_counts"
    ADD CONSTRAINT "product_view_counts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profile_branches"
    ADD CONSTRAINT "profile_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_branches"
    ADD CONSTRAINT "profile_branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profile_branches"
    ADD CONSTRAINT "profile_branches_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_receipts"
    ADD CONSTRAINT "purchase_order_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."purchase_order_receipts"
    ADD CONSTRAINT "purchase_order_receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_order_receipts"
    ADD CONSTRAINT "purchase_order_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."purchase_invoices"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."repair_events"
    ADD CONSTRAINT "repair_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."repair_events"
    ADD CONSTRAINT "repair_events_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."repairs"
    ADD CONSTRAINT "repairs_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_events"
    ADD CONSTRAINT "sale_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."sale_events"
    ADD CONSTRAINT "sale_events_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_lines"
    ADD CONSTRAINT "sale_lines_lens_package_id_fkey" FOREIGN KEY ("lens_package_id") REFERENCES "public"."lens_packages"("id");



ALTER TABLE ONLY "public"."sale_lines"
    ADD CONSTRAINT "sale_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."sale_lines"
    ADD CONSTRAINT "sale_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sale_lines"
    ADD CONSTRAINT "sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_patient_customer_id_fkey" FOREIGN KEY ("patient_customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_source_quotation_id_fkey" FOREIGN KEY ("source_quotation_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."site_domains"
    ADD CONSTRAINT "site_domains_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_pages"
    ADD CONSTRAINT "site_pages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."stock"
    ADD CONSTRAINT "stock_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock"
    ADD CONSTRAINT "stock_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."stock"
    ADD CONSTRAINT "stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_from_branch_fkey" FOREIGN KEY ("from_branch") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_to_branch_fkey" FOREIGN KEY ("to_branch") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."user_branches"
    ADD CONSTRAINT "user_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."user_branches"
    ADD CONSTRAINT "user_branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."user_branches"
    ADD CONSTRAINT "user_branches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_content"
    ADD CONSTRAINT "website_content_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."website_sections"
    ADD CONSTRAINT "website_sections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."whatsapp_log"
    ADD CONSTRAINT "whatsapp_log_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."whatsapp_log"
    ADD CONSTRAINT "whatsapp_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_customer_read" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "appointments_customer_select" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "appointments_rls_ins" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "appointments_rls_sel" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "appointments_rls_upd" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id"))) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "assign_sel" ON "public"."staff_assignments" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (("profile_id" = "auth"."uid"()) OR "public"."is_manager"())));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_read" ON "public"."audit_log" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "blog_anon" ON "public"."blog_posts" FOR SELECT TO "anon" USING ((("status" = 'published'::"text") AND ("org_id" = "public"."request_org"())));



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_staff" ON "public"."blog_posts" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "blog_update" ON "public"."blog_posts" FOR UPDATE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "blog_write" ON "public"."blog_posts" FOR INSERT WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "branch_read" ON "public"."branches" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "branch_scope" ON "public"."palre_fulfilment_snapshots" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



CREATE POLICY "branch_scope" ON "public"."prescriptions" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



CREATE POLICY "branch_scope" ON "public"."profile_branches" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



CREATE POLICY "branch_scope" ON "public"."purchase_order_receipts" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



CREATE POLICY "branch_scope" ON "public"."purchase_orders" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



CREATE POLICY "branch_scope" ON "public"."staff_assignments" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



CREATE POLICY "branch_scope" ON "public"."staff_invitations" AS RESTRICTIVE USING ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id"))) WITH CHECK ((("public"."current_org"() IS NULL) OR ("branch_id" IS NULL) OR "public"."can_access_branch"("branch_id")));



ALTER TABLE "public"."branch_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branches_active_read" ON "public"."branches" FOR SELECT TO "authenticated" USING ("is_active");



CREATE POLICY "branches_anon" ON "public"."branches" FOR SELECT TO "anon" USING (("is_active" AND ("org_id" = "public"."request_org"())));



ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_anon" ON "public"."brands" FOR SELECT TO "anon" USING ((true AND ("org_id" = "public"."request_org"())));



CREATE POLICY "brands_rls_ins" ON "public"."brands" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "brands_rls_sel" ON "public"."brands" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "brands_rls_upd" ON "public"."brands" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "cart_customer" ON "public"."cart_items" TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_own" ON "public"."cart_items" TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "cart_staff" ON "public"."cart_items" USING (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."cashbook" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cashbook_rls_sel" ON "public"."cashbook" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



ALTER TABLE "public"."counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupon_uses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coupon_uses_staff" ON "public"."coupon_uses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coupons" "c"
  WHERE (("c"."id" = "coupon_uses"."coupon_id") AND ("c"."org_id" = "public"."current_org"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coupons" "c"
  WHERE (("c"."id" = "coupon_uses"."coupon_id") AND ("c"."org_id" = "public"."current_org"())))));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coupons_public" ON "public"."coupons" FOR SELECT TO "authenticated", "anon" USING (("is_active" AND (("valid_until" IS NULL) OR ("valid_until" >= CURRENT_DATE)) AND (("valid_from" IS NULL) OR ("valid_from" <= CURRENT_DATE)) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "coupons_staff" ON "public"."coupons" USING (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."credit_note_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_note_lines_rls_ins" ON "public"."credit_note_lines" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."credit_notes" "par"
  WHERE ("par"."id" = "credit_note_lines"."credit_note_id")))));



CREATE POLICY "credit_note_lines_rls_sel" ON "public"."credit_note_lines" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."credit_notes" "par"
  WHERE ("par"."id" = "credit_note_lines"."credit_note_id")))));



CREATE POLICY "credit_note_lines_rls_upd" ON "public"."credit_note_lines" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."credit_notes" "par"
  WHERE ("par"."id" = "credit_note_lines"."credit_note_id"))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."credit_notes" "par"
  WHERE ("par"."id" = "credit_note_lines"."credit_note_id")))));



ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_notes_rls_ins" ON "public"."credit_notes" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "credit_notes_rls_sel" ON "public"."credit_notes" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "credit_notes_rls_upd" ON "public"."credit_notes" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id"))) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



ALTER TABLE "public"."crm_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_settings_staff" ON "public"."crm_settings" USING (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."cron_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cron_runs_staff" ON "public"."cron_runs" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "cust_insert" ON "public"."customers" FOR INSERT WITH CHECK (("org_id" = "public"."current_org"()));



CREATE POLICY "cust_select" ON "public"."customers" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "cust_self_select" ON "public"."customers" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



COMMENT ON POLICY "cust_self_select" ON "public"."customers" IS 'A logged-in website customer can read their own profile row';



CREATE POLICY "cust_self_update" ON "public"."customers" FOR UPDATE TO "authenticated" USING (("auth_user_id" = "auth"."uid"())) WITH CHECK (("auth_user_id" = "auth"."uid"()));



COMMENT ON POLICY "cust_self_update" ON "public"."customers" IS 'A logged-in website customer can edit their own profile row';



CREATE POLICY "cust_update" ON "public"."customers" FOR UPDATE USING (("org_id" = "public"."current_org"())) WITH CHECK (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."customer_notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_notification_preferences_own" ON "public"."customer_notification_preferences" TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



ALTER TABLE "public"."customer_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_notifications_read_own" ON "public"."customer_notifications" FOR SELECT TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "customer_notifications_update_own" ON "public"."customer_notifications" FOR UPDATE TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



ALTER TABLE "public"."customer_wishlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_closings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "day_closings_rls_ins" ON "public"."day_closings" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "day_closings_rls_sel" ON "public"."day_closings" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "day_closings_rls_upd" ON "public"."day_closings" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "doclinks_staff_insert" ON "public"."document_links" FOR INSERT TO "authenticated" WITH CHECK (("org_id" = "public"."current_org"()));



CREATE POLICY "doclinks_staff_select" ON "public"."document_links" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "doclinks_staff_update" ON "public"."document_links" FOR UPDATE TO "authenticated" USING (("org_id" = "public"."current_org"())) WITH CHECK (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."document_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "domains_sel" ON "public"."org_domains" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_rls_ins" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "expenses_rls_sel" ON "public"."expenses" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "expenses_rls_upd" ON "public"."expenses" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "eye_exam_customer" ON "public"."eye_examinations" FOR SELECT TO "authenticated" USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."eye_examinations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eye_examinations_rls_del" ON "public"."eye_examinations" FOR DELETE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "eye_examinations_rls_ins" ON "public"."eye_examinations" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "eye_examinations_rls_sel" ON "public"."eye_examinations" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "eye_examinations_rls_upd" ON "public"."eye_examinations" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id"))) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



ALTER TABLE "public"."family_member_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_member_requests_customer_insert" ON "public"."family_member_requests" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)) AND ("org_id" = ( SELECT "customers"."org_id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)) AND ("status" = 'pending'::"text")));



CREATE POLICY "family_member_requests_customer_read" ON "public"."family_member_requests" FOR SELECT TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "family_member_requests_staff_read" ON "public"."family_member_requests" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "family_member_requests_staff_update" ON "public"."family_member_requests" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_members_customer_read" ON "public"."family_members" FOR SELECT TO "authenticated" USING (("primary_customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "family_members_staff_read" ON "public"."family_members" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "family_members_staff_write" ON "public"."family_members" TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."gst_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gst_periods_rls_ins" ON "public"."gst_periods" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "gst_periods_rls_sel" ON "public"."gst_periods" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "gst_periods_rls_upd" ON "public"."gst_periods" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "invite_sel" ON "public"."staff_invitations" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."lab_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lab_events_rls_ins" ON "public"."lab_events" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."lab_orders" "par"
  WHERE ("par"."id" = "lab_events"."lab_order_id")))));



CREATE POLICY "lab_events_rls_sel" ON "public"."lab_events" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."lab_orders" "par"
  WHERE ("par"."id" = "lab_events"."lab_order_id")))));



ALTER TABLE "public"."lab_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lab_orders_rls_ins" ON "public"."lab_orders" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "lab_orders_rls_sel" ON "public"."lab_orders" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "lab_orders_rls_upd" ON "public"."lab_orders" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id"))) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



ALTER TABLE "public"."lens_compatibility_evaluation_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lens_compatibility_evaluation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lens_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lens_options_anon" ON "public"."lens_options" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("org_id" = "public"."request_org"())));



CREATE POLICY "lens_options_rls_ins" ON "public"."lens_options" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "lens_options_rls_sel" ON "public"."lens_options" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "lens_options_rls_upd" ON "public"."lens_options" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



ALTER TABLE "public"."lens_package_compatibility_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lens_package_compatibility_rules_i" ON "public"."lens_package_compatibility_rules" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_compatibility_rules"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "lens_package_compatibility_rules_s" ON "public"."lens_package_compatibility_rules" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "lens_package_compatibility_rules_u" ON "public"."lens_package_compatibility_rules" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_compatibility_rules"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_compatibility_rules"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."lens_package_option_combination_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lens_package_option_combinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lens_package_option_eligibility" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lens_package_option_eligibility_i" ON "public"."lens_package_option_eligibility" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_eligibility"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "lens_package_option_eligibility_s" ON "public"."lens_package_option_eligibility" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "lens_package_option_eligibility_u" ON "public"."lens_package_option_eligibility" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_eligibility"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_eligibility"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."lens_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lens_packages_anon" ON "public"."lens_packages" FOR SELECT TO "anon" USING ((("status" = 'active'::"text") AND ("org_id" = "public"."request_org"())));



CREATE POLICY "lens_packages_rls_ins" ON "public"."lens_packages" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "lens_packages_rls_sel" ON "public"."lens_packages" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "lens_packages_rls_upd" ON "public"."lens_packages" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "loyalty_customer_read" ON "public"."loyalty_ledger" FOR SELECT TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



ALTER TABLE "public"."loyalty_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_ledger_customer" ON "public"."loyalty_ledger" FOR SELECT TO "authenticated" USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "loyalty_ledger_staff" ON "public"."loyalty_ledger" USING (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."loyalty_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_rules_public" ON "public"."loyalty_rules" FOR SELECT TO "authenticated", "anon" USING ((true AND ("org_id" = "public"."request_org"())));



CREATE POLICY "loyalty_rules_staff" ON "public"."loyalty_rules" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "loyalty_staff" ON "public"."loyalty_ledger" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



ALTER TABLE "public"."message_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mt_delete" ON "public"."message_templates" FOR DELETE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "mt_insert" ON "public"."message_templates" FOR INSERT WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "mt_select" ON "public"."message_templates" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "mt_update" ON "public"."message_templates" FOR UPDATE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offers_public" ON "public"."offers" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (("valid_from" IS NULL) OR ("valid_from" <= CURRENT_DATE)) AND (("valid_until" IS NULL) OR ("valid_until" >= CURRENT_DATE)) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "offers_staff" ON "public"."offers" USING (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."online_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "online_payments_own" ON "public"."online_payments" FOR SELECT TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "org_anon" ON "public"."organizations" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."org_domains" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_read" ON "public"."organizations" FOR SELECT USING (("id" = "public"."current_org"()));



ALTER TABLE "public"."org_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_settings_i" ON "public"."org_settings" FOR INSERT WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "org_settings_s" ON "public"."org_settings" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "org_settings_u" ON "public"."org_settings" FOR UPDATE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pal_insert" ON "public"."prescription_audit_log" FOR INSERT WITH CHECK (("org_id" = "public"."current_org"()));



CREATE POLICY "pal_select" ON "public"."prescription_audit_log" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "palre_evaluation_candidates_i" ON "public"."lens_compatibility_evaluation_candidates" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_compatibility_evaluation_candidates"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = 'optometrist'::"text"))))));



CREATE POLICY "palre_evaluation_candidates_s" ON "public"."lens_compatibility_evaluation_candidates" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_compatibility_evaluation_candidates"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['optometrist'::"text", 'owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "palre_evaluation_runs_i" ON "public"."lens_compatibility_evaluation_runs" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND ("evaluated_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_compatibility_evaluation_runs"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = 'optometrist'::"text"))))));



CREATE POLICY "palre_evaluation_runs_s" ON "public"."lens_compatibility_evaluation_runs" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_compatibility_evaluation_runs"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['optometrist'::"text", 'owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."palre_fulfilment_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "palre_fulfilment_snapshots_i" ON "public"."palre_fulfilment_snapshots" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_fulfilment_snapshots"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'inventory_manager'::"text", 'lab_technician'::"text"])))))));



CREATE POLICY "palre_fulfilment_snapshots_s" ON "public"."palre_fulfilment_snapshots" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_fulfilment_snapshots"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = ANY (ARRAY['optometrist'::"text", 'owner'::"text", 'admin'::"text", 'inventory_manager'::"text", 'lab_technician'::"text"])))))));



CREATE POLICY "palre_option_combination_items_d" ON "public"."lens_package_option_combination_items" FOR DELETE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combination_items"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "palre_option_combination_items_i" ON "public"."lens_package_option_combination_items" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combination_items"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "palre_option_combination_items_s" ON "public"."lens_package_option_combination_items" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "palre_option_combination_items_u" ON "public"."lens_package_option_combination_items" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combination_items"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combination_items"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "palre_option_combinations_d" ON "public"."lens_package_option_combinations" FOR DELETE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combinations"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "palre_option_combinations_i" ON "public"."lens_package_option_combinations" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combinations"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "palre_option_combinations_s" ON "public"."lens_package_option_combinations" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "palre_option_combinations_u" ON "public"."lens_package_option_combinations" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combinations"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "lens_package_option_combinations"."org_id") AND ("p"."is_approved" = true) AND ("p"."deactivated" = false) AND ("p"."role_key" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."palre_recommendation_candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "palre_recommendation_candidates_i" ON "public"."palre_recommendation_candidates" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_recommendation_candidates"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = 'optometrist'::"text"))))));



CREATE POLICY "palre_recommendation_candidates_s" ON "public"."palre_recommendation_candidates" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_recommendation_candidates"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = ANY (ARRAY['optometrist'::"text", 'owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."palre_recommendation_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "palre_recommendation_events_i" ON "public"."palre_recommendation_events" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND ("actor_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_recommendation_events"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = 'optometrist'::"text"))))));



CREATE POLICY "palre_recommendation_events_s" ON "public"."palre_recommendation_events" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_recommendation_events"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = ANY (ARRAY['optometrist'::"text", 'owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."palre_recommendation_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "palre_recommendation_runs_i" ON "public"."palre_recommendation_runs" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND ("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_recommendation_runs"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = 'optometrist'::"text"))))));



CREATE POLICY "palre_recommendation_runs_s" ON "public"."palre_recommendation_runs" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "palre_recommendation_runs"."org_id") AND "p"."is_approved" AND (NOT "p"."deactivated") AND ("p"."role_key" = ANY (ARRAY['optometrist'::"text", 'owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_customer_read" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales" "s"
  WHERE (("s"."id" = "payments"."sale_id") AND ("s"."customer_id" = ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"())
         LIMIT 1))))));



CREATE POLICY "payments_customer_select" ON "public"."payments" FOR SELECT TO "authenticated" USING (("sale_id" IN ( SELECT "sales"."id"
   FROM "public"."sales"
  WHERE ("sales"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"()))))));



CREATE POLICY "payments_rls_ins" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "payments"."sale_id")))));



CREATE POLICY "payments_rls_sel" ON "public"."payments" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "payments"."sale_id")))));



CREATE POLICY "payments_rls_upd" ON "public"."payments" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "payments"."sale_id"))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "payments"."sale_id")))));



CREATE POLICY "pb_sel" ON "public"."profile_branches" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (("profile_id" = "auth"."uid"()) OR "public"."is_manager"())));



CREATE POLICY "pc_del" ON "public"."product_costs" FOR DELETE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "pc_ins" ON "public"."product_costs" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "pc_read" ON "public"."permission_catalog" FOR SELECT USING (("public"."current_org"() IS NOT NULL));



CREATE POLICY "pc_sel" ON "public"."product_costs" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "pc_upd" ON "public"."product_costs" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



ALTER TABLE "public"."permission_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "po_staff" ON "public"."purchase_orders" USING (("org_id" = "public"."current_org"())) WITH CHECK (("org_id" = "public"."current_org"()));



CREATE POLICY "por_staff" ON "public"."purchase_order_receipts" USING (("org_id" = "public"."current_org"())) WITH CHECK (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."prescription_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prescriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prescriptions_customer_read" ON "public"."prescriptions" FOR SELECT TO "authenticated" USING ((("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)) OR (EXISTS ( SELECT 1
   FROM "public"."family_members" "fm"
  WHERE (("fm"."primary_customer_id" = ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"())
         LIMIT 1)) AND ("fm"."member_customer_id" = "prescriptions"."customer_id") AND ("fm"."is_active" = true))))));



CREATE POLICY "prescriptions_customer_select" ON "public"."prescriptions" FOR SELECT TO "authenticated" USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."product_costs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_view_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_anon" ON "public"."products" FOR SELECT TO "anon" USING (("visible_on_website" AND ("status" = 'active'::"text") AND ("org_id" = "public"."request_org"())));



CREATE POLICY "products_rls_ins" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "products_rls_sel" ON "public"."products" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "products_rls_upd" ON "public"."products" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



ALTER TABLE "public"."profile_branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_self" ON "public"."profiles" FOR SELECT USING (((("id" = "auth"."uid"()) OR ("org_id" = "public"."current_org"())) AND ("org_id" = "public"."request_org"())));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_invoices_rls_ins" ON "public"."purchase_invoices" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "purchase_invoices_rls_sel" ON "public"."purchase_invoices" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "purchase_invoices_rls_upd" ON "public"."purchase_invoices" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



ALTER TABLE "public"."purchase_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_items_rls_ins" ON "public"."purchase_items" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "par"
  WHERE ("par"."id" = "purchase_items"."purchase_id")))));



CREATE POLICY "purchase_items_rls_sel" ON "public"."purchase_items" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "par"
  WHERE ("par"."id" = "purchase_items"."purchase_id")))));



ALTER TABLE "public"."purchase_order_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pvc_public_read" ON "public"."product_view_counts" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referrals_own" ON "public"."referrals" FOR SELECT TO "authenticated" USING ((("referrer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)) OR ("referee_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1))));



CREATE POLICY "referrals_staff" ON "public"."referrals" USING (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."repair_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "repair_events_customer_select" ON "public"."repair_events" FOR SELECT TO "authenticated" USING (("repair_id" IN ( SELECT "repairs"."id"
   FROM "public"."repairs"
  WHERE ("repairs"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"()))))));



CREATE POLICY "repair_events_rls_ins" ON "public"."repair_events" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."repairs" "par"
  WHERE ("par"."id" = "repair_events"."repair_id")))));



CREATE POLICY "repair_events_rls_sel" ON "public"."repair_events" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."repairs" "par"
  WHERE ("par"."id" = "repair_events"."repair_id")))));



ALTER TABLE "public"."repairs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "repairs_customer_insert" ON "public"."repairs" FOR INSERT TO "authenticated" WITH CHECK ((("status" = 'pending'::"text") AND ("paid" = false) AND ("sale_id" IS NULL) AND (("customer_id", "org_id") IN ( SELECT "customers"."id",
    "customers"."org_id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "repairs_customer_select" ON "public"."repairs" FOR SELECT TO "authenticated" USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "repairs_rls_del" ON "public"."repairs" FOR DELETE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "repairs_rls_ins" ON "public"."repairs" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "repairs_rls_sel" ON "public"."repairs" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "repairs_rls_upd" ON "public"."repairs" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id"))) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "reviews_anon" ON "public"."product_reviews" FOR SELECT TO "anon" USING ((("status" = 'approved'::"text") AND ("org_id" = "public"."request_org"())));



CREATE POLICY "reviews_insert" ON "public"."product_reviews" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "reviews_mgmt" ON "public"."product_reviews" FOR UPDATE USING (("org_id" = "public"."current_org"()));



CREATE POLICY "reviews_staff" ON "public"."product_reviews" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roleperm_sel" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "rp_read" ON "public"."role_permissions" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "rx_insert" ON "public"."prescriptions" FOR INSERT WITH CHECK (("org_id" = "public"."current_org"()));



CREATE POLICY "rx_select" ON "public"."prescriptions" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "rx_update" ON "public"."prescriptions" FOR UPDATE USING (("org_id" = "public"."current_org"())) WITH CHECK (("org_id" = "public"."current_org"()));



ALTER TABLE "public"."sale_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sale_events_customer_select" ON "public"."sale_events" FOR SELECT TO "authenticated" USING (("sale_id" IN ( SELECT "sales"."id"
   FROM "public"."sales"
  WHERE ("sales"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"()))))));



CREATE POLICY "sale_events_staff_select" ON "public"."sale_events" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



ALTER TABLE "public"."sale_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sale_lines_customer_read" ON "public"."sale_lines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales" "s"
  WHERE (("s"."id" = "sale_lines"."sale_id") AND ("s"."customer_id" = ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"())
         LIMIT 1))))));



CREATE POLICY "sale_lines_customer_select" ON "public"."sale_lines" FOR SELECT TO "authenticated" USING (("sale_id" IN ( SELECT "sales"."id"
   FROM "public"."sales"
  WHERE ("sales"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."auth_user_id" = "auth"."uid"()))))));



CREATE POLICY "sale_lines_rls_ins" ON "public"."sale_lines" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "sale_lines"."sale_id")))));



CREATE POLICY "sale_lines_rls_sel" ON "public"."sale_lines" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "sale_lines"."sale_id")))));



CREATE POLICY "sale_lines_rls_upd" ON "public"."sale_lines" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "sale_lines"."sale_id"))))) WITH CHECK ((("org_id" = "public"."current_org"()) AND (EXISTS ( SELECT 1
   FROM "public"."sales" "par"
  WHERE ("par"."id" = "sale_lines"."sale_id")))));



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_customer_read" ON "public"."sales" FOR SELECT TO "authenticated" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "sales_customer_select" ON "public"."sales" FOR SELECT TO "authenticated" USING (("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "sales_rls_ins" ON "public"."sales" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "sales_rls_sel" ON "public"."sales" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "sales_rls_upd" ON "public"."sales" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id"))) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "sd_admin" ON "public"."site_domains" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "si_select" ON "public"."staff_invitations" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."site_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sp_anon" ON "public"."site_pages" FOR SELECT TO "authenticated", "anon" USING ("is_active");



CREATE POLICY "sp_del" ON "public"."site_pages" FOR DELETE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "sp_ins" ON "public"."site_pages" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "sp_staff" ON "public"."site_pages" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "sp_upd" ON "public"."site_pages" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"())) WITH CHECK (("org_id" = "public"."current_org"()));



CREATE POLICY "st_select" ON "public"."stock_transfers" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("public"."can_access_branch"("from_branch") OR "public"."can_access_branch"("to_branch"))));



ALTER TABLE "public"."staff_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stl_select" ON "public"."stock_transfer_lines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."stock_transfers" "t"
  WHERE ("t"."id" = "stock_transfer_lines"."transfer_id"))));



ALTER TABLE "public"."stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_rls_ins" ON "public"."stock_movements" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "stock_movements_rls_sel" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "stock_rls_ins" ON "public"."stock" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



CREATE POLICY "stock_rls_sel" ON "public"."stock" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id")));



CREATE POLICY "stock_rls_upd" ON "public"."stock" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."can_access_branch"("branch_id") AND "public"."is_manager"()));



ALTER TABLE "public"."stock_transfer_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_rls_ins" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "suppliers_rls_sel" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "suppliers_rls_upd" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND "public"."is_manager"())) WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_manager"()));



CREATE POLICY "transfer_sel" ON "public"."branch_transfers" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."current_org"()) AND ("public"."can_access_branch"("from_branch") OR "public"."can_access_branch"("to_branch"))));



CREATE POLICY "ub_select" ON "public"."user_branches" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND (("user_id" = "auth"."uid"()) OR ("public"."current_role_key"() = ANY (ARRAY['owner'::"text", 'admin'::"text", 'branch_manager'::"text"])))));



ALTER TABLE "public"."user_branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_log_staff" ON "public"."whatsapp_log" USING (("org_id" = "public"."current_org"()));



CREATE POLICY "wc_anon" ON "public"."website_content" FOR SELECT TO "anon" USING (("is_active" AND (("valid_until" IS NULL) OR ("valid_until" >= CURRENT_DATE)) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "wc_delete" ON "public"."website_content" FOR DELETE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "wc_staff" ON "public"."website_content" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "wc_update" ON "public"."website_content" FOR UPDATE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "wc_write" ON "public"."website_content" FOR INSERT WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



ALTER TABLE "public"."website_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wishlist_own" ON "public"."customer_wishlist" USING (("customer_id" = ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "ws_anon" ON "public"."website_sections" FOR SELECT TO "anon" USING (("enabled" AND ("org_id" = "public"."request_org"())));



CREATE POLICY "ws_delete" ON "public"."website_sections" FOR DELETE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "ws_staff" ON "public"."website_sections" FOR SELECT USING ((("org_id" = "public"."current_org"()) AND ("org_id" = "public"."request_org"())));



CREATE POLICY "ws_update" ON "public"."website_sections" FOR UPDATE USING ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));



CREATE POLICY "ws_write" ON "public"."website_sections" FOR INSERT WITH CHECK ((("org_id" = "public"."current_org"()) AND "public"."is_admin"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."_assert_other_owner"("p_target" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_assert_other_owner"("p_target" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_assert_other_owner"("p_target" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_set_branches"("p_org" "uuid", "p_user" "uuid", "p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_set_branches"("p_org" "uuid", "p_user" "uuid", "p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_set_branches"("p_org" "uuid", "p_user" "uuid", "p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_staff_guard"("p_target" "uuid", "p_new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_staff_guard"("p_target" "uuid", "p_new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_staff_guard"("p_target" "uuid", "p_new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_org_domain"("p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_org_domain"("p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_org_domain"("p_domain" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_staff"("p_id" "uuid", "p_role" "text", "p_branch" "uuid", "p_set_branch" boolean, "p_deactivated" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_staff"("p_id" "uuid", "p_role" "text", "p_branch" "uuid", "p_set_branch" boolean, "p_deactivated" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_staff"("p_id" "uuid", "p_role" "text", "p_branch" "uuid", "p_set_branch" boolean, "p_deactivated" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."advance_lab_orders"("p_ids" "uuid"[], "p_to" "text", "p_note" "text", "p_supplier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_lab_orders"("p_ids" "uuid"[], "p_to" "text", "p_note" "text", "p_supplier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_lab_orders"("p_ids" "uuid"[], "p_to" "text", "p_note" "text", "p_supplier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."advance_repair"("p_id" "uuid", "p_to" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_repair"("p_id" "uuid", "p_to" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_repair"("p_id" "uuid", "p_to" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."advance_web_order"("p_sale" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_web_order"("p_sale" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_web_order"("p_sale" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_branch_scope"("t" "regclass") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_branch_scope"("t" "regclass") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_branch_scope"("t" "regclass") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_permission"("t" "text", "p_write" "text", "p_read" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_permission"("t" "text", "p_write" "text", "p_read" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_permission"("t" "text", "p_write" "text", "p_read" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid", "p_member_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_family_member_request"("p_request_id" "uuid", "p_member_customer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_staff"("p_user" "uuid", "p_role" "text", "p_branch_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."approve_staff"("p_user" "uuid", "p_role" "text", "p_branch_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_staff"("p_user" "uuid", "p_role" "text", "p_branch_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_stock_transfer"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_stock_transfer"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_stock_transfer"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_transfer"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_transfer"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_transfer"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_temp_branch"("p_profile" "uuid", "p_branch" "uuid", "p_ends" timestamp with time zone, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_temp_branch"("p_profile" "uuid", "p_branch" "uuid", "p_ends" timestamp with time zone, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_temp_branch"("p_profile" "uuid", "p_branch" "uuid", "p_ends" timestamp with time zone, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_immutable"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_immutable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_immutable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_log_immutable"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_immutable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_immutable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_row"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_row"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_row"() TO "service_role";



GRANT ALL ON FUNCTION "public"."branch_overview"() TO "anon";
GRANT ALL ON FUNCTION "public"."branch_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."branch_overview"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_product_view"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bump_product_view"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_product_view"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_branch"("b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_branch"("b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_branch"("b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_order"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_order"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_order"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cashbook_from_credit_note"() TO "anon";
GRANT ALL ON FUNCTION "public"."cashbook_from_credit_note"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cashbook_from_credit_note"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cashbook_from_expense"() TO "anon";
GRANT ALL ON FUNCTION "public"."cashbook_from_expense"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cashbook_from_expense"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cashbook_from_online"() TO "anon";
GRANT ALL ON FUNCTION "public"."cashbook_from_online"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cashbook_from_online"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cashbook_from_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."cashbook_from_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cashbook_from_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cashbook_from_purchase"() TO "anon";
GRANT ALL ON FUNCTION "public"."cashbook_from_purchase"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cashbook_from_purchase"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cashbook_method"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cashbook_method"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cashbook_method"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_invitation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_invitation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_invitation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."close_stock_transfer"("p_id" "uuid", "p_reject" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."close_stock_transfer"("p_id" "uuid", "p_reject" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_stock_transfer"("p_id" "uuid", "p_reject" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_transfer"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_transfer"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_transfer"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_credit_note"("p" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_credit_note"("p" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_credit_note"("p" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_organisation"("p_name" "text", "p_branch_name" "text", "p_branch_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_organisation"("p_name" "text", "p_branch_name" "text", "p_branch_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organisation"("p_name" "text", "p_branch_name" "text", "p_branch_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."credit_notes_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."credit_notes_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_notes_before"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_portal_customer_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_portal_customer_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_portal_customer_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_role_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_role_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_role_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."customer_branch_context"("p_customer" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."customer_branch_context"("p_customer" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."customer_branch_context"("p_customer" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."customers_assign_codes"() TO "anon";
GRANT ALL ON FUNCTION "public"."customers_assign_codes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."customers_assign_codes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."customers_protect_cols"() TO "anon";
GRANT ALL ON FUNCTION "public"."customers_protect_cols"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."customers_protect_cols"() TO "service_role";



GRANT ALL ON FUNCTION "public"."default_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."default_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."default_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deliver_order"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deliver_order"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deliver_order"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_branch_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_branch_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_branch_scope"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_branch_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_branch_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_branch_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_permission"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_permission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_permission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fill_patient_customer_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."fill_patient_customer_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_patient_customer_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_temp_branch"("p_user" "uuid", "p_branch" "uuid", "p_expires" timestamp with time zone, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_temp_branch"("p_user" "uuid", "p_branch" "uuid", "p_expires" timestamp with time zone, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_temp_branch"("p_user" "uuid", "p_branch" "uuid", "p_expires" timestamp with time zone, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_perm"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_perm"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_perm"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_staff"("p_email" "text", "p_role" "text", "p_branch" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_staff"("p_email" "text", "p_role" "text", "p_branch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_staff"("p_email" "text", "p_role" "text", "p_branch" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_prescription_expired"("p_rx_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_prescription_expired"("p_rx_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_prescription_expired"("p_rx_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lab_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."lab_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lab_before"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_export"("p_kind" "text", "p_rows" integer, "p_detail" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_export"("p_kind" "text", "p_rows" integer, "p_detail" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_export"("p_kind" "text", "p_rows" integer, "p_detail" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."next_code"("p_org" "uuid", "p_key" "text", "p_prefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."next_code"("p_org" "uuid", "p_key" "text", "p_prefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_code"("p_org" "uuid", "p_key" "text", "p_prefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."org_default_text"("p_key" "text", "p_fallback" "text", "p_org" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."org_default_text"("p_key" "text", "p_fallback" "text", "p_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_default_text"("p_key" "text", "p_fallback" "text", "p_org" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."org_for_host"("p_host" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."org_for_host"("p_host" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."palre_guard_verified_catalogue_evidence"() TO "anon";
GRANT ALL ON FUNCTION "public"."palre_guard_verified_catalogue_evidence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."palre_guard_verified_catalogue_evidence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."palre_guard_verified_option_combination"() TO "anon";
GRANT ALL ON FUNCTION "public"."palre_guard_verified_option_combination"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."palre_guard_verified_option_combination"() TO "service_role";



GRANT ALL ON FUNCTION "public"."palre_recommendation_event_no_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."palre_recommendation_event_no_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."palre_recommendation_event_no_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."palre_validate_compatibility_design_family"() TO "anon";
GRANT ALL ON FUNCTION "public"."palre_validate_compatibility_design_family"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."palre_validate_compatibility_design_family"() TO "service_role";



GRANT ALL ON FUNCTION "public"."palre_validate_option_combination"() TO "anon";
GRANT ALL ON FUNCTION "public"."palre_validate_option_combination"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."palre_validate_option_combination"() TO "service_role";



GRANT ALL ON FUNCTION "public"."payments_apply"() TO "anon";
GRANT ALL ON FUNCTION "public"."payments_apply"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."payments_apply"() TO "service_role";



GRANT ALL ON FUNCTION "public"."place_sale"("p" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."place_sale"("p" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."place_sale"("p" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."portal_family_members"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."portal_family_members"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_family_members"() TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_notify_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_notify_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_notify_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_notify_loyalty"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_notify_loyalty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_notify_loyalty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_notify_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_notify_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_notify_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_notify_prescription"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_notify_prescription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_notify_prescription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prescriptions_assign_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."prescriptions_assign_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prescriptions_assign_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prescriptions_check_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."prescriptions_check_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prescriptions_check_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."product_costs_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."product_costs_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_costs_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."products_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."products_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."products_before"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purchase_orders_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_orders_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_orders_no"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_limit" integer, "p_window_secs" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_limit" integer, "p_window_secs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."receive_stock_transfer"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."receive_stock_transfer"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."receive_stock_transfer"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."receive_transfer"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."receive_transfer"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."receive_transfer"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_palre_compatibility_evaluation"("p_prescription_id" "uuid", "p_design_family" "text", "p_result_status" "text", "p_preferred_index" numeric, "p_measurements" "jsonb", "p_candidates" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_palre_compatibility_evaluation"("p_prescription_id" "uuid", "p_design_family" "text", "p_result_status" "text", "p_preferred_index" numeric, "p_measurements" "jsonb", "p_candidates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_palre_compatibility_evaluation"("p_prescription_id" "uuid", "p_design_family" "text", "p_result_status" "text", "p_preferred_index" numeric, "p_measurements" "jsonb", "p_candidates" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_palre_recommendation_run"("p_prescription_id" "uuid", "p_compatibility_run_ids" "uuid"[], "p_status" "text", "p_snapshot" "jsonb", "p_candidates" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_palre_recommendation_run"("p_prescription_id" "uuid", "p_compatibility_run_ids" "uuid"[], "p_status" "text", "p_snapshot" "jsonb", "p_candidates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_palre_recommendation_run"("p_prescription_id" "uuid", "p_compatibility_run_ids" "uuid"[], "p_status" "text", "p_snapshot" "jsonb", "p_candidates" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_family_member_request"("p_request_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_family_member_request"("p_request_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_family_member_request"("p_request_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_org_domain"("p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_org_domain"("p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_org_domain"("p_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."repairs_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."repairs_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."repairs_before"() TO "service_role";



GRANT ALL ON FUNCTION "public"."request_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."request_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."request_stock_transfer"("p_from" "uuid", "p_to" "uuid", "p_lines" "jsonb", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_stock_transfer"("p_from" "uuid", "p_to" "uuid", "p_lines" "jsonb", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_stock_transfer"("p_from" "uuid", "p_to" "uuid", "p_lines" "jsonb", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_transfer"("p_from" "uuid", "p_to" "uuid", "p_product" "uuid", "p_qty" integer, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_transfer"("p_from" "uuid", "p_to" "uuid", "p_product" "uuid", "p_qty" integer, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_transfer"("p_from" "uuid", "p_to" "uuid", "p_product" "uuid", "p_qty" integer, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_org"("p_host" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_org"("p_host" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_org"("p_host" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_branch_access"("p_user" "uuid", "p_branch" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_branch_access"("p_user" "uuid", "p_branch" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_branch_access"("p_user" "uuid", "p_branch" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_invitation"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_temp_assignment"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_temp_assignment"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_temp_assignment"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sale_events_track"() TO "anon";
GRANT ALL ON FUNCTION "public"."sale_events_track"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sale_events_track"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."sales_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_before"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_trend"("p_branch" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sales_trend"("p_branch" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_trend"("p_branch" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_org_permissions"("p_org" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_org_permissions"("p_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_org_permissions"("p_org" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profile_branches"("p_profile" "uuid", "p_branches" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profile_branches"("p_profile" "uuid", "p_branches" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profile_branches"("p_profile" "uuid", "p_branches" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_referral_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_referral_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_referral_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_role_permission"("p_role" "text", "p_permission" "text", "p_allowed" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_role_permission"("p_role" "text", "p_permission" "text", "p_allowed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_role_permission"("p_role" "text", "p_permission" "text", "p_allowed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_staff_active"("p_user" "uuid", "p_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_staff_active"("p_user" "uuid", "p_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_staff_active"("p_user" "uuid", "p_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_staff_branches"("p_user" "uuid", "p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_staff_branches"("p_user" "uuid", "p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_staff_branches"("p_user" "uuid", "p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_staff_role"("p_user" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_staff_role"("p_user" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_staff_role"("p_user" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sp_touch"() TO "anon";
GRANT ALL ON FUNCTION "public"."sp_touch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sp_touch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_auth_to_customer"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_auth_to_customer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_auth_to_customer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_pi_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_pi_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_pi_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_po_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_po_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_po_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_org_seed_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_org_seed_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_org_seed_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_family_member_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_family_member_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_family_member_org"() TO "service_role";


















GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branch_transfers" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branch_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."cashbook" TO "anon";
GRANT ALL ON TABLE "public"."cashbook" TO "authenticated";
GRANT ALL ON TABLE "public"."cashbook" TO "service_role";



GRANT ALL ON TABLE "public"."counters" TO "anon";
GRANT ALL ON TABLE "public"."counters" TO "authenticated";
GRANT ALL ON TABLE "public"."counters" TO "service_role";



GRANT ALL ON TABLE "public"."coupon_uses" TO "anon";
GRANT ALL ON TABLE "public"."coupon_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."coupon_uses" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."credit_note_lines" TO "anon";
GRANT ALL ON TABLE "public"."credit_note_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_note_lines" TO "service_role";



GRANT ALL ON TABLE "public"."credit_notes" TO "anon";
GRANT ALL ON TABLE "public"."credit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."crm_settings" TO "anon";
GRANT ALL ON TABLE "public"."crm_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_settings" TO "service_role";



GRANT ALL ON TABLE "public"."cron_runs" TO "anon";
GRANT ALL ON TABLE "public"."cron_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."cron_runs" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_ledger" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."customer_loyalty_balance" TO "anon";
GRANT ALL ON TABLE "public"."customer_loyalty_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_loyalty_balance" TO "service_role";



GRANT ALL ON TABLE "public"."customer_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."customer_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."customer_notifications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customer_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_notifications" TO "service_role";



GRANT UPDATE("read_at") ON TABLE "public"."customer_notifications" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."customer_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_orders" TO "anon";
GRANT ALL ON TABLE "public"."customer_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_orders" TO "service_role";



GRANT ALL ON TABLE "public"."customer_wishlist" TO "anon";
GRANT ALL ON TABLE "public"."customer_wishlist" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_wishlist" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."day_closings" TO "anon";
GRANT ALL ON TABLE "public"."day_closings" TO "authenticated";
GRANT ALL ON TABLE "public"."day_closings" TO "service_role";



GRANT ALL ON TABLE "public"."document_links" TO "anon";
GRANT ALL ON TABLE "public"."document_links" TO "authenticated";
GRANT ALL ON TABLE "public"."document_links" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."eye_examination_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."eye_examination_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."eye_examination_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."eye_examinations" TO "anon";
GRANT ALL ON TABLE "public"."eye_examinations" TO "authenticated";
GRANT ALL ON TABLE "public"."eye_examinations" TO "service_role";



GRANT ALL ON TABLE "public"."family_member_requests" TO "anon";
GRANT ALL ON TABLE "public"."family_member_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."family_member_requests" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."gst_periods" TO "anon";
GRANT ALL ON TABLE "public"."gst_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."gst_periods" TO "service_role";



GRANT ALL ON SEQUENCE "public"."household_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."household_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."household_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_invoices" TO "anon";
GRANT ALL ON TABLE "public"."purchase_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."itc_summary" TO "anon";
GRANT ALL ON TABLE "public"."itc_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."itc_summary" TO "service_role";



GRANT ALL ON TABLE "public"."lab_events" TO "anon";
GRANT ALL ON TABLE "public"."lab_events" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lab_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lab_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lab_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lab_orders" TO "anon";
GRANT ALL ON TABLE "public"."lab_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_orders" TO "service_role";



GRANT ALL ON TABLE "public"."lens_compatibility_evaluation_candidates" TO "anon";
GRANT ALL ON TABLE "public"."lens_compatibility_evaluation_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_compatibility_evaluation_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."lens_compatibility_evaluation_runs" TO "anon";
GRANT ALL ON TABLE "public"."lens_compatibility_evaluation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_compatibility_evaluation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."lens_options" TO "anon";
GRANT ALL ON TABLE "public"."lens_options" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_options" TO "service_role";



GRANT ALL ON TABLE "public"."lens_package_compatibility_rules" TO "anon";
GRANT ALL ON TABLE "public"."lens_package_compatibility_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_package_compatibility_rules" TO "service_role";



GRANT ALL ON TABLE "public"."lens_package_option_combination_items" TO "anon";
GRANT ALL ON TABLE "public"."lens_package_option_combination_items" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_package_option_combination_items" TO "service_role";



GRANT ALL ON TABLE "public"."lens_package_option_combinations" TO "anon";
GRANT ALL ON TABLE "public"."lens_package_option_combinations" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_package_option_combinations" TO "service_role";



GRANT ALL ON TABLE "public"."lens_package_option_eligibility" TO "anon";
GRANT ALL ON TABLE "public"."lens_package_option_eligibility" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_package_option_eligibility" TO "service_role";



GRANT ALL ON TABLE "public"."lens_packages" TO "anon";
GRANT ALL ON TABLE "public"."lens_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."lens_packages" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_rules" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_rules" TO "service_role";



GRANT ALL ON TABLE "public"."message_templates" TO "anon";
GRANT ALL ON TABLE "public"."message_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."message_templates" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."online_payments" TO "anon";
GRANT ALL ON TABLE "public"."online_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."online_payments" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."open_po_value" TO "anon";
GRANT ALL ON TABLE "public"."open_po_value" TO "authenticated";
GRANT ALL ON TABLE "public"."open_po_value" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."org_domains" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."org_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."org_domains" TO "service_role";



GRANT ALL ON TABLE "public"."org_settings" TO "anon";
GRANT ALL ON TABLE "public"."org_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."org_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."palre_fulfilment_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."palre_fulfilment_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."palre_fulfilment_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."palre_recommendation_candidates" TO "anon";
GRANT ALL ON TABLE "public"."palre_recommendation_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."palre_recommendation_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."palre_recommendation_events" TO "anon";
GRANT ALL ON TABLE "public"."palre_recommendation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."palre_recommendation_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."palre_recommendation_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."palre_recommendation_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."palre_recommendation_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."palre_recommendation_runs" TO "anon";
GRANT ALL ON TABLE "public"."palre_recommendation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."palre_recommendation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."palre_verified_lens_catalogue" TO "authenticated";
GRANT ALL ON TABLE "public"."palre_verified_lens_catalogue" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."permission_catalog" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."permission_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."prescription_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."prescription_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."prescription_audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prescription_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prescription_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prescription_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prescriptions" TO "anon";
GRANT ALL ON TABLE "public"."prescriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."prescriptions" TO "service_role";



GRANT ALL ON TABLE "public"."product_costs" TO "anon";
GRANT ALL ON TABLE "public"."product_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_costs" TO "service_role";



GRANT ALL ON TABLE "public"."product_reviews" TO "anon";
GRANT ALL ON TABLE "public"."product_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."product_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."product_review_summary" TO "anon";
GRANT ALL ON TABLE "public"."product_review_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."product_review_summary" TO "service_role";



GRANT ALL ON TABLE "public"."product_view_counts" TO "anon";
GRANT ALL ON TABLE "public"."product_view_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."product_view_counts" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_branches" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_branches" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_branches" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."stock" TO "anon";
GRANT ALL ON TABLE "public"."stock" TO "authenticated";
GRANT ALL ON TABLE "public"."stock" TO "service_role";



GRANT ALL ON TABLE "public"."public_catalog" TO "anon";
GRANT ALL ON TABLE "public"."public_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."public_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."public_site_settings" TO "anon";
GRANT ALL ON TABLE "public"."public_site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."public_site_settings" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_receipts" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."repair_events" TO "anon";
GRANT ALL ON TABLE "public"."repair_events" TO "authenticated";
GRANT ALL ON TABLE "public"."repair_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."repair_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."repair_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."repair_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."repairs" TO "anon";
GRANT ALL ON TABLE "public"."repairs" TO "authenticated";
GRANT ALL ON TABLE "public"."repairs" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."sale_events" TO "anon";
GRANT ALL ON TABLE "public"."sale_events" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sale_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sale_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sale_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sale_lines" TO "anon";
GRANT ALL ON TABLE "public"."sale_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_lines" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."site_domains" TO "anon";
GRANT ALL ON TABLE "public"."site_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."site_domains" TO "service_role";



GRANT ALL ON TABLE "public"."site_pages" TO "anon";
GRANT ALL ON TABLE "public"."site_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."site_pages" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_assignments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_assignments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_invitations" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stock_transfer_lines" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stock_transfer_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfer_lines" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stock_transfers" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stock_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_branches" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_branches" TO "authenticated";
GRANT ALL ON TABLE "public"."user_branches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vision_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vision_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vision_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."website_content" TO "anon";
GRANT ALL ON TABLE "public"."website_content" TO "authenticated";
GRANT ALL ON TABLE "public"."website_content" TO "service_role";



GRANT ALL ON TABLE "public"."website_sections" TO "anon";
GRANT ALL ON TABLE "public"."website_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."website_sections" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_log" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_log" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_log" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































