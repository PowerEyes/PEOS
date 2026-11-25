-- Idempotent demo tenant seed. The foundation migration may already have
-- created the canonical organization and default branch.
insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Power Eyes Opticals')
on conflict (id) do nothing;

insert into branches (org_id, code, name) values
 ('00000000-0000-0000-0000-000000000001', 'MOG-E', 'Mogappair East'),
 ('00000000-0000-0000-0000-000000000001', 'MOG-W', 'Mogappair West')
on conflict (org_id, code) do nothing;

-- After your first sign-up, approve yourself as owner (replace the email):
-- update profiles set org_id='00000000-0000-0000-0000-000000000001', role_key='owner', is_approved=true
--  where id = (select id from auth.users where email='you@example.com');
