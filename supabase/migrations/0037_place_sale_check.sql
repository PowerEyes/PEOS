create or replace function public.place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org();
  v_idem text := nullif(p->>'idempotency_key', '');
  v_id uuid;
  v_code text;
begin
  if v_idem is not null and v_idem <> '' then
    select id, code into v_id, v_code from sales where org_id = v_org and idempotency_key = v_idem::uuid limit 1;
    if found then return jsonb_build_object('id', v_id, 'code', v_code, 'idempotent', true); end if;
  end if;
  return '{}'::jsonb;
end $$;
