-- Refund rule: total quantity credited for a sale line can never exceed what was sold, across all credit notes.
-- (Before, each credit note was capped alone, so the same line could be returned and restocked repeatedly.)
do $$
declare d text; a text; b text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'create_credit_note' and p.pronamespace = 'public'::regnamespace;
  a := 'from sales where id = (p->>''sale_id'')::uuid and org_id = v_org;';
  b := 'v_rqty := least(greatest(1, (l->>''qty'')::int), v_orig.qty);';
  if position(a in d) = 0 or position(b in d) = 0 then raise exception 'create_credit_note shape changed'; end if;
  d := replace(d, a, 'from sales where id = (p->>''sale_id'')::uuid and org_id = v_org for update;');
  d := replace(d, b, 'v_rqty := least(greatest(1, (l->>''qty'')::int), v_orig.qty - coalesce((select sum(cl.qty) from credit_note_lines cl where cl.original_line_id = v_orig.id), 0));
    if v_rqty < 1 then raise exception ''This item has already been fully returned''; end if;');
  execute d;
end $$;
