create or replace function public.place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org();
  v_idem text := nullif(p->>'idempotency_key', '');
begin
  return '{}'::jsonb;
end $$;
