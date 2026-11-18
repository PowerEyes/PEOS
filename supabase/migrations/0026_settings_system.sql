-- 0026_settings_system.sql
-- Settings system: DB-driven WhatsApp message templates, settings-driven code
-- prefixes, and a public read view for the website (contact/analytics).

-- ── 1. Message templates ─────────────────────────────────────────────────────
-- body_staff = warm, full version staff send personally via wa.me
-- body_auto  = short version for automations / quick sends
-- meta_template = approved Meta WhatsApp template name (API automations)
create table if not exists message_templates (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default public.current_org() references organizations(id),
  key           text not null,
  category      text not null default 'general',
  name          text not null,
  body_auto     text not null,
  body_staff    text not null,
  meta_template text,
  variables     text[] not null default '{}',
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (org_id, key)
);
alter table message_templates enable row level security;
drop policy if exists mt_select on message_templates;
drop policy if exists mt_insert on message_templates;
drop policy if exists mt_update on message_templates;
drop policy if exists mt_delete on message_templates;
create policy mt_select on message_templates for select using (org_id = public.current_org());
create policy mt_insert on message_templates for insert with check (org_id = public.current_org() and public.is_admin());
create policy mt_update on message_templates for update using (org_id = public.current_org() and public.is_admin());
create policy mt_delete on message_templates for delete using (org_id = public.current_org() and public.is_admin());

-- Seeds — the standardised Power Eyes brand template set (customer texts verbatim;
-- [Mogappair West / Mogappair East] normalised to [Store], internal placeholders
-- cleaned to [Detail]/[Date]/[Next Action]). Short auto versions composed to match.
insert into message_templates (org_id, key, category, name, body_auto, body_staff, meta_template, variables, sort_order) values

('00000000-0000-0000-0000-000000000001','welcome','onboarding','New customer — Welcome',
$$Hi [Name] 👋 Welcome to the *Power Eyes family!* 💙 We’re always just a message away — for eyewear, adjustments, repairs or anything at all. — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

A warm welcome to the *Power Eyes family!* 💙

We’ve been caring for families and their vision since 1998, and we’re really happy to have you with us. ❤️

For us, it’s not just about glasses — it’s about *understanding what you need and being there for you whenever you need us.* 🤝

From choosing the right eyewear to adjustments, repairs, and after-sales support, *we’re always just a message away.* 😊

Thank you for choosing *Power Eyes Opticals.* We look forward to being your family’s *vision partner for many years to come!* 👓💙

— *Team Power Eyes Opticals*$$,
null, array['Name'], 10),

('00000000-0000-0000-0000-000000000001','order_confirmed','order','Order confirmed',
$$Hi [Name] 👋 Your order for *[Item]* is confirmed! 🎉 We’re getting everything ready with care. — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

Your order for *[Item]* is confirmed! 🎉👓

Our team is getting everything ready with care, and we’ll keep you updated along the way.

Thank you for trusting *Power Eyes Opticals* with your vision. 💙

We’re happy to have you as part of the *Power Eyes family!* 🤝

— *Team Power Eyes Opticals*$$,
'power_eyes_order_confirmed', array['Name','Item'], 20),

('00000000-0000-0000-0000-000000000001','order_in_progress','order','Order in progress',
$$Hi [Name] 👋 Quick update — your *[Item]* is being crafted at our workshop. ✂️ We’ll message you the moment it’s ready! 💙 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋

Just a quick update on your glasses. 😊

Your *[Item]* is currently being crafted at our workshop. ✂️👓

Our team is carefully working on every detail to make sure everything is just right for you.

We’ll let you know the moment your glasses are ready! 💙

Thank you for your patience and for being part of the *Power Eyes family.* 😊

— *Team Power Eyes Opticals*$$,
null, array['Name','Item'], 30),

('00000000-0000-0000-0000-000000000001','order_qc','order','Final quality check',
$$Hi [Name] 👋 Good news — your *[Item]* is almost ready and going through final quality check. ✨ We’ll let you know when it’s ready for pickup. 💙 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

Good news — your glasses are almost ready! 👓✨

Your *[Item]* is now going through our final quality check to make sure everything is just right before we hand them over to you.

We’ll message you as soon as they’re ready for pickup. 💙

Thank you for choosing *Power Eyes Opticals!*

— *Team Power Eyes Opticals*$$,
null, array['Name','Item'], 40),

('00000000-0000-0000-0000-000000000001','order_ready','order','Ready for pickup',
$$Great news, [Name]! 🎉 Your *[Item]* is ready for pickup at our *[Store]* store. 👓 Drop by anytime during store hours. — *Team Power Eyes Opticals*$$,
$$Great news, [Name]! 🎉😊

Your *[Item]* is ready and waiting for you at our *[Store]* store. 👓💙

You can drop by anytime during our store hours, and we’ll have everything ready for you.

We can’t wait to see you and get your new glasses fitted perfectly! 🤝

See you soon! 😊

— *Team Power Eyes Opticals*$$,
'power_eyes_order_ready', array['Name','Item','Store'], 50),

('00000000-0000-0000-0000-000000000001','order_delivered','order','Order delivered',
$$Hi [Name] 👋 Hope you’re loving your new glasses! 👓 Need an adjustment or have any questions? Just message us — we’re always here. 💙 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

Hope you’re loving your new glasses! 👓✨

Thank you for choosing *Power Eyes Opticals* and trusting us with your vision. It truly means a lot to us. 💙

If you need an adjustment, have any questions, or feel that something isn’t quite right, just message us — *we’re always here to help.* 🤝

Welcome to the *Power Eyes family!* ❤️

— *Team Power Eyes Opticals*$$,
'power_eyes_order_delivered', array['Name'], 60),

('00000000-0000-0000-0000-000000000001','order_cancelled','order','Order cancelled',
$$Hi [Name] 👋 Your order *[Code]* has been cancelled. Online refunds take 5–7 business days. Need help? Just reply here. 💙 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

Your order *[Code]* has been cancelled. 🙏

If you paid online, your refund will be processed within 5–7 business days.

If you’d like any help at all — a different pair, a reorder, or just advice — we’re always here. 💙

— *Team Power Eyes Opticals*$$,
'power_eyes_order_cancelled', array['Name','Code'], 65),

('00000000-0000-0000-0000-000000000001','repair_received','repair','Repair received',
$$Hi [Name] 👋 We’ve received your *[Item]* for repair. 🙏 Our workshop team will take good care of it — we’ll update you with a timeline soon. 💙 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

We’ve received your *[Item]* for repair. 🙏

Don’t worry — our workshop team will take good care of it and do their best to get it back to you in great shape. 🔧👓

We’ll update you as soon as we have an estimated timeline.

Thank you for trusting *Power Eyes Opticals* with your eyewear. 💙

— *Team Power Eyes Opticals*$$,
null, array['Name','Item'], 70),

('00000000-0000-0000-0000-000000000001','repair_in_progress','repair','Repair in progress',
$$Hi [Name] 👋 Your *[Item]* repair is underway at our workshop. 🔧 We’ll keep you posted! 💙 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋

Just a quick update on your *[Item]*. 😊

Your repair is currently underway at our workshop. 🔧👓

Our team is taking care to make sure the repair is done properly before it comes back to you.

Thank you for your patience and for trusting us with your eyewear. 💙

We’ll keep you posted!

— *Team Power Eyes Opticals*$$,
null, array['Name','Item'], 80),

('00000000-0000-0000-0000-000000000001','repair_ready','repair','Repair ready',
$$Good news, [Name]! 🎉 Your repaired *[Item]* is ready for pickup at our *[Store]* store. 👓 See you soon! — *Team Power Eyes Opticals*$$,
$$Good news, [Name]! 🎉😊

Your repaired *[Item]* is ready for pickup at our *[Store]* store. 👓💙

Drop by whenever it’s convenient for you — we’ll have everything ready.

See you soon! 😊

— *Team Power Eyes Opticals*$$,
null, array['Name','Item','Store'], 90),

('00000000-0000-0000-0000-000000000001','post_purchase','after_sales','Post-purchase check-in (3–7 days after delivery)',
$$Hi [Name] 👋 Just checking in from the *Power Eyes family.* 💙 How are you getting along with your new glasses? If you need anything, just drop us a message. — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

Just checking in from the *Power Eyes family.* 💙

How are you getting along with your new glasses? 👓

We hope you’re comfortable and enjoying them!

If you need an adjustment, have a question, or feel that anything isn’t quite right, just drop us a message.

*Your comfort matters to us.* 🤝

— *Team Power Eyes Opticals*$$,
null, array['Name'], 100),

('00000000-0000-0000-0000-000000000001','adjustment_reminder','after_sales','Adjustment / service reminder',
$$Hi [Name] 👋 A little reminder — if your glasses ever feel loose or need an adjustment, don’t hesitate to visit us. 👓 *We’re here whenever you need us.* — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

A little reminder from your friends at *Power Eyes Opticals.* 💙

If your glasses ever feel loose, uncomfortable, or need a small adjustment, don’t hesitate to visit us. 👓

*You don’t have to wait until your next purchase — we’re here whenever you need us.* 🤝

We’re always happy to help!

— *Team Power Eyes Opticals*$$,
null, array['Name'], 110),

('00000000-0000-0000-0000-000000000001','feedback','feedback','Customer feedback',
$$Hi [Name] 👋 We hope you’re enjoying your glasses! ✨ We’d love to know: *How was your experience with us?* 💙 Your feedback helps our team improve. — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

We hope you’re enjoying your glasses! 👓✨

At *Power Eyes Opticals*, we’re always looking for ways to serve our customers better.

We’d love to know:

*How was your experience with us?* 💙

Your feedback helps our team improve and helps us understand what we’re doing right.

Thank you for being part of the *Power Eyes family!* ❤️

— *Team Power Eyes Opticals*$$,
null, array['Name'], 120),

('00000000-0000-0000-0000-000000000001','welcome_back','relationship','Welcome back (returning customer)',
$$Hi [Name]! 👋 *Welcome back to the Power Eyes family!* ❤️ Whether it’s a new pair, updated lenses or a quick adjustment — we’re happy to help. — *Team Power Eyes Opticals*$$,
$$Hi [Name]! 👋😊

*Welcome back to the Power Eyes family!* ❤️👓

It’s always wonderful to see you again.

Whether you’re looking for a new pair, updating your lenses, or simply need a quick adjustment, we’re happy to help. 🤝

Thank you for continuing to trust *Power Eyes Opticals* with your vision. 💙

We’re always here for you and your family!

— *Team Power Eyes Opticals*$$,
null, array['Name'], 130),

('00000000-0000-0000-0000-000000000001','referral','relationship','Family member / referral',
$$Hi [Name] 👋 A warm welcome to the *Power Eyes family!* ❤️ And a special thank you to *[Existing Customer Name]* for bringing you to us! 🤝 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

A warm welcome to the *Power Eyes family!* ❤️👓

We’re happy to be taking care of your eyewear, just like we’ve been doing for families since 1998.

And a special thank you to *[Existing Customer Name]* for bringing you to us! 🤝

Whenever you or your family need us — whether it’s a new pair, an adjustment, a repair, or simply some advice — *we’re always here to help.* 💙

Welcome to the family! 😊

— *Team Power Eyes Opticals*$$,
null, array['Name','Existing Customer Name'], 140),

('00000000-0000-0000-0000-000000000001','anniversary','relationship','Customer anniversary',
$$Hi [Name] 👋 A little message from the *Power Eyes family* today. 💙 Thank you for letting us be part of your eyewear journey — here’s to many more years of caring for your vision! 🤝 — *Team Power Eyes Opticals*$$,
$$Hi [Name] 👋😊

A little message from the *Power Eyes family* today. 💙

Thank you for choosing us and allowing us to be part of your eyewear journey.

Since 1998, we’ve believed that customers aren’t just customers — *they become part of our family.* ❤️👓

We truly appreciate your continued trust and support.

Here’s to many more years of taking care of your vision! 🤝😊

— *Team Power Eyes Opticals*$$,
null, array['Name'], 150),

('00000000-0000-0000-0000-000000000001','internal_followup','staff','Internal follow-up (staff only)',
E'*INTERNAL FOLLOW-UP* 🔔\n\nCustomer: [Name]\nAwaiting reply regarding:\n[Detail]\n\nLast contact: [Date]\n\nNext action:\n[Next Action]\n\nPlease follow up with the customer.',
E'*INTERNAL FOLLOW-UP* 🔔\n\nCustomer: [Name]\nAwaiting reply regarding:\n[Detail]\n\nLast contact: [Date]\n\nNext action:\n[Next Action]\n\nPlease follow up with the customer.',
null, array['Name','Detail','Date','Next Action'], 160),

('00000000-0000-0000-0000-000000000001','rx_share','documents','Prescription share',
$$Hi [Name] 👋 Your prescription [Rx Code] from Power Eyes Opticals is ready and valid till [Valid Till]. View it anytime: [Link] 💙$$,
$$Hi [Name] 👋😊

Here’s your prescription from *Power Eyes Opticals.* 📋👓

*Prescription:* [Rx Code]
*Valid till:* [Valid Till]

You can view and download it anytime from your Power Eyes account:
[Link]

Take care of those eyes! 💙

— *Team Power Eyes Opticals*$$,
null, array['Name','Rx Code','Valid Till','Link'], 170),

('00000000-0000-0000-0000-000000000001','appointment_reminder','appointments','Appointment reminder',
$$Hi [Name] 👋 Reminder: your *[Type]* appointment at Power Eyes Opticals is on *[Date]* at *[Time]*. Please arrive 5 minutes early. 📅$$,
$$Hi [Name] 👋

Just a friendly reminder of your *[Type]* appointment at Power Eyes Opticals on *[Date]* at *[Time]*. 📅

Please arrive 5 minutes early — we’ll be ready for you!

See you soon! 😊

— *Team Power Eyes Opticals*$$,
null, array['Name','Type','Date','Time'], 180),

('00000000-0000-0000-0000-000000000001','appointment_confirmed','appointments','Appointment confirmed',
$$Hi [Name] 👋 Your eye test at Power Eyes Opticals is confirmed for *[Date]* at *[Time]*. 📅 Please arrive 5 minutes early — the test is completely free. 💙$$,
$$Hi [Name] 👋😊

Your eye test at *Power Eyes Opticals* is confirmed! ✅

📅 *Date:* [Date]
🕐 *Time:* [Time]
📍 *Store:* [Store]

Please arrive 5 minutes early — the test takes 20–30 minutes and is completely free.

Need to reschedule? Just message us. 💙

— *Team Power Eyes Opticals*$$,
'power_eyes_appt_confirmed', array['Name','Date','Time','Store'], 190),

('00000000-0000-0000-0000-000000000001','quotation_share','sales','Quotation share',
$$Hi [Name] 👋 Your quotation [Code] from Power Eyes Opticals is ready — [Amount], valid till [Valid Till]. Any questions? Just reply here. 💙$$,
$$Hi [Name] 👋😊

Here’s your quotation *[Code]* from Power Eyes Opticals for *[Amount]*, valid till *[Valid Till]*. 📋

Take your time to look it over — and if you have any questions, or would like to see a few more options, we’re just a message away. 💙

— *Team Power Eyes Opticals*$$,
null, array['Name','Code','Amount','Valid Till'], 200),

('00000000-0000-0000-0000-000000000001','balance_due','finance','Balance due reminder',
$$Hi [Name] 👋 A balance of [Balance] is pending on order [Code] at Power Eyes Opticals. You can pay at any of our stores. 💙$$,
$$Hi [Name] 👋😊

A gentle reminder that a balance of *[Balance]* is pending on your order *[Code]* at Power Eyes Opticals. 💙

You can pay at any of our stores — or let us know if you’d like a payment link.

Thank you! 🤝

— *Team Power Eyes Opticals*$$,
null, array['Name','Code','Balance'], 210),

('00000000-0000-0000-0000-000000000001','rx_expiry','automation','Prescription expiry reminder',
$$Hi [Name] 👋 Your Power Eyes prescription expires in *[Days] days* (on *[Expiry Date]*). Book your free eye test: [Link] 💙$$,
$$Hi [Name] 👋😊

A little reminder from *Power Eyes Opticals* — your prescription expires in *[Days] days*, on *[Expiry Date]*. 📋

An up-to-date prescription gives you sharper vision and helps us spot any changes early.

Book your free eye test here: [Link] 📅

— *Team Power Eyes Opticals*$$,
'power_eyes_rx_expiry', array['Name','Days','Expiry Date','Link'], 220),

('00000000-0000-0000-0000-000000000001','birthday','automation','Birthday offer',
$$Happy Birthday [Name]! 🎂 Celebrate with *[Discount] off* your next purchase at Power Eyes Opticals. Use code: *[Coupon]* — valid till [Expiry]. 🎉$$,
$$Happy Birthday, [Name]! 🎂🎉

A little gift from the *Power Eyes family* to celebrate you — *[Discount] off* your next purchase. 💙

Use code: *[Coupon]*
Valid till: [Expiry]

Shop for a fresh new look, or visit us at the store — we’d love to help you pick something special!

— *Team Power Eyes Opticals*$$,
'power_eyes_birthday_offer', array['Name','Discount','Coupon','Expiry'], 230),

('00000000-0000-0000-0000-000000000001','cart_recovery','automation','Abandoned cart recovery',
$$Hi [Name] 👋 You left *[Item]* in your bag at Power Eyes Opticals. Your selection is saved — complete your order before it goes out of stock: [Cart Link] 💙$$,
$$Hi [Name] 👋😊

Just letting you know — your *[Item]* is still waiting in your bag at *Power Eyes Opticals.* 👓

Your selection is saved, but stock moves fast. Complete your order here: [Cart Link]

Need help choosing lenses or frames? We’re just a message away. 💙

— *Team Power Eyes Opticals*$$,
'power_eyes_cart_recovery', array['Name','Item','Cart Link'], 240),

('00000000-0000-0000-0000-000000000001','reorder_reminder','automation','Reorder reminder',
$$Hi [Name] 👋 It’s been *[Months] months* since your last visit for *[Product]*. Time for a check-up? We’d love to see you! 👓$$,
$$Hi [Name] 👋😊

It’s been *[Months] months* since we last saw you for your *[Product]* — and we were thinking of you! 💙

A fresh check-up keeps your vision sharp — and it’s a lovely excuse to visit the *Power Eyes family* again. 👓

Book your free eye test or just drop by — we’d love to see you!

— *Team Power Eyes Opticals*$$,
'power_eyes_reorder_reminder', array['Name','Product','Months'], 250)

on conflict (org_id, key) do nothing;

-- ── 2. Settings-driven code prefixes ─────────────────────────────────────────
-- code_prefixes is a JSONB object in org_settings, e.g.
--   {"customer":"CUS-","repair":"REP-","sku_frame":"FRM-", ...}
-- Unknown/blank entries fall back to the prefix the caller passes.
create or replace function public.next_code(p_org uuid, p_key text, p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare n int; v_prefix text;
begin
  select case when jsonb_typeof(value) = 'object' then nullif(value ->> p_key, '') end
    into v_prefix
    from org_settings
    where org_id = p_org and key = 'code_prefixes';
  v_prefix := coalesce(v_prefix, p_prefix);
  insert into counters(org_id,key,value) values (p_org,p_key,1)
  on conflict (org_id,key) do update set value = counters.value + 1 returning value into n;
  return v_prefix || lpad(n::text, 4, '0');
end $$;

-- ── 3. Public site settings (read by the website) ─────────────────────────────
-- org_settings RLS blocks anon (current_org() is NULL), so expose the handful of
-- public-safe keys through a view (executes with owner rights → bypasses RLS).
create or replace view public.public_site_settings as
  select key, value
  from public.org_settings
  where org_id = '00000000-0000-0000-0000-000000000001'
    and key in ('whatsapp_number', 'instagram', 'analytics_id');
grant select on public.public_site_settings to anon, authenticated;
