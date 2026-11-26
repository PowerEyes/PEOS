alter table sales add column if not exists idempotency_key uuid;
create unique index if not exists sales_org_id_idem_key on sales (org_id, idempotency_key) where idempotency_key is not null;

create or replace function public.place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org();
  v_idem text := nullif(p->>'idempotency_key', '');
begin
  return '{}'::jsonb;
end $$;
