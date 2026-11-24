-- Platform break-glass (plan §6/§10 + acceptance criterion 5).
--
-- Platform admins run companies through billing/subscription metadata only;
-- customer records are company-private. When support genuinely needs to look at
-- a company's private data, access must be EXPLICIT (a typed reason of at least
-- 10 characters), SCOPED (one platform user × one company), SHORT-LIVED
-- (30 minutes, bounded by the database itself) and AUDITED (platform_audit_logs
-- on grant, view and revoke — the app writes those alongside this row).
--
-- This table is the grant. RLS is enabled with NO policies and privileges are
-- revoked from anon/authenticated, so tenants can neither read nor mint grants:
-- only the service-role client reaches it, and only from platform routes after
-- requirePlatform() has succeeded.

create table if not exists public.break_glass_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  platform_user_id uuid not null,              -- auth user id of the platform admin
  reason text not null check (length(trim(reason)) >= 10),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  viewed_at timestamptz,
  revoked_at timestamptz,
  constraint break_glass_window check (expires_at > granted_at)
);

create index if not exists break_glass_grants_org_idx
  on public.break_glass_grants (org_id, granted_at desc);

alter table public.break_glass_grants enable row level security;
-- Deliberately zero policies: deny-by-default for every tenant role.
revoke all on table public.break_glass_grants from anon, authenticated;
