-- Audit fixes (Nov 2026 production review).
-- 1. loyalty_rules: every staff member could rewrite the earn/redeem rates. Reading stays org-wide, writing is for managers and above.
drop policy if exists loyalty_rules_staff on public.loyalty_rules;
drop policy if exists loyalty_rules_read on public.loyalty_rules;
drop policy if exists loyalty_rules_write on public.loyalty_rules;
create policy loyalty_rules_read on public.loyalty_rules for select to authenticated using (org_id = public.current_org());
create policy loyalty_rules_write on public.loyalty_rules for all to authenticated using (org_id = public.current_org() and public.is_manager()) with check (org_id = public.current_org() and public.is_manager());

-- 2. organizations was readable by anyone holding the public anon key (policy org_anon: using true), exposing every tenant's legal name,
--    business email/phone and billing address. The website only needs the display name of ITS OWN organisation, via a narrow function.
drop policy if exists org_anon on public.organizations;
create or replace function public.public_store_name(p_org uuid) returns text language sql stable security definer set search_path = public as
$$ select coalesce(nullif(trim(o.name), ''), null) from public.organizations o where o.id = p_org $$;
revoke execute on function public.public_store_name(uuid) from public;
grant execute on function public.public_store_name(uuid) to anon, authenticated;
