insert into organizations (id, name) values ('00000000-0000-0000-0000-000000000001','Power Eyes Opticals');
insert into branches (org_id, code, name) values
 ('00000000-0000-0000-0000-000000000001','MOG-E','Mogappair East'),
 ('00000000-0000-0000-0000-000000000001','MOG-W','Mogappair West');
-- After your first sign-up, approve yourself as owner (replace the email):
-- update profiles set org_id='00000000-0000-0000-0000-000000000001', role_key='owner', is_approved=true
--  where id = (select id from auth.users where email='you@example.com');
