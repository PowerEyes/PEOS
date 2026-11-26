-- Editable starter data. Brands come from your screens; add or rename in PowerOS.
insert into brands (org_id, name)
select '00000000-0000-0000-0000-000000000001', n from unnest(array['Ray-Ban','Vogue','Oakley','Titan','Persol','Polaroid','London Horse','Alcon','Essilor','Zeiss','Johnson & Johnson']) n
on conflict do nothing;
insert into lens_packages (org_id, code, name, design, segment, short_desc, base_price, mrp, tax_pct, features, indexes, coatings, sph_min, sph_max, cyl_max, display_order)
values ('00000000-0000-0000-0000-000000000001','LPK-SV-SMART','Smart Clear','single_vision','Everyday Use',
  'Balanced performance with enhanced protection for everyday use.',1500,2500,5,
  array['Scratch Resistant','Anti-Reflective','UV Protection','Blue Light Option','Easy to Clean'],
  array['1.50','1.56','1.60'], array['HC','HMC','Blue Cut'], -10, 8, 4, 2) on conflict do nothing;
