-- Check-ins BizBuddy starts: the 7pm "how was business today?" and the Sunday weekly summary.
-- One row per shop, kind, and Lagos date, so each goes out at most once even if the scheduler runs twice.
-- Server only (secret key): no row level security policies.

create table public.check_ins (
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('evening', 'weekly')),
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (business_id, kind, day)
);

alter table public.check_ins enable row level security;
