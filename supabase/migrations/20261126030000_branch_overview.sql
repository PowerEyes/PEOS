-- Owner / manager dashboards. SECURITY INVOKER: every number respects row-level security, so a user can only ever
-- aggregate what they are allowed to read. Day boundaries use India time.
create or replace function public.branch_overview() returns table (
  branch_id uuid, branch text, today_sales numeric, today_orders int, month_sales numeric, month_orders int, month_collected numeric,
  low_stock int, open_repairs int, lab_pending int)
language sql stable security invoker set search_path = public as $$
  with d as (select (now() at time zone 'Asia/Kolkata')::date as today, date_trunc('month', now() at time zone 'Asia/Kolkata')::date as m0)
  select b.id, b.name,
    coalesce((select sum(s.grand_total) from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date = d.today), 0),
    (select count(*)::int from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date = d.today),
    coalesce((select sum(s.grand_total) from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date >= d.m0), 0),
    (select count(*)::int from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date >= d.m0),
    coalesce((select sum(s.paid_total) from sales s, d where s.branch_id = b.id and s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date >= d.m0), 0),
    (select count(*)::int from stock k where k.branch_id = b.id and k.reorder_level > 0 and k.qty <= k.reorder_level),
    (select count(*)::int from repairs r where r.branch_id = b.id and r.status in ('pending', 'in_progress')),
    (select count(*)::int from sales s where s.branch_id = b.id and s.kind = 'order' and s.status in ('lab_pending', 'in_workshop', 'qc'))
  from branches b where b.org_id = public.current_org() and b.is_active order by b.name $$;

-- Daily sales for the last N days (India time), one branch or all when p_branch is null.
create or replace function public.sales_trend(p_branch uuid default null, p_days int default 14) returns table (day date, amount numeric, orders int)
language sql stable security invoker set search_path = public as $$
  select g::date, coalesce(sum(s.grand_total), 0), count(s.id)::int
  from generate_series((now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 90) - 1), (now() at time zone 'Asia/Kolkata')::date, interval '1 day') g
  left join sales s on s.kind = 'order' and s.status <> 'cancelled' and (s.created_at at time zone 'Asia/Kolkata')::date = g::date
       and (p_branch is null or s.branch_id = p_branch) and s.org_id = public.current_org()
  group by 1 order by 1 $$;
grant execute on function public.branch_overview() to authenticated;
grant execute on function public.sales_trend(uuid, int) to authenticated;

-- ITC summary that honours the branch switcher (null = all branches). SECURITY INVOKER respects RLS.
create or replace function public.itc_summary_scoped(p_branch uuid default null) returns table (
  period text, invoice_count int, total_purchases numeric, eligible_cgst numeric, eligible_sgst numeric, eligible_igst numeric, total_itc numeric, claimed_itc numeric)
language sql stable security invoker set search_path = public as $$
  select to_char(invoice_date, 'YYYY-MM'), count(*)::int, sum(grand_total)::numeric(14,2),
    sum(case when itc_eligible then cgst_amount else 0 end)::numeric(14,2), sum(case when itc_eligible then sgst_amount else 0 end)::numeric(14,2),
    sum(case when itc_eligible then igst_amount else 0 end)::numeric(14,2), sum(case when itc_eligible then cgst_amount + sgst_amount + igst_amount else 0 end)::numeric(14,2),
    sum(case when itc_claimed then cgst_amount + sgst_amount + igst_amount else 0 end)::numeric(14,2)
  from purchase_invoices where status != 'cancelled' and org_id = public.current_org() and (p_branch is null or branch_id = p_branch)
  group by 1 $$;
grant execute on function public.itc_summary_scoped(uuid) to authenticated;
