-- ── Add clinical range columns to lens_packages ──────────────────────────────
alter table lens_packages add column if not exists design text not null default 'single_vision'
  check (design in ('single_vision','progressive','bifocal','reading','plano','occupational'));
alter table lens_packages add column if not exists min_sph numeric(5,2) default -20.0;
alter table lens_packages add column if not exists max_sph numeric(5,2) default 20.0;
alter table lens_packages add column if not exists min_cyl numeric(5,2) default -6.0;
alter table lens_packages add column if not exists max_cyl numeric(5,2) default 0.0;
alter table lens_packages add column if not exists min_add numeric(4,2) default 0.0;
alter table lens_packages add column if not exists max_add numeric(4,2) default 4.0;
alter table lens_packages add column if not exists available_indexes text[] default array['1.56','1.60','1.67'];
alter table lens_packages add column if not exists included_coatings text[] default array['ar'];
alter table lens_packages add column if not exists min_age int default 0;
alter table lens_packages add column if not exists max_age int default 120;

-- Seed Power Eyes standard packages (edit base_price to match your actual pricing)
-- Run 0001-0003 migrations first, org_id must exist
do $$
declare org uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- Single Vision packages
  insert into lens_packages(org_id,code,name,design,short_desc,features,base_price,mrp,
    min_sph,max_sph,min_cyl,max_cyl,available_indexes,included_coatings,display_order,status)
  values
  (org,'SV-CLEAR','Essential Clear','single_vision','Reliable vision for everyday use',
    array['Clear single vision','Scratch resistant coat','UV protection','Suitable for all frames'],
    1490,1990,-10.0,10.0,-4.0,0.0,array['1.56','1.60','1.67','1.74'],array['ar','scratch'],1,'active'),

  (org,'SV-BLUE','Blue Protect','single_vision','Comfort for digital life',
    array['Blocks harmful blue light','Reduces digital eye strain','Anti-reflective coating','100% UV protection'],
    1990,2490,-10.0,10.0,-4.0,0.0,array['1.56','1.60','1.67'],array['ar','blue_light','scratch'],2,'active'),

  (org,'SV-PHOTO','Photo Clear','single_vision','Indoor clear, outdoor dark',
    array['Darkens automatically in sunlight','Clear indoors in seconds','UV400 protection','One pair for all light'],
    2990,3490,-10.0,10.0,-4.0,0.0,array['1.56','1.60','1.67'],array['ar','photochromic','uv400'],3,'active'),

  -- Progressive packages
  (org,'PROG-COMFORT','Progressive Comfort','progressive','Seamless vision at every distance',
    array['Distance, intermediate & near in one lens','No visible line','Soft design for easy adaptation','Anti-reflective coating'],
    3990,4990,-10.0,10.0,-3.0,0.0,array['1.60','1.67'],array['ar','scratch'],4,'active'),

  (org,'PROG-PREMIUM','Progressive Premium','progressive','Premium free-form progressive',
    array['Wider vision zones','Personalised to your frame','Faster adaptation','Minimal peripheral distortion'],
    5990,7490,-12.0,10.0,-4.0,0.0,array['1.60','1.67','1.74'],array['ar','scratch','uv400'],5,'active'),

  (org,'PROG-BLUE','Progressive + Blue Light','progressive','Progressive with screen protection',
    array['All-distance vision','Blue light filter','Ideal for desk workers','Anti-reflective coating'],
    4990,5990,-10.0,10.0,-3.0,0.0,array['1.60','1.67'],array['ar','blue_light','scratch'],6,'active'),

  -- Bifocal
  (org,'BIF-STD','Bifocal Standard','bifocal','Proven correction for presbyopia',
    array['Visible reading segment','Wide distance zone','Durable CR-39 material','Free fitting at store'],
    1990,2490,-10.0,10.0,-3.0,0.0,array['1.56','1.60'],array['ar','scratch'],7,'active'),

  -- Reading
  (org,'READ-STD','Reading Glasses','reading','Clear near vision for reading',
    array['Optimised for 40cm reading distance','Lightweight','Anti-reflective coat','Suitable for all readers'],
    990,1490,0.0,8.0,-2.0,0.0,array['1.56','1.60'],array['ar'],8,'active')

  on conflict (org_id, code) do update set
    design=excluded.design, min_sph=excluded.min_sph, max_sph=excluded.max_sph,
    available_indexes=excluded.available_indexes, included_coatings=excluded.included_coatings;

  -- Index options (lens_options table)
  insert into lens_options(org_id,grp,name,code,description,price,badge,display_order,status)
  values
  (org,'index','1.56 Standard Index','IDX-156','Best optical clarity. Ideal for mild prescriptions (SE up to ±2.0D).',0,null,1,'active'),
  (org,'index','1.60 Mid Index','IDX-160','20% thinner than standard. Recommended for moderate powers (SE ±2.0 to ±4.0D).',500,null,2,'active'),
  (org,'index','1.67 High Index','IDX-167','Significantly thinner and lighter. Ideal for powers above ±4.0D.',1200,'Recommended',3,'active'),
  (org,'index','1.74 Ultra High Index','IDX-174','Our thinnest lens — up to 40% thinner than standard. For powers above ±6.0D.',2500,'For High Power',4,'active'),
  -- Add-ons
  (org,'addon','Anti-Reflective Coating','ADD-AR','Eliminates glare from screens, headlights and indoor lighting. Essential for all lenses.',0,'Included',1,'active'),
  (org,'addon','Blue Light Filter','ADD-BL','Filters high-energy visible blue light. Recommended for 4+ hours daily screen use.',600,'Most Popular',2,'active'),
  (org,'addon','Photochromic (Transitions)','ADD-PHO','Lens darkens automatically outdoors. Replaces the need for prescription sunglasses.',1800,null,3,'active'),
  (org,'addon','UV400 Protection','ADD-UV','Blocks 100% of UVA and UVB rays. Important for outdoor use and plus-power prescriptions.',400,null,4,'active'),
  (org,'addon','Scratch Resistant Coat','ADD-SCR','Hard coating that protects lens surface from everyday micro-scratches.',400,null,5,'active'),
  (org,'addon','Easy Clean Coating','ADD-EC','Hydrophobic and oleophobic coating — water and fingerprints slide right off.',600,null,6,'active'),
  (org,'addon','Tint (Sunglasses)','ADD-TINT','Fixed tint for prescription sunglasses. Choose from grey, brown or green.',800,null,7,'active')
  on conflict (org_id, code) do nothing;

end $$;

comment on column lens_packages.design is 'single_vision | progressive | bifocal | reading | plano | occupational';
comment on column lens_packages.available_indexes is 'Array of lens index values this package is available in';
comment on column lens_packages.included_coatings is 'Coatings already included in base_price (ar, scratch, blue_light, uv400, etc.)';
