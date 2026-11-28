-- Every internal link stored in CMS tables must be a known storefront route or an active site page.
-- Run: psql -v ON_ERROR_STOP=1 -f supabase/tests/stored_links.sql   (edit the route list if you add pages)
do $$ declare bad text; begin
  with routes(r) as (values ('/'),('/eyeglasses'),('/sunglasses'),('/lenses'),('/contact-lenses'),('/computer-glasses'),('/kids'),('/accessories'),('/offers'),('/blog'),('/wishlist'),('/privacy'),('/terms'),('/store-locator'),('/help-me-choose'),('/eye-test'),('/clinical-services'),('/cart'),('/my'),('/my/orders'),('/my/prescriptions'),('/my/vision-id'),('/my/eye-examinations'),('/my/loyalty'),('/my/repairs'),('/my/addresses'),('/my/appointments'),('/my/documents'),('/my/eyewear'),('/my/family'),('/my/help'),('/my/notifications'),('/my/payments'),('/my/profile'),('/my/reorder'),('/my/warranty')),
  l as (select cta_link v from website_content union all select cta2_link from website_content union all select link from website_content union all select cta_link from website_sections union all select cta_href from offers)
  select string_agg(distinct v, ', ') into bad from l where v like '/%' and split_part(split_part(v,'?',1),'#',1) not in (select r from routes) and split_part(split_part(v,'?',1),'#',1) not in (select '/'||slug from site_pages where is_active);
  if bad is not null then raise exception 'Dead stored links: %', bad; end if;
  if exists (select 1 from website_content where cta_link='#') then raise exception 'Placeholder # link stored'; end if;
  raise notice 'ok   stored CMS links all resolve';
end $$;
