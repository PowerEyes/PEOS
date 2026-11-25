-- HSN defaults per product type (update individually after adding products)
insert into org_settings (org_id, key, value) values
 ('00000000-0000-0000-0000-000000000001','gstin',to_jsonb('33AAAAA0000A1Z5'::text)),
 ('00000000-0000-0000-0000-000000000001','state',to_jsonb('Tamil Nadu'::text)),
 ('00000000-0000-0000-0000-000000000001','state_code',to_jsonb('33'::text)) on conflict (org_id, key) do nothing;
-- Common optical HSN codes (post Sep 2025 rates)
-- 900311 plastic frames 18%, 900319 metal frames 18%
-- 900410 sunglasses 18%, 900130 contact lenses 5%
-- 900140/900150 spectacle lenses glass/plastic 5%
-- Update your products with the correct HSN via PowerOS Inventory
update products set hsn='900311', price_mode='inclusive'
  where org_id='00000000-0000-0000-0000-000000000001' and kind='frame' and hsn is null and (attrs->>'material' is null or attrs->>'material' in ('Plastic','Acetate','TR90'));
update products set hsn='900319', price_mode='inclusive'
  where org_id='00000000-0000-0000-0000-000000000001' and kind='frame' and hsn is null and attrs->>'material' in ('Metal','Titanium');
update products set hsn='900410', price_mode='inclusive'
  where org_id='00000000-0000-0000-0000-000000000001' and kind='sunglass' and hsn is null;
update products set hsn='900130', price_mode='inclusive'
  where org_id='00000000-0000-0000-0000-000000000001' and kind='contact_lens' and hsn is null;
update products set hsn='900790', price_mode='inclusive'
  where org_id='00000000-0000-0000-0000-000000000001' and kind='accessory' and hsn is null;
