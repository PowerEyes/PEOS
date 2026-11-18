-- ── CRM Automation tables ─────────────────────────────────────────────────────

-- WhatsApp message log — every message sent, success or fail
create table if not exists whatsapp_log (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),
  customer_id  uuid references customers(id),
  phone        text not null,
  template     text not null,
  category     text not null,  -- rx_expiry | birthday | order_update | cart_recovery | manual
  status       text not null default 'sent', -- sent | failed | delivered | read
  wa_message_id text,          -- Meta's message ID for delivery tracking
  error        text,
  metadata     jsonb default '{}',
  sent_at      timestamptz default now()
);
alter table whatsapp_log enable row level security;
create policy wa_log_staff on whatsapp_log for all using (org_id = public.current_org());
create index if not exists idx_wa_log_customer on whatsapp_log(customer_id);
create index if not exists idx_wa_log_category on whatsapp_log(category, sent_at desc);

-- Cron run log — every automation execution
create table if not exists cron_runs (
  id             uuid primary key default gen_random_uuid(),
  job_name       text not null,
  status         text not null default 'running', -- running | completed | failed
  messages_sent  int  not null default 0,
  messages_failed int not null default 0,
  details        jsonb default '{}',
  error          text,
  started_at     timestamptz default now(),
  finished_at    timestamptz
);
alter table cron_runs enable row level security;
create policy cron_runs_staff on cron_runs for all using (true);

-- Cart sync — logged-in customers' cart synced to DB for abandoned cart detection
create table if not exists cart_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id),
  customer_id    uuid not null references customers(id),
  product_id     uuid references products(id),
  product_name   text,
  qty            int  not null default 1,
  frame_price    numeric(10,2),
  lens_package   text,
  lens_total     numeric(10,2),
  total          numeric(10,2),
  rx_data        jsonb,
  notified_at    timestamptz,  -- when abandoned cart message was sent
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
alter table cart_items enable row level security;
create policy cart_staff    on cart_items for all using (org_id = public.current_org());
create policy cart_customer on cart_items for all to authenticated using (
  customer_id = (select id from customers where auth_user_id = auth.uid() limit 1));

-- CRM automation settings per org
create table if not exists crm_settings (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references organizations(id) unique,
  rx_reminder_enabled       boolean not null default true,
  rx_reminder_days_before   int     not null default 30,
  birthday_enabled          boolean not null default true,
  birthday_coupon_pct       int     not null default 10,
  order_updates_enabled     boolean not null default true,
  cart_recovery_enabled     boolean not null default true,
  cart_recovery_hours       int     not null default 4,  -- hours before sending reminder
  wa_provider               text    not null default 'meta', -- meta | interakt | wati
  wa_phone_number_id        text,   -- Meta Phone Number ID
  wa_access_token_set       boolean not null default false,  -- whether secret is set in vault
  updated_at                timestamptz default now()
);
alter table crm_settings enable row level security;
create policy crm_settings_staff on crm_settings for all using (org_id = public.current_org());

insert into crm_settings (org_id) values ('00000000-0000-0000-0000-000000000001')
on conflict (org_id) do nothing;

-- Enable pg_cron extension (needs superuser, run from Supabase Dashboard > Extensions if not enabled)
-- create extension if not exists pg_cron schema extensions;

-- Scheduled cron jobs (uncomment after enabling pg_cron and deploying Edge Functions)
-- select cron.schedule('rx-expiry-9am',   '0 9 * * *', $$select extensions.http_post('https://YOUR_PROJECT.supabase.co/functions/v1/rx-expiry-reminder', headers:='{"Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb, body:='{}'::jsonb)$$);
-- select cron.schedule('birthday-9am',    '0 9 * * *', $$select extensions.http_post('https://YOUR_PROJECT.supabase.co/functions/v1/birthday-greeting',   headers:='{"Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb, body:='{}'::jsonb)$$);
-- select cron.schedule('cart-recovery-4h','0 */4 * * *',$$select extensions.http_post('https://YOUR_PROJECT.supabase.co/functions/v1/abandoned-cart',      headers:='{"Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb, body:='{}'::jsonb)$$);

comment on table whatsapp_log  is 'Log of every WhatsApp message sent by automation';
comment on table cron_runs     is 'Execution log for all scheduled automation jobs';
