-- A prescription attached to any sale must be approved by an optometrist.
-- This is a table-boundary guard, so it also protects public.place_sale() and
-- any future sale-writing RPC from accidentally bypassing the review gate.
create or replace function public.require_approved_sale_prescription()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_review_status text;
  v_approved_by uuid;
begin
  if new.prescription_id is null then
    return new;
  end if;

  select review_status, approved_by
    into v_review_status, v_approved_by
    from public.prescriptions
   where id = new.prescription_id
     and org_id = new.org_id;

  if not found then
    raise exception 'Prescription is not available to this organisation'
      using errcode = '23503';
  end if;

  if v_review_status is distinct from 'approved' or v_approved_by is null then
    raise exception 'An optometrist must approve the prescription before a sale can be created'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_require_approved_prescription on public.sales;
create trigger trg_sales_require_approved_prescription
  before insert or update of prescription_id, org_id on public.sales
  for each row execute function public.require_approved_sale_prescription();
