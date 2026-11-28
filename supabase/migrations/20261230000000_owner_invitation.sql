-- Platform-registered companies invite their first owner. Only the service role can insert
-- invitations (no INSERT policy; invite_staff() still refuses role 'owner').
alter table staff_invitations drop constraint if exists staff_invitations_role_key_check;
alter table staff_invitations add constraint staff_invitations_role_key_check check (role_key = any (array['owner','admin','branch_manager','staff','optometrist','sales_executive','cashier','inventory_manager','lab_technician','accountant','receptionist']));
