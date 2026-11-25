-- Clinical website content controlled by ERP Website Controller.
create table if not exists public.clinical_services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id),
  slug text not null,
  title text not null,
  category text not null default 'Eye Examination',
  short_description text not null default '',
  description text not null default '',
  benefits jsonb not null default '[]'::jsonb,
  tests jsonb not null default '[]'::jsonb,
  icon text not null default '👁️',
  hero_image text,
  booking_label text not null default 'Book an Appointment',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, slug)
);
create index if not exists clinical_services_org_active_order_idx on public.clinical_services(org_id,is_active,display_order);
alter table public.clinical_services enable row level security;
drop policy if exists clinical_services_public_read on public.clinical_services;
drop policy if exists clinical_services_staff_read on public.clinical_services;
drop policy if exists clinical_services_staff_insert on public.clinical_services;
drop policy if exists clinical_services_staff_update on public.clinical_services;
drop policy if exists clinical_services_staff_delete on public.clinical_services;
create policy clinical_services_public_read on public.clinical_services for select to anon,authenticated using (is_active and org_id=public.request_org());
create policy clinical_services_staff_read on public.clinical_services for select to authenticated using (org_id=public.current_org());
create policy clinical_services_staff_insert on public.clinical_services for insert to authenticated with check (org_id=public.current_org() and public.is_admin());
create policy clinical_services_staff_update on public.clinical_services for update to authenticated using (org_id=public.current_org() and public.is_admin()) with check (org_id=public.current_org());
create policy clinical_services_staff_delete on public.clinical_services for delete to authenticated using (org_id=public.current_org() and public.is_admin());
-- Seed starter clinical service data per tenant. Operators may edit/delete in Website Controller.
insert into public.clinical_services(org_id,slug,title,category,short_description,description,benefits,tests,icon,display_order)
select o.id,v.slug,v.title,v.category,v.short_description,v.description,v.benefits::jsonb,v.tests::jsonb,v.icon,v.ord
from public.organizations o cross join (values
('comprehensive-eye-examination','Comprehensive Eye Examination','Eye Examination','A complete assessment of vision and eye health.','Our comprehensive examination combines vision testing, refraction and eye-health screening to help understand your vision needs and recommend the next steps.','["Understand your current vision","Check refractive needs","Screen for common eye-health concerns","Receive personalised recommendations"]','["Visual acuity","Refraction","Binocular vision screening","Eye-health assessment"]','👁️',1),
('pediatric-eye-examination','Pediatric Eye Examination','Children’s Eye Care','Child-friendly vision and eye-health assessment.','A child-focused assessment designed around age, communication and visual development.','["Age-appropriate testing","Visual development review","Guidance for parents","Follow-up recommendations"]','["Visual acuity","Refraction as appropriate","Binocular vision screening","Eye-health assessment"]','🧒',2),
('myopia-management','Myopia Management Consultation','Myopia Management','Review progressing myopia and management options.','A consultation to review a child’s myopia, progression history and clinically appropriate management choices.','["Review myopia progression","Discuss evidence-based options","Personalised follow-up plan"]','["Refraction review","Visual habits review","Clinical suitability assessment"]','🔎',3),
('contact-lens-assessment','Contact Lens Assessment','Contact Lens Care','Assessment and guidance for contact lens wear.','Professional assessment for contact lens suitability, fitting, handling and care.','["Fitting guidance","Handling and hygiene education","Follow-up advice"]','["Suitability assessment","Fit evaluation","Handling instruction"]','🫧',4),
('binocular-vision-assessment','Binocular Vision Assessment','Binocular Vision','Assess how both eyes work together.','Assessment of visual comfort, alignment and coordination when clinically indicated.','["Visual comfort review","Coordination assessment","Recommendations and referral guidance"]','["Cover test","Binocular function","Near-point assessment as indicated"]','🎯',5),
('follow-up-examination','Follow-up Examination','Follow-up Care','Review symptoms, treatment or prescription changes.','Follow-up appointment to review your previous examination and progress.','["Review previous findings","Monitor changes","Update recommendations"]','["History review","Relevant repeat tests","Plan review"]','📋',6)
) v(slug,title,category,short_description,description,benefits,tests,icon,ord)
where not exists(select 1 from public.clinical_services s where s.org_id=o.id and s.slug=v.slug);
insert into public.site_pages(org_id,slug,kind,title,subtitle,body,display_order)
select o.id,'clinical-home','page','Power Eyes Clinical Care','Expert eye care for every stage of life',
'{"hero_title":"Your vision deserves expert care","hero_subtitle":"Clinical eye care, trusted optometrists and personalised guidance for the whole family.","hero_cta":"Book an Eye Examination","hero_cta_link":"/eye-test","secondary_cta":"Explore Clinical Services","secondary_cta_link":"/clinical-services","highlights":[{"title":"Expert optometrists","text":"Professional eye care and clear guidance."},{"title":"Family-focused","text":"Care designed for adults and children."},{"title":"Connected care","text":"Your clinical journey connects with PowerOS."}],"closing_title":"Your clinical care and optical store, together","closing_text":"Explore eye care services or visit our optical store for eyewear, lenses and accessories."}'::jsonb,0
from public.organizations o where not exists(select 1 from public.site_pages p where p.org_id=o.id and p.slug='clinical-home');
