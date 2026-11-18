insert into org_settings (org_id, key, value) values
 ('00000000-0000-0000-0000-000000000001','gst_enabled','true'),
 ('00000000-0000-0000-0000-000000000001','lab_lead_days','5') on conflict do nothing;
