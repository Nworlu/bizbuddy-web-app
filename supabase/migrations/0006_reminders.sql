-- Reminders the shop owner asks for ("remind me Friday to collect from David"), sent on WhatsApp.
-- Written and read only by the server with the secret key (the website goes through /api/reminders,
-- which takes the phone number from the login), so there are no row level security policies: a user
-- can never point a reminder at someone else's number.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  phone text not null,
  text text not null check (char_length(text) between 1 and 200),
  due_at timestamptz not null,
  sent_at timestamptz,
  done boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

create index reminders_due on public.reminders (due_at) where sent_at is null and not cancelled and not done;
create index reminders_business on public.reminders (business_id, due_at);

alter table public.reminders enable row level security;

-- When each owner last messaged BizBuddy. Inside 24 hours a reminder can be a normal message;
-- after that WhatsApp only allows an approved template (bizbuddy_reminder).
create table public.whatsapp_chats (
  phone text primary key,
  last_inbound_at timestamptz not null
);

alter table public.whatsapp_chats enable row level security;
