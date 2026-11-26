-- Cost price is commercially sensitive: move it out of `products` (readable by every staff member) into a table that only
-- managers, admins and owners can read or write. Sales staff keep full access to everything else about a product.
create table if not exists product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  org_id uuid not null default public.current_org() references organizations(id),
  cost_price numeric(10,2) check (cost_price is null or cost_price >= 0),
  updated_by uuid default auth.uid(), updated_at timestamptz not null default now());
alter table product_costs enable row level security;
create policy pc_sel on product_costs for select to authenticated using (org_id = public.current_org() and public.is_manager());
create policy pc_ins on product_costs for insert to authenticated with check (org_id = public.current_org() and public.is_manager());
create policy pc_upd on product_costs for update to authenticated using (org_id = public.current_org() and public.is_manager()) with check (org_id = public.current_org() and public.is_manager());
create policy pc_del on product_costs for delete to authenticated using (org_id = public.current_org() and public.is_manager());
-- A cost can only attach to a product of the same organisation.
create or replace function public.product_costs_guard() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from products p where p.id = new.product_id and p.org_id = new.org_id) then raise exception 'Product not in your organisation' using errcode = '42501'; end if;
  new.updated_at := now(); new.updated_by := auth.uid(); return new;
end $$;
drop trigger if exists trg_product_costs_guard on product_costs;
create trigger trg_product_costs_guard before insert or update on product_costs for each row execute function public.product_costs_guard();

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'cost_price') then
    insert into product_costs (product_id, org_id, cost_price) select id, org_id, cost_price from products where cost_price is not null on conflict do nothing;
    alter table products drop column cost_price;
  end if;
end $$;
