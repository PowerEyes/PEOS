-- Purchase invoice stock posting
alter table purchase_invoices
  add column if not exists stock_posted_at timestamptz;

-- Allow lines to carry a product_id (jsonb, no schema change needed, documented here).
comment on column purchase_invoices.lines is 'Array of {description, hsn, qty, rate, tax_pct, product_id?}. When product_id is set, receiving the invoice posts a stock movement.';
comment on column purchase_invoices.stock_posted_at is 'Timestamp when stock was received against this invoice (idempotency guard).';