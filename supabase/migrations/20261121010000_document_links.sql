-- Secure, expiring, auditable document links for WhatsApp sharing.
-- Tokens are HMAC(id) signed by the app (DOC_LINK_SECRET); only state lives here.
create table if not exists document_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  doc_type text not null check (doc_type in ('sale','rx','repair','lab','credit_note','receipt','appointment')),
  ref_id uuid not null,
  customer_id uuid references customers(id),
  expires_at timestamptz not null,
  max_views int,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  send_count int not null default 0,
  last_sent_at timestamptz,
  pdf_path text, pdf_generated_at timestamptz, last_error text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_doclinks_ref on document_links (doc_type, ref_id, created_at desc);
create index if not exists idx_doclinks_customer on document_links (customer_id);
alter table document_links enable row level security;
drop policy if exists doclinks_staff_select on document_links;
drop policy if exists doclinks_staff_insert on document_links;
drop policy if exists doclinks_staff_update on document_links;
create policy doclinks_staff_select on document_links for select to authenticated using (org_id = public.current_org());
create policy doclinks_staff_insert on document_links for insert to authenticated with check (org_id = public.current_org());
create policy doclinks_staff_update on document_links for update to authenticated using (org_id = public.current_org()) with check (org_id = public.current_org());
-- Audit creation, revocation and sends (not per-view counter bumps).
drop trigger if exists trg_doclinks_audit on document_links;
create trigger trg_doclinks_audit after insert or update of revoked_at, send_count on document_links
  for each row execute function audit_row();
-- Private bucket for generated PDFs (service role only; no public policies).
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

-- New template for payment receipts (existing templates are untouched).
insert into message_templates (org_id, key, category, name, body_auto, body_staff, meta_template, variables, sort_order)
select '00000000-0000-0000-0000-000000000001', 'payment_receipt', 'order', 'Payment receipt',
  $$Hi [Name], we received your payment of [Amount] for order [Code]. Thank you! — [Store]$$,
  $$Hi [Name] 👋 Thank you! We have received your payment of *[Amount]* for order *[Code]*. Your receipt is attached below 💙 — *Team Power Eyes Opticals*$$,
  null, array['Name','Amount','Code'], 175
where not exists (select 1 from message_templates where org_id = '00000000-0000-0000-0000-000000000001' and key = 'payment_receipt');
