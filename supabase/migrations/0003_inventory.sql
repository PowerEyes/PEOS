create table brands (id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  name text not null, unique (org_id, name));

create table products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  kind text not null check (kind in ('frame','sunglass','contact_lens','accessory')),
  sku text, barcode text, brand_id uuid references brands(id), model text not null, collection text,
  gender text not null default 'unisex' check (gender in ('men','women','unisex','kids')),
  cost_price numeric(10,2), mrp numeric(10,2), selling_price numeric(10,2) not null, tax_pct numeric(4,1) not null default 5,
  power_eligible boolean not null default false,   -- true => "Choose Lens"; false => "Add to Bag"
  status text not null default 'active' check (status in ('active','draft','inactive')),
  visible_on_website boolean not null default false, featured boolean not null default false,
  new_arrival boolean not null default false, bestseller boolean not null default false,
  short_desc text, description text, images text[] not null default '{}', attrs jsonb not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (org_id, sku), unique (org_id, barcode),
  check (not power_eligible or kind in ('frame','sunglass')));
create index on products (org_id, kind, status);

create function products_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.sku := public.next_code(new.org_id, 'sku_' || new.kind,
      case new.kind when 'frame' then 'FRM-' when 'sunglass' then 'SUN-' when 'contact_lens' then 'CL-' else 'ACC-' end);
    new.barcode := coalesce(nullif(new.barcode, ''), new.sku);
  else new.sku := old.sku; new.updated_at := now(); end if;
  return new;
end $$;
create trigger trg_products_before before insert or update on products for each row execute function products_before();
create trigger trg_products_audit after insert or update or delete on products for each row execute function audit_row();

create table stock (
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id), product_id uuid not null references products(id) on delete cascade,
  qty int not null default 0 constraint stock_qty_check check (qty >= 0), reorder_level int not null default 0,
  primary key (branch_id, product_id));
create table stock_movements (
  id bigserial primary key, org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id), product_id uuid not null references products(id),
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('opening','purchase','sale','return','adjustment','damage','transfer_in','transfer_out')),
  note text, created_by uuid default auth.uid(), created_at timestamptz default now());
create function apply_movement() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into stock(org_id, branch_id, product_id, qty) values (new.org_id, new.branch_id, new.product_id, new.delta)
  on conflict (branch_id, product_id) do update set qty = stock.qty + new.delta;
  return new;
end $$;
create trigger trg_apply_movement after insert on stock_movements for each row execute function apply_movement();

create table lens_packages (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  code text not null, name text not null,
  design text not null check (design in ('single_vision','progressive','bifocal','reading','non_prescription')),
  segment text, short_desc text, base_price numeric(10,2) not null, mrp numeric(10,2), tax_pct numeric(4,1) not null default 5,
  features text[] not null default '{}', indexes text[] not null default '{}', coatings text[] not null default '{}',
  sph_min numeric(4,2), sph_max numeric(4,2), cyl_max numeric(4,2),
  status text not null default 'active' check (status in ('active','draft','inactive')), display_order int not null default 0,
  created_at timestamptz default now(), unique (org_id, code));
create trigger trg_lens_audit after insert or update or delete on lens_packages for each row execute function audit_row();

do $$ declare t text; begin
  foreach t in array array['brands','products','stock','stock_movements','lens_packages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (org_id = public.current_org())', t||'_s', t);
    execute format('create policy %I on %I for insert with check (org_id = public.current_org())', t||'_i', t);
  end loop;
  foreach t in array array['products','stock','lens_packages'] loop
    execute format('create policy %I on %I for update using (org_id = public.current_org()) with check (org_id = public.current_org())', t||'_u', t);
  end loop;
end $$;

-- The website reads ONLY this controlled view
create view public_catalog as
select p.id, p.org_id, p.kind, p.sku, b.name as brand, p.model, p.collection, p.gender, p.selling_price, p.mrp,
  p.power_eligible, p.featured, p.new_arrival, p.bestseller, p.short_desc, p.description, p.images, p.attrs,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0) > 0 as in_stock
from products p left join brands b on b.id = p.brand_id where p.visible_on_website and p.status = 'active';
grant select on public_catalog to anon, authenticated;

insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict do nothing;
create policy pimg_read on storage.objects for select using (bucket_id='product-images');
create policy pimg_write on storage.objects for insert with check (bucket_id='product-images' and (storage.foldername(name))[1] = public.current_org()::text);
create policy pimg_del on storage.objects for delete using (bucket_id='product-images' and (storage.foldername(name))[1] = public.current_org()::text);
