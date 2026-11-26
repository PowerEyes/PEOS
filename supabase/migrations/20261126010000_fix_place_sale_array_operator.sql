-- ─── Fix: place_sale uses an array `+` operator PostgreSQL does not have ────────────
--
-- Symptom: once sales.patient_customer_id is back-filled, pressing Pay in the POS
-- fails again, this time with
--   operator does not exist: uuid[] + uuid[]
-- for any bag containing a product or accessory, so orders still cannot be placed.
--
-- Cause: migration 0041_place_sale_restore.sql line 211 writes
--   v_product_ids := v_product_ids + array[v_pid];
-- PostgreSQL has no `+` for arrays — only `||` and array_append(). The statement is
-- reached once per product/accessory line of an order, so place_sale aborts and the
-- whole sale rolls back.
--
-- v_product_ids is written but never read anywhere in the function, so the line is
-- dead weight. It is corrected to `||` rather than deleted so the intent (accumulate
-- the products this sale touched) survives if someone starts reading it.
--
-- The patch is applied to whichever place_sale body is live rather than pasting a
-- fresh copy of the whole function: place_sale is rewritten by nine migrations and
-- by hand, and a pasted copy would silently revert any unrelated fix applied since.
-- Idempotent — a second run finds nothing to replace and does nothing.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'place_sale' and p.prokind = 'f';

  if v_def is null then
    raise exception 'place_sale() not found in schema public';
  end if;

  if position('v_product_ids + array[v_pid]' in v_def) = 0 then
    return;   -- already fixed, or the line is gone: nothing to do
  end if;

  v_def := replace(v_def, 'v_product_ids + array[v_pid]', 'v_product_ids || array[v_pid]');
  execute rtrim(v_def, E'\n;');   -- pg_get_functiondef() trails a semicolon EXECUTE does not want
end $$;
