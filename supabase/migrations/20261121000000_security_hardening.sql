-- Anonymous clients could insert arbitrary "paid" rows (which feed the cashbook).
-- All legitimate writes go through server routes using the service role.
drop policy if exists online_payments_insert on online_payments;
create unique index if not exists online_payments_payment_id_uq
  on online_payments (razorpay_payment_id) where razorpay_payment_id is not null;
