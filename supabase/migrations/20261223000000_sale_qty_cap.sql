-- Business rule: a sale line quantity is a whole number between 1 and 1000 (stops overflow / absurd values).
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'place_sale' and p.pronamespace = 'public'::regnamespace;
  if position('v_qty := greatest(1, coalesce((l->>''qty'')::int, 1));' in d) = 0 then raise exception 'place_sale qty line not found'; end if;
  d := replace(d, 'v_qty := greatest(1, coalesce((l->>''qty'')::int, 1));',
    'v_qty := greatest(1, coalesce((l->>''qty'')::int, 1)); if v_qty > 1000 then raise exception ''Quantity per line cannot exceed 1000''; end if;');
  execute d;
end $$;
