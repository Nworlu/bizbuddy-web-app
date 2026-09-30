-- Accounts already sent the WhatsApp welcome, so each is welcomed at most once.
-- Only the server (secret key) uses it: row level security on, no policies.
create table public.whatsapp_welcomes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null,
  sent_at timestamptz not null default now()
);

alter table public.whatsapp_welcomes enable row level security;
