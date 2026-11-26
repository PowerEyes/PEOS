insert into org_settings (org_id, key, value) values
 ('00000000-0000-0000-0000-000000000001','max_staff_discount_pct','10'),
 ('00000000-0000-0000-0000-000000000001','quotation_valid_days','14') on conflict do nothing;
-- Lens index + add-ons from your lens wizard screen. 1.67 and 1.74 have no price on the screen: set them in PowerOS, then activate.
insert into lens_options (org_id, grp, code, name, description, price, badge, status, display_order) values
 ('00000000-0000-0000-0000-000000000001','index','IDX-156','1.56 Standard Index','Great balance of clarity and value',0,null,'active',1),
 ('00000000-0000-0000-0000-000000000001','index','IDX-160','1.60 Mid Index','Thinner and lighter than 1.56',1500,null,'active',2),
 ('00000000-0000-0000-0000-000000000001','index','IDX-167','1.67 High Index','Up to 30% thinner than 1.56',0,null,'draft',3),
 ('00000000-0000-0000-0000-000000000001','index','IDX-174','1.74 Ultra High Index','Up to 40% thinner than 1.56',0,null,'draft',4),
 ('00000000-0000-0000-0000-000000000001','addon','AD-ARC','Anti-Reflective Coating (HMC)','Reduces glare and improves clarity',1500,'Most Popular','active',1),
 ('00000000-0000-0000-0000-000000000001','addon','AD-SCR','Scratch Resistant Coating','Protects lenses from daily wear and tear',800,null,'active',2),
 ('00000000-0000-0000-0000-000000000001','addon','AD-WAT','Water Resistant Coating','Repels water, dust and smudges',800,null,'active',3),
 ('00000000-0000-0000-0000-000000000001','addon','AD-UV','UV Protection','Blocks 100% harmful UV rays',600,null,'active',4),
 ('00000000-0000-0000-0000-000000000001','addon','AD-CLN','Easy Clean Coating','Makes lenses easier to clean',700,null,'active',5),
 ('00000000-0000-0000-0000-000000000001','addon','AD-TNT','Tint (Sunglasses)','Choose from multiple colours',1200,null,'active',6),
 ('00000000-0000-0000-0000-000000000001','addon','AD-MIR','Mirror Coating','Stylish and enhanced glare reduction',1500,null,'active',7),
 ('00000000-0000-0000-0000-000000000001','addon','AD-ENG','Engraving','Add a personal touch to your glasses',1000,null,'active',8) on conflict do nothing;
